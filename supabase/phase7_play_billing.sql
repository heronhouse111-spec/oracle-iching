-- ============================================
-- Phase 7: Google Play Billing 整合
-- ============================================
-- 設計重點:
--   1. play_purchases 是 Play Billing 購買的「真理表」(audit trail + idempotency)
--   2. 同一張 purchase_token 不論 webhook / 客戶端打幾次,只會結算一次
--      (purchase_token unique + status='granted' 才算完成)
--   3. 訂閱續期、取消、退款都會回頭更新這張表的對應 row
--   4. consumable(點數包)買完要 consume,後端記下 consumed_at
--
-- 跟既有資料的關係:
--   - 點數補進 profiles.credits_balance(透過既有的 add_credits() RPC)
--   - 訂閱資訊更新 profiles.subscription_*(直接 update)
--   - 訂閱事件歷程仍寫 phase1 的 subscriptions 表(用 provider='google_play')
--
-- 執行時機:Supabase SQL Editor,跑完 phase1+phase5 之後
-- 可重複執行(if not exists)
-- ============================================

-- 先讓 subscriptions.provider 接受 google_play
do $$
begin
  -- 看舊 check constraint 是否限制 provider 在 ('linepay','ecpay','newebpay','manual')
  -- 有的話 drop 掉重新建一個包含 google_play 的
  alter table public.subscriptions
    drop constraint if exists subscriptions_provider_check;

  alter table public.subscriptions
    add constraint subscriptions_provider_check
    check (provider in ('linepay', 'ecpay', 'newebpay', 'manual', 'google_play'));
exception
  when others then
    -- 容忍 constraint 不存在或已經是新格式的情況
    null;
end $$;

-- ============================================
-- 1. play_purchases 表
-- ============================================
create table if not exists public.play_purchases (
  id                    uuid primary key default uuid_generate_v4(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  user_id               uuid not null references auth.users(id) on delete cascade,

  -- Play Billing 識別
  sku                   text not null,                -- 'orc.credits.pack200' 等
  purchase_token        text not null unique,         -- Google Play 給的唯一 token
  order_id              text,                          -- 'GPA.xxxx-xxxx-xxxx-xxxxx',Google 那邊的訂單號

  -- 類型(consumable = 點數包,subscription = 訂閱)
  product_type          text not null check (product_type in ('consumable', 'subscription')),

  -- 處理狀態
  status                text not null default 'pending'
    check (status in ('pending', 'granted', 'failed', 'refunded', 'revoked')),
  status_reason         text,                          -- 失敗原因 / 退款理由

  -- 記下實際補了幾點(consumable 才有意義,訂閱補點走另一條路)
  credits_granted       integer,

  -- 訂閱方案(只在 product_type='subscription' 時填)
  subscription_plan     text check (subscription_plan in ('monthly', 'yearly')),
  subscription_expires_at timestamptz,

  -- 跟 Play Developer API 拿回來的完整資料(debug + 將來追溯用)
  raw_purchase          jsonb,

  -- 何時 acknowledge / consume(避免重複處理)
  acknowledged_at       timestamptz,
  consumed_at           timestamptz
);

create index if not exists idx_play_purchases_user_id
  on public.play_purchases(user_id, created_at desc);

create index if not exists idx_play_purchases_sku
  on public.play_purchases(sku, created_at desc);

create index if not exists idx_play_purchases_status
  on public.play_purchases(status)
  where status in ('pending', 'failed');

-- updated_at 觸發器(沿用既有的 update_updated_at function)
drop trigger if exists play_purchases_updated_at on public.play_purchases;
create trigger play_purchases_updated_at
  before update on public.play_purchases
  for each row execute procedure public.update_updated_at();

-- RLS:使用者可讀自己的、寫一律走 service_role(後端 verify route)
alter table public.play_purchases enable row level security;

drop policy if exists "Users can view own play purchases" on public.play_purchases;
create policy "Users can view own play purchases"
  on public.play_purchases for select
  using (auth.uid() = user_id);

-- 沒有 insert / update / delete 的 anon/authenticated policy
-- → 等於只有 service_role(SUPABASE_SERVICE_ROLE_KEY)能寫,前端動不了

comment on table public.play_purchases is
  'Google Play Billing 購買記錄。purchase_token unique 確保 idempotency。';
comment on column public.play_purchases.purchase_token is
  'Google Play 給的購買 token。webhook / client 重送時用這個去重。';
comment on column public.play_purchases.product_type is
  'consumable=點數包(買完 consume),subscription=訂閱(自動續扣)';
comment on column public.play_purchases.status is
  'pending=待驗證,granted=已補點/啟用,failed=驗證失敗,refunded=Google 通知退款,revoked=訂閱撤銷';

-- ============================================
-- 2. 完成
-- ============================================
-- 驗證:
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='play_purchases'
--    order by ordinal_position;
