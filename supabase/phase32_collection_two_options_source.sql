-- Phase 32: 修正 record_card_obtained() 白名單 — collection_type 加 'iching_trigram'、
--          source 加 'ic_two_options'。同時把 user_collections / collection_milestone_configs
--          兩張表的 CHECK constraint 一起放寬,讓 schema-as-code 跟 prod 對齊。
--
-- 背景:
--   1. phase23 引入 collection_type='iching_trigram',但 phase23 註解誤判
--      「沒 enum 約束」— 實際上 phase20 line 25 / 51 / 133 都做白名單檢查。
--      Prod 必然 manual 繞過(因為八卦圖鑑線上看得到收藏),但這沒寫進 migration。
--   2. phase31 引入 method='two-options',兩卦各記一張卡,source='ic_two_options',
--      但 phase31 漏了補 record_card_obtained() 的 source 白名單 + 表上的
--      source CHECK constraint,所以 RPC raise exception 被 lib/cardCollection.ts
--      catch 後 silent fallback(distinctCount=0)— 結果就是「恭喜獲得 N/64」
--      永遠顯示 0/64,實際卡也沒寫進 user_collections。
--
--   user-facing symptom:截圖顯示「恭喜獲得! 臨 收藏進度 0/64」即使該用戶之前已
--   收集過卦象 — 因為 fallback 路徑回 0,完全無法反映真實收藏進度。
--
-- 修法:
--   (1) drop 兩張表 collection_type CHECK(prod 已 drop;dev 才會真的 drop)
--   (2) drop user_collections.source CHECK(同樣 idempotent)
--   (3) create or replace record_card_obtained,白名單擴成
--       - collection_type IN ('iching','iching_trigram','tarot')
--       - source           IN ('daily','main','plum_blossom','direction','yes_no',
--                              'ic_two_options','admin_grant')
--       其餘邏輯一字不改,從 phase20 整段複製。
--
-- 設計取捨:為什麼不改 enum 或 lookup table?
--   - 之後還會有新的 collection_type / source(其他卡牌系統 / 新占法入口),
--     拿掉 DB 層 CHECK + 改靠 TS union(lib/cardCollection.ts CollectionType /
--     CollectionSource)在編譯時擋 typo,新增一個 type 只要改 TS + insert
--     milestone configs。DB 層 runtime check 帶來的價值不抵免錯成本。
--
-- Idempotent — 對 prod (constraint 已被 manual drop / function 已 patch trigram)
-- 跟 dev (還沒 drop) 都安全。

-- ─────────────────────────────────────────────
-- 1. 拿掉表上的 CHECK 約束
-- ─────────────────────────────────────────────

alter table public.user_collections
  drop constraint if exists user_collections_collection_type_check;

alter table public.user_collections
  drop constraint if exists user_collections_source_check;

alter table public.collection_milestone_configs
  drop constraint if exists collection_milestone_configs_collection_type_check;

-- ─────────────────────────────────────────────
-- 2. 重建 record_card_obtained() — 白名單擴成 iching_trigram + ic_two_options
--    其餘邏輯與 phase20 保持一致(整段複製)
-- ─────────────────────────────────────────────

create or replace function public.record_card_obtained(
  p_user_id          uuid,
  p_collection_type  text,
  p_card_id          text,
  p_card_subkind     text,
  p_source           text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_new          boolean;
  v_distinct_count  int;
  v_unlocked        jsonb := '[]'::jsonb;
  v_total_credits   int := 0;
  v_m               record;
  v_count           int;
  v_inserted        boolean;
begin
  if p_collection_type not in ('iching', 'iching_trigram', 'tarot') then
    raise exception 'invalid collection_type: %', p_collection_type;
  end if;
  if p_source not in (
    'daily', 'main', 'plum_blossom', 'direction',
    'yes_no', 'ic_two_options', 'admin_grant'
  ) then
    raise exception 'invalid source: %', p_source;
  end if;

  -- (a) UPSERT — xmax=0 trick 判定 INSERT vs UPDATE
  insert into public.user_collections
    (user_id, collection_type, card_id, card_subkind, source, obtain_count)
  values
    (p_user_id, p_collection_type, p_card_id, p_card_subkind, p_source, 1)
  on conflict (user_id, collection_type, card_id) do update
    set obtain_count = user_collections.obtain_count + 1,
        last_obtained_at = now()
  returning (xmax = 0) into v_is_new;

  -- (c) 算總 distinct count
  select count(*)::int into v_distinct_count
    from public.user_collections
   where user_id = p_user_id
     and collection_type = p_collection_type;

  -- (b) admin_grant 不發獎,直接 return
  if p_source = 'admin_grant' then
    return jsonb_build_object(
      'is_new', v_is_new,
      'distinct_count', v_distinct_count,
      'unlocked_milestones', '[]'::jsonb,
      'reward_credits', 0
    );
  end if;

  -- (d) 遍歷 milestone configs
  for v_m in
    select * from public.collection_milestone_configs
     where collection_type = p_collection_type
       and active = true
     order by sort_order, threshold
  loop
    -- 已領跳過
    if exists (
      select 1 from public.collection_milestones
       where user_id = p_user_id and milestone_id = v_m.id
    ) then
      continue;
    end if;

    -- 算這個 milestone 對應的 count
    if v_m.kind = 'distinct_count' then
      v_count := v_distinct_count;
    elsif v_m.kind = 'subkind_full' then
      select count(*)::int into v_count
        from public.user_collections
       where user_id = p_user_id
         and collection_type = p_collection_type
         and card_subkind = v_m.subkind;
    else
      continue;
    end if;

    if v_count >= v_m.threshold then
      -- 寫 milestone log + 發點(用 INSERT … ON CONFLICT DO NOTHING 防併發雙寫)
      insert into public.collection_milestones (user_id, milestone_id, reward_credits)
      values (p_user_id, v_m.id, v_m.reward_credits)
      on conflict (user_id, milestone_id) do nothing
      returning true into v_inserted;

      if coalesce(v_inserted, false) then
        v_total_credits := v_total_credits + v_m.reward_credits;
        if v_m.reward_credits > 0 then
          perform public.add_credits(
            p_user_id        := p_user_id,
            p_amount         := v_m.reward_credits,
            p_reason         := 'collection_milestone',
            p_metadata       := jsonb_build_object(
              'milestone_id', v_m.id,
              'collection_type', p_collection_type,
              'threshold', v_m.threshold,
              'kind', v_m.kind,
              'subkind', v_m.subkind
            )
          );
        end if;
        v_unlocked := v_unlocked || jsonb_build_object(
          'id',             v_m.id,
          'reward_credits', v_m.reward_credits,
          'label_zh',       v_m.label_zh,
          'label_en',       v_m.label_en
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'is_new',              v_is_new,
    'distinct_count',      v_distinct_count,
    'unlocked_milestones', v_unlocked,
    'reward_credits',      v_total_credits
  );
end;
$$;

-- ─────────────────────────────────────────────
-- 3. Backfill — 補登 method='two-options' 已有的占卜紀錄為 user_collections
--    每筆 divination 兩卦各補一張(A 主卦 + B cast_b 卦)。
--
--    Idempotency:用 ON CONFLICT DO NOTHING — 只補「distinct 是否擁有」這層
--    (對 milestone 觸發最關鍵),不重複累加 obtain_count。重跑 migration 安全。
--
--    取捨:這會丟掉「same hex 在多次 two-options 中被反覆抽到」的次數累計。
--    使用者影響小(多數人 two-options 占卜量不多),換來 migration 完全
--    idempotent — 重跑、partial-run、或日後同名 migration 都不會灌水。
-- ─────────────────────────────────────────────

do $$
declare
  r record;
begin
  for r in
    select user_id, hexagram_number, cast_b_hexagram_number, created_at
      from public.divinations
     where method = 'two-options'
       and divine_type = 'iching'
       and hexagram_number is not null
       and cast_b_hexagram_number is not null
  loop
    -- A 卦
    insert into public.user_collections
      (user_id, collection_type, card_id, card_subkind, source, obtain_count, first_obtained_at, last_obtained_at)
    values
      (r.user_id, 'iching', r.hexagram_number::text, null, 'ic_two_options', 1, r.created_at, r.created_at)
    on conflict (user_id, collection_type, card_id) do nothing;

    -- B 卦
    insert into public.user_collections
      (user_id, collection_type, card_id, card_subkind, source, obtain_count, first_obtained_at, last_obtained_at)
    values
      (r.user_id, 'iching', r.cast_b_hexagram_number::text, null, 'ic_two_options', 1, r.created_at, r.created_at)
    on conflict (user_id, collection_type, card_id) do nothing;
  end loop;
end $$;

-- 備註:
-- * Backfill 不重新 replay milestone — 既有用戶可能已從 main / daily 路徑收集
--   到同樣的卦,milestone 由那邊觸發過,再加 ic_two_options 路徑只是補卡 row,
--   不應該重發里程碑點數。如果有用戶因為 two-options 才剛跨過 32/64 或
--   64/64 閾值卻沒拿到獎勵,可由 admin 手動 grant 補發。
-- * lib/cardCollection.ts 的 CollectionSource union 已經有 'ic_two_options',
--   所以前端 / API 層不需要改。
