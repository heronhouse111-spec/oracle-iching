-- Phase 36: 訪客每日一卦 / 每日一卡 累計 3 天免費期
--
-- 跟 phase 35 訪客 yes/no 同一套 fingerprint 模式,但:
--   - 上限 3 天而不是 10 天
--   - 加 kind 欄位區分 iching / tarot,兩種 daily 各自獨立計算
--
-- 這樣訪客可以總共用「3 次易經每日一卦 + 3 次塔羅每日一卡」,給足夠體驗
-- 但用完就要登入,每次都會看到「登入贈 30 點」鉤子。
--
-- 套用方式:整段貼進 Supabase Dashboard SQL Editor 執行。

create table if not exists public.guest_daily_log (
  fingerprint text not null,
  kind        text not null check (kind in ('iching', 'tarot')),
  used_date   date not null,
  used_at     timestamptz not null default now(),
  primary key (fingerprint, kind, used_date)
);

comment on table public.guest_daily_log is
  '訪客每日一卦 / 每日一卡限流 — fingerprint = sha256(ip + ua),累計 3 天/種。phase 36。';

create index if not exists guest_daily_log_fp_kind_idx
  on public.guest_daily_log (fingerprint, kind);

alter table public.guest_daily_log enable row level security;

-- 嘗試消耗一次配額。同 yesno 的原子 check+insert 模式,只是 limit=3 + 多 kind 維度。
create or replace function public.try_consume_guest_daily(
  p_fingerprint text,
  p_kind        text
)
returns table (allowed boolean, reason text, days_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today      date := (timezone('Asia/Taipei', now()))::date;
  v_total      integer;
  v_used_today boolean;
  v_limit      integer := 3;
begin
  if p_fingerprint is null or length(p_fingerprint) < 8 then
    raise warning 'try_consume_guest_daily: invalid fingerprint';
    return query select true, 'ok', v_limit;
    return;
  end if;

  if p_kind not in ('iching', 'tarot') then
    raise warning 'try_consume_guest_daily: invalid kind %', p_kind;
    return query select true, 'ok', v_limit;
    return;
  end if;

  select count(*)::integer,
         bool_or(used_date = v_today)
    into v_total, v_used_today
    from public.guest_daily_log
   where fingerprint = p_fingerprint
     and kind        = p_kind;

  v_total      := coalesce(v_total, 0);
  v_used_today := coalesce(v_used_today, false);

  -- 同日重抽 → allowed=true 但 daysRemaining 不變(deterministic 同一張卦/卡)
  -- 為什麼不擋:每日一卦的 UX 就是「同一天看到同一張」,擋住反而怪
  -- 但累計仍只算 1 天(因為 used_date 已存在,on conflict do nothing)
  if v_used_today then
    return query select true, 'ok', greatest(0, v_limit - v_total);
    return;
  end if;

  if v_total >= v_limit then
    return query select false, 'limit_reached', 0;
    return;
  end if;

  insert into public.guest_daily_log (fingerprint, kind, used_date)
       values (p_fingerprint, p_kind, v_today)
  on conflict (fingerprint, kind, used_date) do nothing;

  return query select true, 'ok', greatest(0, v_limit - v_total - 1);
end;
$$;

revoke all on function public.try_consume_guest_daily(text, text) from public;
grant execute on function public.try_consume_guest_daily(text, text) to service_role;

-- 純查詢 — 給 banner 顯示用,不消耗
create or replace function public.get_guest_daily_status(
  p_fingerprint text,
  p_kind        text
)
returns table (
  allowed       boolean,
  reason        text,
  days_remaining integer,
  used_today    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today      date := (timezone('Asia/Taipei', now()))::date;
  v_total      integer;
  v_used_today boolean;
  v_limit      integer := 3;
begin
  if p_fingerprint is null or length(p_fingerprint) < 8 then
    return query select true, 'ok', v_limit, false;
    return;
  end if;

  if p_kind not in ('iching', 'tarot') then
    return query select true, 'ok', v_limit, false;
    return;
  end if;

  select count(*)::integer,
         bool_or(used_date = v_today)
    into v_total, v_used_today
    from public.guest_daily_log
   where fingerprint = p_fingerprint
     and kind        = p_kind;

  v_total      := coalesce(v_total, 0);
  v_used_today := coalesce(v_used_today, false);

  -- 訪客版「今日已用」不算 reason='used_today'(因為仍允許同日重看),
  -- 只回 daysRemaining 與 used_today 旗標,讓前端 banner 自己決定文案
  if v_total >= v_limit and not v_used_today then
    return query select false, 'limit_reached', 0, false;
  else
    return query select true, 'ok', greatest(0, v_limit - v_total), v_used_today;
  end if;
end;
$$;

revoke all on function public.get_guest_daily_status(text, text) from public;
grant execute on function public.get_guest_daily_status(text, text) to service_role;
