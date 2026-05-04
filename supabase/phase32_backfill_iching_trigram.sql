-- Phase 32: 回填 iching_trigram 收藏歷史
--
-- 背景:
--   phase20 的 record_card_obtained() 內部白名單只接受 ('iching','tarot'),
--   兩張表的 collection_type 也有 CHECK 限定。phase23 加入 'iching_trigram'
--   時誤判沒有約束、實際上每次寫入 trigram 的 RPC 都拋例外。
--   lib/cardCollection.ts catch 後回 fallback,使用者前端看到 toast 但 DB 沒寫入。
--
--   phase28 已修 schema 跟 function 白名單。但歷史 direction-hexagram 占卜
--   留下的 trigram 紀錄還躺在 divinations 表(direction_trigram 欄位有值),
--   user_collections 卻是空的 — 使用者看到「收藏進度 0/8」實際抽過的卻可能是 4、6、8 卦。
--
-- 本 migration:
--   1. 從 divinations 重算每個 (user, trigram) 對的 obtain_count,UPSERT 到 user_collections
--   2. 對每個現在已收 ≥ threshold 的 user,補發 iching_trigram milestone(積分一併入帳)
--
-- 冪等性:
--   - INSERT 用 ON CONFLICT DO UPDATE 取 GREATEST,重跑不會增加 count
--   - milestone 用 NOT EXISTS guard,已領的不重發
--   - 必須在 phase28 跑完之後才能跑(否則 INSERT 會撞 CHECK constraint)

-- ─────────────────────────────────────────────
-- 1. 從 divinations 回填 user_collections
-- ─────────────────────────────────────────────

insert into public.user_collections
  (user_id, collection_type, card_id, card_subkind, source, obtain_count,
   first_obtained_at, last_obtained_at)
select
  d.user_id,
  'iching_trigram',
  d.direction_trigram,
  null,
  'direction',
  count(*)::int,
  min(d.created_at),
  max(d.created_at)
from public.divinations d
where d.method = 'direction-hexagram'
  and d.direction_trigram is not null
  and d.user_id is not null
group by d.user_id, d.direction_trigram
on conflict (user_id, collection_type, card_id) do update
  set obtain_count      = greatest(user_collections.obtain_count, excluded.obtain_count),
      first_obtained_at = least(user_collections.first_obtained_at, excluded.first_obtained_at),
      last_obtained_at  = greatest(user_collections.last_obtained_at, excluded.last_obtained_at);

-- ─────────────────────────────────────────────
-- 2. 補發 iching_trigram 里程碑(只看 distinct_count 類)
--    iching_trigram_4 → 收 4 卦,+5 點
--    iching_trigram_8 → 收 8 卦,+20 點
-- ─────────────────────────────────────────────

do $$
declare
  v_user_id  uuid;
  v_distinct int;
  v_m        record;
begin
  for v_user_id in
    select distinct user_id
      from public.user_collections
     where collection_type = 'iching_trigram'
  loop
    select count(*)::int
      into v_distinct
      from public.user_collections
     where user_id = v_user_id
       and collection_type = 'iching_trigram';

    for v_m in
      select * from public.collection_milestone_configs
       where collection_type = 'iching_trigram'
         and active = true
         and kind = 'distinct_count'
       order by threshold
    loop
      if v_distinct >= v_m.threshold
         and not exists (
           select 1 from public.collection_milestones
            where user_id = v_user_id and milestone_id = v_m.id
         )
      then
        insert into public.collection_milestones (user_id, milestone_id, reward_credits)
          values (v_user_id, v_m.id, v_m.reward_credits)
          on conflict do nothing;

        if v_m.reward_credits > 0 then
          perform public.add_credits(
            v_user_id,
            v_m.reward_credits,
            'collection_milestone',
            null,
            jsonb_build_object(
              'milestone_id', v_m.id,
              'backfill',     'phase32_iching_trigram'
            )
          );
        end if;
      end if;
    end loop;
  end loop;
end $$;
