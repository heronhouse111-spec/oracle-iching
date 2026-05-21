-- Phase 24: 點數加購包定價 ×2(2026-05)
--
-- 為什麼漲價:
--   原本 pack_1200 每點 NT$0.171,比月訂閱 NT$0.250/點 還便宜,
--   訂閱方案的點數性價比反而輸給加購包,訂閱沒有理性消費動機。
--   這次漲價後 pack_1200 每點 NT$0.343,訂閱明顯划算,把訂閱定位拉回正常區間。
--
-- 同步要動的:
--   - lib/pricing.ts CREDIT_PACKS                  ✅ 已改
--   - supabase/phase8_admin_cms.sql 的 seed         ✅ 已改(只影響新環境)
--   - 線上 DB credit_packs (本檔)                   ⬇️ 跑下面 update
--   - 綠界商品(若有預先建立) → 後台手動改金額(API 接的就 deploy 後自動)
--   - Google Play Console SKU prices                ⬇️ 必須手動到 Play Console 改
--
-- ⚠️ Play Store SKU 漲價不能透過 SQL — 開發者要登入 Play Console
--    為 orc.credits.pack200 / pack500 / pack1200 各別設定新區域定價。
--    Play 漲價後 IAP 客戶會被通知,有反悔期(部分國家)。

update public.credit_packs
set price_twd = 120, price_usd = 3.99
where id = 'pack_200';

update public.credit_packs
set price_twd = 240, price_usd = 7.99
where id = 'pack_500';

update public.credit_packs
set price_twd = 480, price_usd = 15.99
where id = 'pack_1200';
