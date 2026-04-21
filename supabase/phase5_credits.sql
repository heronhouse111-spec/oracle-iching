-- ============================================
-- Oracle I Ching - Phase 5: Credits / Points System
-- ============================================
-- 執行時機:Supabase SQL Editor
-- 前置條件:schema.sql + phase1_subscription.sql 已跑過
-- 此腳本可重複執行(全部 if not exists / create or replace)

-- ============================================
-- 1. profiles 加點數相關欄位
-- ============================================
-- credits_balance: 總點數餘額(訂閱 + 加購 + 獎勵合併計算)
-- credits_refills_at: 下一次自動補點的時間(訂閱月結)
-- 設計上我們只維護 total balance,扣款優先序由 spend_credits() 內部判斷
alter table public.profiles
  add column if not exists credits_balance integer not null default 0,
  add column if not exists credits_refills_at timestamptz;

comment on column public.profiles.credits_balance is
  '目前可用點數餘額(訂閱月配額 + 加購點 + 廣告獎勵合計)。扣款時 atomic 更新。';
comment on column public.profiles.credits_refills_at is
  '下次補點時間。訂閱戶是下期月結日;免費戶是當月結束日。';

-- ============================================
-- 2. credit_transactions 表:所有加點/扣點流水
--    - 客訴查帳必備
--    - 之後做 analytics / 發票稅務也會查這張
-- ============================================
create table if not exists public.credit_transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,                                    -- 正數加,負數扣
  balance_after integer not null,                            -- 記錄當下結餘(稽核)
  reason text not null,                                       -- 'onboarding_bonus' / 'subscription_refill' / 'purchase_pack_200' / 'spend_divine' / 'spend_chat' / 'spend_followup' / 'ad_reward' / 'refund_api_error' ...
  reference_id uuid,                                          -- 關聯 divination.id / subscriptions.id 等
  metadata jsonb,                                             -- 選用:金流訂單號、錯誤訊息等
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_tx_user on public.credit_transactions(user_id);
create index if not exists idx_credit_tx_created on public.credit_transactions(created_at desc);
create index if not exists idx_credit_tx_reason on public.credit_transactions(reason);

-- RLS:使用者只能讀自己的,寫入一律走 service_role(後端 API)
alter table public.credit_transactions enable row level security;

drop policy if exists "Users can view own credit transactions" on public.credit_transactions;
create policy "Users can view own credit transactions"
  on public.credit_transactions for select
  using (auth.uid() = user_id);

-- 故意不開 INSERT/UPDATE/DELETE policy —— 只有 service_role 寫得進去

-- ============================================
-- 3. spend_credits() — 原子扣款
--    一次完成:檢查餘額 >= amount → 扣 → 記流水 → 回傳 new balance
--    如果餘額不夠,raise exception(API route 會 catch 回 402)
-- ============================================
create or replace function public.spend_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_id uuid default null,
  p_metadata jsonb default null
)
returns integer                                     -- 回傳扣完後的餘額
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'spend_credits: amount must be positive, got %', p_amount;
  end if;

  -- 關鍵:single UPDATE with WHERE balance >= amount
  -- Postgres 保證單一 row UPDATE 的原子性,不會有兩個 request 同時扣穿
  update public.profiles
     set credits_balance = credits_balance - p_amount
   where id = p_user_id
     and credits_balance >= p_amount
  returning credits_balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  insert into public.credit_transactions
    (user_id, delta, balance_after, reason, reference_id, metadata)
  values
    (p_user_id, -p_amount, v_new_balance, p_reason, p_reference_id, p_metadata);

  return v_new_balance;
end;
$$;

comment on function public.spend_credits(uuid, integer, text, uuid, jsonb) is
  '原子扣點。餘額不足 raise INSUFFICIENT_CREDITS。成功回傳新餘額。';

-- ============================================
-- 4. add_credits() — 加點(訂閱補點、加購、獎勵、退款)
-- ============================================
create or replace function public.add_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_reference_id uuid default null,
  p_metadata jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'add_credits: amount must be positive, got %', p_amount;
  end if;

  update public.profiles
     set credits_balance = credits_balance + p_amount
   where id = p_user_id
  returning credits_balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'add_credits: profile not found for user %', p_user_id;
  end if;

  insert into public.credit_transactions
    (user_id, delta, balance_after, reason, reference_id, metadata)
  values
    (p_user_id, p_amount, v_new_balance, p_reason, p_reference_id, p_metadata);

  return v_new_balance;
end;
$$;

comment on function public.add_credits(uuid, integer, text, uuid, jsonb) is
  '加點。回傳新餘額。用於訂閱月結、加購、獎勵、退款。';

-- ============================================
-- 5. refund_credits() — 退點(DeepSeek 呼叫失敗時用)
--    跟 add_credits 邏輯一樣,只是 reason 固定帶 refund_ prefix
--    分開寫是為了流水表查詢方便
-- ============================================
create or replace function public.refund_credits(
  p_user_id uuid,
  p_amount integer,
  p_reference_id uuid default null,
  p_error_message text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.add_credits(
    p_user_id,
    p_amount,
    'refund_api_error',
    p_reference_id,
    jsonb_build_object('error', coalesce(p_error_message, 'unknown'))
  );
end;
$$;

-- ============================================
-- 6. Backfill:既有使用者送 500 點 onboarding bonus
--    - 每個 profile 只送一次(用 NOT EXISTS 避免重複執行)
--    - 用純 SQL CTE,不用 DO block(避開 Supabase SQL Editor 對 PL/pgSQL 變數的解析問題)
--    - 新註冊的使用者不會受此 backfill 影響(handle_new_user 另外處理)
-- ============================================
with eligible as (
  select p.id
    from public.profiles p
   where not exists (
     select 1 from public.credit_transactions ct
      where ct.user_id = p.id
        and ct.reason = 'onboarding_bonus'
   )
),
updated as (
  update public.profiles p
     set credits_balance = p.credits_balance + 500
    from eligible e
   where p.id = e.id
  returning p.id, p.credits_balance
)
insert into public.credit_transactions
  (user_id, delta, balance_after, reason, metadata)
select
  u.id,
  500,
  u.credits_balance,
  'onboarding_bonus',
  jsonb_build_object('note', 'Phase 5 launch: existing user gift')
from updated u;

-- ============================================
-- 7. 新註冊使用者自動送 30 點免費配額
--    (改寫 handle_new_user() 讓新 profile 一開始就有起跳點數)
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  insert into public.profiles (id, display_name, credits_balance, credits_refills_at)
  values (
    new.id,
    new.raw_user_meta_data->>'display_name',
    30,                                   -- 新免費戶直接給 30 點
    v_now + interval '30 days'
  );

  -- 記一筆流水
  insert into public.credit_transactions (user_id, delta, balance_after, reason, metadata)
  values (new.id, 30, 30, 'signup_bonus', jsonb_build_object('note', 'welcome to oracle'));

  return new;
end;
$$;

-- ============================================
-- 完成
-- ============================================
-- 跑完驗證:
--
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema='public' and table_name='profiles'
--      and column_name like 'credits%'
--    order by ordinal_position;
--   → 應看到 credits_balance, credits_refills_at
--
--   select count(*) from public.credit_transactions where reason = 'onboarding_bonus';
--   → 應該等於目前 profiles 的 row 數
--
--   select id, display_name, credits_balance from public.profiles;
--   → 既有使用者的 credits_balance 應為 500
