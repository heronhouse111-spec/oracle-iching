-- Phase 26: pack_100_starter — 限首購一次性新手包(2026-05)
--
-- 設計:
--   價格 NT$60 / $1.99 — Tier 2 衝動購買價位
--   100 點 + 30 bonus = 130 點(每點 NT$0.46,介於 pack_200 與 pack_500 之間)
--   只有「從未購買過任何點數包/訂閱」的帳號可買
--   買完之後 UI 自動隱藏這張卡;後端 checkout 也會 reject
--
-- 配套:
--   - lib/pricing.ts CREDIT_PACKS              ✅ 已加
--   - app/api/account/has-purchased            ✅ 新建
--   - app/api/billing/ecpay/checkout           ✅ 加首購驗證
--   - app/account/credits/page.tsx             ✅ UI 隱藏不適格的 pack
--
-- ⚠️ Play Store SKU 'orc.credits.pack100_starter' 要在 Play Console 手動建立
--    才能讓 TWA 用戶買。在那之前,UI 會在 TWA 環境隱藏這張卡(play_sku_id 為 null)。

-- 1. 加 first_time_only 欄位
alter table public.credit_packs
  add column if not exists first_time_only boolean not null default false;

-- 2. 預埋 pack_100_starter
insert into public.credit_packs
  (id, credits, bonus_credits, price_twd, price_usd, highlighted, active, display_order,
   zh_label, en_label, play_sku_id, first_time_only)
values
  ('pack_100_starter', 100, 30, 60, 1.99, false, true, 5,
   '新手體驗包 100 點 + 贈 30', 'Starter Pack 100 + 30 bonus',
   null,  -- ⚠️ Play SKU 待建立。null 時 UI 在 TWA 環境會隱藏
   true)
on conflict (id) do update set
  credits = excluded.credits,
  bonus_credits = excluded.bonus_credits,
  price_twd = excluded.price_twd,
  price_usd = excluded.price_usd,
  zh_label = excluded.zh_label,
  en_label = excluded.en_label,
  first_time_only = excluded.first_time_only;
