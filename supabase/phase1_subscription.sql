-- ============================================
-- Oracle I Ching - Phase 1: Subscription & Multi-Divination Schema
-- ============================================
-- 執行時機:Supabase SQL Editor
-- 前置條件:schema.sql 已經跑過
-- 此腳本可重複執行(使用 if not exists / if exists)

-- ============================================
-- 1. profiles 加上訂閱相關欄位
-- ============================================
alter table public.profiles
  add column if not exists subscription_status text not null default 'free'
    check (subscription_status in ('free', 'active', 'canceled', 'expired')),
  add column if not exists subscription_plan text
    check (subscription_plan in ('monthly', 'yearly', 'lifetime') or subscription_plan is null),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_expires_at timestamptz;

comment on column public.profiles.subscription_status is
  '訂閱狀態:free=免費用戶,active=訂閱中,canceled=已取消但仍在有效期,expired=已過期';
comment on column public.profiles.subscription_expires_at is
  '訂閱到期時間。即使 status=canceled,在到期前仍視為有效訂閱';

-- ============================================
-- 2. subscriptions 表:完整訂閱 / 金流事件紀錄
--    (profiles.subscription_* 是當前狀態快照,這張表是完整歷史)
-- ============================================
create table if not exists public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly', 'lifetime')),
  status text not null check (status in ('pending', 'active', 'canceled', 'expired', 'refunded', 'failed')),
  provider text not null check (provider in ('linepay', 'ecpay', 'newebpay', 'manual')),
  provider_txn_id text,              -- 金流平台的交易編號
  provider_subscription_id text,     -- 金流平台的訂閱 ID(定期扣款用)
  amount integer not null,           -- 金額(TWD,整數)
  currency text not null default 'TWD',
  started_at timestamptz,
  expires_at timestamptz,
  canceled_at timestamptz,
  raw_payload jsonb,                 -- 金流 webhook 原始資料(debug / 稽核用)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_subscriptions_provider_txn on public.subscriptions(provider, provider_txn_id);

-- RLS:使用者只能「讀」自己的訂閱紀錄
-- 寫入/更新一律由後端 API(service_role)處理,前端不能直接寫
alter table public.subscriptions enable row level security;

drop policy if exists "Users can view own subscriptions" on public.subscriptions;
create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- updated_at 觸發器
drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.update_updated_at();

-- ============================================
-- 3. divinations 加上占卜類型(易經 / 塔羅 / 未來擴充)
-- ============================================
alter table public.divinations
  add column if not exists divination_type text not null default 'iching'
    check (divination_type in ('iching', 'tarot'));

create index if not exists idx_divinations_type on public.divinations(divination_type);

comment on column public.divinations.divination_type is
  '占卜類型:iching=易經,tarot=塔羅(未來)';

-- ============================================
-- 4. Helper function:檢查使用者目前是否有有效訂閱
--    (前端 / API 都可以呼叫)
-- ============================================
create or replace function public.has_active_subscription(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id
      and subscription_status in ('active', 'canceled')
      and (subscription_expires_at is null or subscription_expires_at > now())
  );
$$;

comment on function public.has_active_subscription(uuid) is
  '回傳使用者是否為有效訂閱者。canceled 但未到期也算有效。';

-- ============================================
-- 5. 便利 view:當前訂閱摘要(給後台 / 會員頁用)
-- ============================================
create or replace view public.user_subscription_summary as
select
  p.id as user_id,
  p.display_name,
  p.subscription_status,
  p.subscription_plan,
  p.subscription_started_at,
  p.subscription_expires_at,
  case
    when p.subscription_status in ('active', 'canceled')
         and (p.subscription_expires_at is null or p.subscription_expires_at > now())
      then true
    else false
  end as is_active,
  case
    when p.subscription_expires_at is not null
      then greatest(0, extract(day from (p.subscription_expires_at - now()))::integer)
    else null
  end as days_remaining
from public.profiles p;

-- view 的 RLS 跟隨 profiles 表(使用者只看得到自己的 row)

-- ============================================
-- 完成
-- ============================================
-- 執行完後驗證:
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='profiles'
--    order by ordinal_position;
-- 應該看到多了 subscription_status / subscription_plan / subscription_started_at / subscription_expires_at
