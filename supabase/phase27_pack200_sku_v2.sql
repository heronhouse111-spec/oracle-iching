-- Phase 27: pack_200 的 Play Store SKU 換成 v2(2026-05)
--
-- 為什麼:
--   Play Console 操作時誤刪了 orc.credits.pack200 產品。Google 政策對
--   已刪除的 Product ID 是「永久保留、不能再建」(同 app 同開發者也擋,
--   客服救不回)。所以新 SKU 名為 orc.credits.pack200v2。
--
-- 影響範圍:
--   - lib/billing/playSkus.ts                ✅ 已改 CREDIT_PACK_SKUS + SKU_CREDITS_GRANTED
--   - phase8_admin_cms.sql 的 seed INSERT     ✅ 已改(只影響新環境)
--   - 線上 DB credit_packs.play_sku_id        ⬇️ 跑下面 update
--   - Google Play Console                    ⬇️ 開發者手動建 orc.credits.pack200v2 產品
--
-- 補點數字、TWD/USD 定價、firstTimeOnly、内部 pack_id 都不變,
-- 只有 Play 端對外字串換版。
--
-- 為什麼不直接刪掉舊的 row 重建:
--   credit_packs.id = 'pack_200' 是 stable 的內部 ID,前後端都引用、
--   credit_transactions / play_purchases 可能有 metadata 帶舊 pack_id,
--   不能動。只動 play_sku_id 這欄。

update public.credit_packs
set play_sku_id = 'orc.credits.pack200v2',
    updated_at = now()
where id = 'pack_200';
