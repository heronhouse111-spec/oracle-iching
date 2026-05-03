-- Phase 28: 把 collection_type 的 CHECK 約束從 schema 拿掉 + 修正 record_card_obtained()
--
-- 背景:
--   phase23 引入 collection_type='iching_trigram',但 phase23 註解誤判
--   「user_collections / collection_milestone_configs 兩個表的 collection_type
--   都是 TEXT 沒 enum 約束」— 實際上 phase20 line 25 / line 51 都有 CHECK
--   constraint 限定只能 in ('iching','tarot');record_card_obtained() 內部
--   line 130–132 也做同樣的白名單檢查。
--
--   phase23 上線後,線上 DB 必然是被「手動繞過」這幾道閘:既然圖鑑顯示
--   trigram 卡片帶 ×N 徽章(資料來自 user_collections),代表寫入有成功,
--   也就是說 prod 已經 manual 跑過 ALTER TABLE DROP CONSTRAINT 和
--   CREATE OR REPLACE FUNCTION。但這些手動操作沒寫進 migration files,
--   schema-as-code 跟線上 DB 的 source-of-truth 不同步。
--
-- 本 migration 把這個 drift 正式收回:
--   1. drop 兩張表的 collection_type CHECK constraint(if exists,
--      所以對 prod 已 drop / dev 還在 都安全)
--   2. 重建 record_card_obtained(),把白名單擴成包含 'iching_trigram'
--   3. 維持 source 白名單不動 — 那個白名單是真的需要(防止 ad-hoc reason 灌水)
--
-- 設計取捨:為什麼不改成 enum 或 lookup table?
--   - 新 collection_type 之後應該還會出現(例如 'lenormand' 'oracle' 等
--     卡牌系統,或未來「節氣 24 卦」之類的 iching 變體)
--   - 用 TEXT + 應用層白名單(lib/cardCollection.ts CollectionType union)
--     最簡單,新增一個 type 只要改 TS + insert milestone configs 即可
--   - 真正會壞事的是「打錯字寫成 'ichng'」之類的 typo,但這由 TS union
--     在 compile time 攔得到,不需要 DB 層 runtime check

-- ─────────────────────────────────────────────
-- 1. 拿掉表上的 CHECK 約束(prod 應該已經 drop 過,本地/新環境才會真的 drop)
-- ─────────────────────────────────────────────

alter table public.user_collections
  drop constraint if exists user_collections_collection_type_check;

alter table public.collection_milestone_configs
  drop constraint if exists collection_milestone_configs_collection_type_check;

-- ─────────────────────────────────────────────
-- 2. 重建 record_card_obtained() — 白名單加上 'iching_trigram'
--    其餘邏輯一字不改,從 phase20 整段複製過來
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
  if p_source not in ('daily', 'main', 'plum_blossom', 'direction', 'yes_no', 'admin_grant') then
    raise exception 'invalid source: %', p_source;
  end if;

  -- (a) UPSERT — xmax=0 trick 判定 INSERT vs UPDATE(post-9.5 可靠)
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
         and card_subkind = v_m.param;
    else
      v_count := 0;
    end if;

    if v_count >= v_m.threshold then
      insert into public.collection_milestones (user_id, milestone_id, reward_credits)
        values (p_user_id, v_m.id, v_m.reward_credits)
        on conflict do nothing
        returning true into v_inserted;

      if v_inserted then
        v_unlocked := v_unlocked || jsonb_build_object(
          'id', v_m.id,
          'reward_credits', v_m.reward_credits,
          'label_zh', v_m.label_zh,
          'label_en', v_m.label_en
        );
        if v_m.reward_credits > 0 then
          perform public.add_credits(
            p_user_id,
            v_m.reward_credits,
            'collection_milestone',
            null,
            jsonb_build_object('milestone_id', v_m.id)
          );
          v_total_credits := v_total_credits + v_m.reward_credits;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'is_new', v_is_new,
    'distinct_count', v_distinct_count,
    'unlocked_milestones', v_unlocked,
    'reward_credits', v_total_credits
  );
end;
$$;

comment on function public.record_card_obtained(uuid, text, text, text, text) is
  'Atomic 收藏寫入 + 跨閾值自動發里程碑獎勵。回傳 jsonb 含 is_new / distinct_count / unlocked_milestones / reward_credits。 collection_type 接受 iching / iching_trigram / tarot。';
