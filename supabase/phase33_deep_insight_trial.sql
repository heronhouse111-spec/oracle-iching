-- Phase 33: Deep Insight 試用配額 + 削掉訂閱戶 +3 點雙重收費
--
-- 改動方向(配套 lib/credits.ts + app/api/divine|tarot/route.ts):
--   1. 訂閱戶用 Deep Insight 不再加 +3 點 — 改在 API 端依 isActiveSubscriber 跳過
--      surcharge,DB 端不需要改 credit_costs。
--   2. 免費用戶每月 3 次免費 Deep Insight 試用 — 用兩個欄位追蹤:
--        deep_insight_trial_period: 'YYYY-MM' 字串(Asia/Taipei 月份)
--        deep_insight_trial_count : 該月已用幾次
--      換月自動歸零(consume RPC 內判斷)。
--
-- Why 用「月份字串 + count」不用 transactions 表:
--   - 配額純粹是「每月 3 次」,沒有滾動 30 天的需求 → 簡單
--   - 不需要 audit 試用的歷史(只是行銷漏斗)
--   - 一次 RPC 完成 read/check/write,原子性由 row lock 保證
--
-- 套用方式:把整段 SQL 貼進 Supabase Dashboard SQL Editor 執行。

alter table public.profiles
  add column if not exists deep_insight_trial_period text,
  add column if not exists deep_insight_trial_count integer not null default 0;

comment on column public.profiles.deep_insight_trial_period is
  'Deep Insight 試用配額所屬月份(Asia/Taipei 時區,YYYY-MM)。換月會被 consume RPC 自動 reset。';
comment on column public.profiles.deep_insight_trial_count is
  '當月已用試用次數;預設上限 3(寫死在 RPC,要改一起改)。';

-- ──────────────────────────────────────────
-- 試用配額嘗試消耗一次:
--   回傳 true  → 允許 Deep Insight,已扣一次配額
--   回傳 false → 額度用完,call 端應該降級 Quick
--
-- 並發安全:row lock(for update)。同 user 並發兩個請求會被序列化。
-- ──────────────────────────────────────────
create or replace function public.consume_deep_insight_trial(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_now text := to_char(timezone('Asia/Taipei', now()), 'YYYY-MM');
  v_period_db  text;
  v_count_db   integer;
  v_limit      integer := 3;
begin
  select deep_insight_trial_period, deep_insight_trial_count
    into v_period_db, v_count_db
    from public.profiles
   where id = p_user_id
   for update;

  if not found then
    return false;
  end if;

  -- 第一次用 / 換月 → reset 並扣 1
  if v_period_db is null or v_period_db <> v_period_now then
    update public.profiles
       set deep_insight_trial_period = v_period_now,
           deep_insight_trial_count  = 1
     where id = p_user_id;
    return true;
  end if;

  -- 同月配額已滿
  if v_count_db >= v_limit then
    return false;
  end if;

  update public.profiles
     set deep_insight_trial_count = v_count_db + 1
   where id = p_user_id;
  return true;
end;
$$;

revoke all on function public.consume_deep_insight_trial(uuid) from public;
grant execute on function public.consume_deep_insight_trial(uuid) to service_role;

-- ──────────────────────────────────────────
-- 純讀取 — 給前端 picker 顯示「本月剩 X 次免費試用」
--   回傳 0..3
-- ──────────────────────────────────────────
create or replace function public.get_deep_insight_trial_balance(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_period_now text := to_char(timezone('Asia/Taipei', now()), 'YYYY-MM');
  v_period_db  text;
  v_count_db   integer;
  v_limit      integer := 3;
begin
  select deep_insight_trial_period, deep_insight_trial_count
    into v_period_db, v_count_db
    from public.profiles
   where id = p_user_id;

  if not found then
    return 0;
  end if;
  if v_period_db is null or v_period_db <> v_period_now then
    return v_limit;
  end if;
  return greatest(0, v_limit - v_count_db);
end;
$$;

revoke all on function public.get_deep_insight_trial_balance(uuid) from public;
grant execute on function public.get_deep_insight_trial_balance(uuid) to service_role;

-- 驗證 SQL(本機跑一下確認看得到欄位):
--   select id, deep_insight_trial_period, deep_insight_trial_count from public.profiles limit 5;
--   select public.get_deep_insight_trial_balance('<some-user-id>'::uuid);
