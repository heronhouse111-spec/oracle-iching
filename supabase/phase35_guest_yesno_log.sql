-- Phase 35.7: 訪客 Yes/No DB 限流(取代 cookie 方案)
--
-- 問題:phase 35.6 用 HttpOnly cookie + Set-Cookie response 寫不進瀏覽器
-- (Vercel streaming response + supabase auth middleware 的組合會吃 Set-Cookie)。
--
-- 解法:server 端用 IP + User-Agent 雜湊當 fingerprint,記在 DB。
-- 不再依賴瀏覽器 cookie 寫回。
--
-- Trade-off:共用 IP 的多人(咖啡廳、家用 NAT)會互相鎖。為了基本可用性,
-- 我們把 fingerprint 設成 ip+ua,UA 不同就算不同訪客 — 多數情況下家裡不同
-- 裝置的 UA 不同,夠分得開。
--
-- 套用方式:整段貼進 Supabase Dashboard SQL Editor 執行。

create table if not exists public.guest_yesno_log (
  fingerprint text not null,
  used_date   date not null,
  used_at     timestamptz not null default now(),
  primary key (fingerprint, used_date)
);

comment on table public.guest_yesno_log is
  '訪客 Yes/No 占卜限流 — fingerprint = sha256(ip + ua),累計 10 天。phase 35.7。';

create index if not exists guest_yesno_log_fp_idx
  on public.guest_yesno_log (fingerprint);

-- 不開 RLS — service_role only(不該讓使用者直接讀寫)
alter table public.guest_yesno_log enable row level security;

-- ──────────────────────────────────────────
-- 嘗試消耗一次配額(原子操作 — 同 fp 並發兩請求只會一個成功)
--
-- 回傳 row:
--   allowed=true  reason=ok            → 允許,本次已記錄,daysRemaining=新剩餘
--   allowed=false reason=used_today     → 今日已用,daysRemaining=還剩幾天免費
--   allowed=false reason=limit_reached  → 累計 10 天已用完,daysRemaining=0
-- ──────────────────────────────────────────
create or replace function public.try_consume_guest_yesno(p_fingerprint text)
returns table (allowed boolean, reason text, days_remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today      date := (timezone('Asia/Taipei', now()))::date;
  v_total      integer;
  v_used_today boolean;
  v_limit      integer := 10;
begin
  if p_fingerprint is null or length(p_fingerprint) < 8 then
    -- fingerprint 異常 → fail-open(允許)避免擋死所有人,但記 log 給 ops 查
    raise warning 'try_consume_guest_yesno: invalid fingerprint';
    return query select true, 'ok', v_limit;
    return;
  end if;

  select count(*)::integer,
         bool_or(used_date = v_today)
    into v_total, v_used_today
    from public.guest_yesno_log
   where fingerprint = p_fingerprint;

  v_total      := coalesce(v_total, 0);
  v_used_today := coalesce(v_used_today, false);

  if v_used_today then
    return query select false, 'used_today', greatest(0, v_limit - v_total);
    return;
  end if;

  if v_total >= v_limit then
    return query select false, 'limit_reached', 0;
    return;
  end if;

  -- 寫入(原子)— 衝突時(同時兩請求)其中一個被 nothing 掉,我們仍回 allowed=true
  -- 因為這代表「今日為他第一次允許」,只是並發時兩個都認為是第一次。
  -- 副作用:極短 race 視窗內可能多放行 1 次,可接受。
  insert into public.guest_yesno_log (fingerprint, used_date)
       values (p_fingerprint, v_today)
  on conflict (fingerprint, used_date) do nothing;

  return query select true, 'ok', greatest(0, v_limit - v_total - 1);
end;
$$;

revoke all on function public.try_consume_guest_yesno(text) from public;
grant execute on function public.try_consume_guest_yesno(text) to service_role;

-- ──────────────────────────────────────────
-- 純查詢 — banner 顯示用,不消耗配額
-- ──────────────────────────────────────────
create or replace function public.get_guest_yesno_status(p_fingerprint text)
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
  v_limit      integer := 10;
begin
  if p_fingerprint is null or length(p_fingerprint) < 8 then
    return query select true, 'ok', v_limit, false;
    return;
  end if;

  select count(*)::integer,
         bool_or(used_date = v_today)
    into v_total, v_used_today
    from public.guest_yesno_log
   where fingerprint = p_fingerprint;

  v_total      := coalesce(v_total, 0);
  v_used_today := coalesce(v_used_today, false);

  if v_used_today then
    return query select false, 'used_today', greatest(0, v_limit - v_total), true;
  elsif v_total >= v_limit then
    return query select false, 'limit_reached', 0, false;
  else
    return query select true, 'ok', v_limit - v_total, false;
  end if;
end;
$$;

revoke all on function public.get_guest_yesno_status(text) from public;
grant execute on function public.get_guest_yesno_status(text) to service_role;

-- 驗證:
--   select public.try_consume_guest_yesno('test-fingerprint');
--   select public.get_guest_yesno_status('test-fingerprint');
--   select * from public.guest_yesno_log limit 10;
