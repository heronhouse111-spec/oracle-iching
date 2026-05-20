-- ============================================
-- Phase 38: expose subscription_provider in user_subscription_summary
-- ============================================
-- 為什麼:
--   /account 頁的「取消訂閱」按鈕原本只打 /api/billing/ecpay/cancel-subscription,
--   對透過 Google Play Billing 訂閱的人會回 404(provider='google_play' 不在 ecpay 查詢條件內)。
--   Google Play 政策:Play 訂閱應該透過 Play Store 取消(deep link 到
--   https://play.google.com/store/account/subscriptions)。
--
--   要分流前端 UI,view 必須暴露當前訂閱的 provider。
--
-- 設計:
--   - 從 subscriptions 表撈最新一筆 active(或 fallback 任意最新)的 provider
--   - 沒任何訂閱紀錄 → null(免費會員 / 沒訂閱過的人)
--   - 既有欄位不動,只多一欄 subscription_provider
--
-- 可重複執行(create or replace view)
-- ============================================

create or replace view public.user_subscription_summary as
select
  p.id as user_id,
  p.display_name,
  p.subscription_status,
  p.subscription_plan,
  p.subscription_started_at,
  p.subscription_expires_at,
  (
    -- 優先取 active 那筆;沒有再退而求其次取最新一筆
    select s.provider
    from public.subscriptions s
    where s.user_id = p.id
    order by
      case when s.status = 'active' then 0 else 1 end,
      s.started_at desc nulls last
    limit 1
  ) as subscription_provider,
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

comment on view public.user_subscription_summary is
  '使用者訂閱摘要(來自 profiles.subscription_*)+ subscriptions 表撈出的 provider,給前端分流取消流程用';

-- 驗證:
--   select user_id, subscription_status, subscription_plan, subscription_provider, is_active
--     from public.user_subscription_summary
--    where subscription_status in ('active','canceled')
--    limit 10;
