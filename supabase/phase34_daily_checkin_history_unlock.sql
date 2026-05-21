-- Phase 34: 每日簽到 + 歷史紀錄 paywall 改時間制
--
-- 兩部分:
--   B-1 daily_checkins:登入用戶每日簽到一次,可換 1 次免費 Yes/No 占卜
--   B-2 history_unlocks:歷史 paywall 從「只看 3 筆」改成「10 天內全免 +
--       訂閱期間看過的紀錄永久解鎖」。
--
-- 套用方式:整段貼進 Supabase Dashboard SQL Editor 一次執行即可。

-- ──────────────────────────────────────────
-- B-1 每日簽到
-- ──────────────────────────────────────────
create table if not exists public.daily_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Asia/Taipei 時區的日期(避免跨日 UTC 時差讓使用者一天能領兩次)
  checkin_date date not null,
  claimed_at timestamptz not null default now(),
  -- null = 已簽到尚未使用;non-null = 已用過(call /api/yesno 時被消耗)
  used_at timestamptz,
  primary key (user_id, checkin_date)
);

comment on table public.daily_checkins is
  '每日簽到 → 換 1 次免費 yes/no 占卜的 token。phase 34。';

create index if not exists daily_checkins_user_idx
  on public.daily_checkins (user_id, checkin_date desc);

alter table public.daily_checkins enable row level security;

drop policy if exists "Users can view own daily checkins" on public.daily_checkins;
create policy "Users can view own daily checkins"
  on public.daily_checkins for select
  using (auth.uid() = user_id);
-- INSERT/UPDATE 一律走 RPC(security definer),user 不能直寫

-- 嘗試領取今日簽到。
--   true  = 領取成功(第一次)
--   false = 今日已領
create or replace function public.claim_daily_checkin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today    date := (timezone('Asia/Taipei', now()))::date;
  v_inserted boolean;
begin
  insert into public.daily_checkins (user_id, checkin_date)
       values (p_user_id, v_today)
  on conflict (user_id, checkin_date) do nothing
  returning true into v_inserted;
  return coalesce(v_inserted, false);
end;
$$;

revoke all on function public.claim_daily_checkin(uuid) from public;
grant execute on function public.claim_daily_checkin(uuid) to service_role;

-- /api/yesno 嘗試消耗今日免費 token。
--   true  = 有 token 可用,已消耗(yes/no 不扣點)
--   false = 沒簽到 / 已用過(yes/no 走正常扣點)
create or replace function public.consume_daily_yesno(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today   date := (timezone('Asia/Taipei', now()))::date;
  v_updated integer;
begin
  update public.daily_checkins
     set used_at = now()
   where user_id      = p_user_id
     and checkin_date = v_today
     and used_at      is null;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.consume_daily_yesno(uuid) from public;
grant execute on function public.consume_daily_yesno(uuid) to service_role;

-- 給前端 banner 顯示用 — 回今日狀態
create or replace function public.get_daily_checkin_status(p_user_id uuid)
returns table (claimed boolean, used boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('Asia/Taipei', now()))::date;
  v_used  timestamptz;
  v_exists boolean;
begin
  select c.used_at, true
    into v_used, v_exists
    from public.daily_checkins c
   where c.user_id      = p_user_id
     and c.checkin_date = v_today;

  if not coalesce(v_exists, false) then
    return query select false, false;
  else
    return query select true, (v_used is not null);
  end if;
end;
$$;

revoke all on function public.get_daily_checkin_status(uuid) from public;
grant execute on function public.get_daily_checkin_status(uuid) to service_role;


-- ──────────────────────────────────────────
-- B-2 歷史紀錄解鎖記錄
-- ──────────────────────────────────────────
create table if not exists public.history_unlocks (
  user_id        uuid not null references auth.users(id) on delete cascade,
  divination_id  uuid not null references public.divinations(id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, divination_id)
);

comment on table public.history_unlocks is
  '訂閱期間看過的歷史紀錄 → 永久解鎖(退訂後仍可查看)。phase 34。';

create index if not exists history_unlocks_user_idx
  on public.history_unlocks (user_id, unlocked_at desc);

alter table public.history_unlocks enable row level security;

drop policy if exists "Users can view own history unlocks" on public.history_unlocks;
create policy "Users can view own history unlocks"
  on public.history_unlocks for select
  using (auth.uid() = user_id);
-- INSERT/UPDATE 一律走 RPC

-- 把當前訂閱戶全部歷史紀錄一次解鎖。
-- 每次訂閱戶開歷史頁就 call,upsert ignore 衝突 → 只新增「上次解鎖之後新產生的紀錄」。
-- 退訂後 call 會 short-circuit 回 0(由 is_active 防呆)。
create or replace function public.unlock_history_for_subscriber(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_active boolean;
  v_count     integer := 0;
begin
  select coalesce(s.is_active, false)
    into v_is_active
    from public.user_subscription_summary s
   where s.user_id = p_user_id;

  if not coalesce(v_is_active, false) then
    return 0;
  end if;

  with ins as (
    insert into public.history_unlocks (user_id, divination_id)
    select p_user_id, d.id
      from public.divinations d
     where d.user_id = p_user_id
    on conflict (user_id, divination_id) do nothing
    returning 1
  )
  select count(*)::integer into v_count from ins;

  return v_count;
end;
$$;

revoke all on function public.unlock_history_for_subscriber(uuid) from public;
grant execute on function public.unlock_history_for_subscriber(uuid) to service_role;

-- 一次性 backfill — 既有的 active 訂閱戶 + 他們所有 divinations 全標解鎖。
-- 為什麼:phase 34 上線當下訂閱戶若沒這步,會「以前看過的紀錄突然鎖回來」,觀感差。
-- 這個 statement 可重複執行(冪等)。
insert into public.history_unlocks (user_id, divination_id)
select d.user_id, d.id
  from public.divinations d
  join public.user_subscription_summary s on s.user_id = d.user_id
 where s.is_active = true
on conflict (user_id, divination_id) do nothing;

-- 驗證:
--   select count(*) from public.daily_checkins;
--   select count(*) from public.history_unlocks;
--   select * from public.get_daily_checkin_status('<user-id>'::uuid);
