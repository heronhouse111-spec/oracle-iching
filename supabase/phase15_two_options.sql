-- ============================================
-- Phase 15 — Two-Options Spread A / B 選項
-- ============================================
-- 二選一牌陣抽牌前,使用者會填寫兩個具體選項(例:「留在現職」vs「接受新公司 offer」)。
-- 這兩個字串需要持久化,讓 /r/[id] 公開分享頁與 /history 重讀時,
-- 結果頁上方那個 A / B 區塊還能顯示出來。
--
-- 新增:
--   two_option_a text — 二選一牌陣的選項 A;其他牌陣 / 易經為 null
--   two_option_b text — 二選一牌陣的選項 B;其他牌陣 / 易經為 null
--
-- 不強制 NOT NULL(舊紀錄沒填、其他牌陣也用不到)。
-- 200 字長度限制跟前端 input maxLength 對齊,擋掉異常巨大的字串。
--
-- Safe to run multiple times.
-- ============================================

alter table public.divinations
  add column if not exists two_option_a text,
  add column if not exists two_option_b text;

alter table public.divinations
  drop constraint if exists divinations_two_options_length_check;

alter table public.divinations
  add constraint divinations_two_options_length_check check (
    (two_option_a is null or char_length(two_option_a) <= 200)
    and (two_option_b is null or char_length(two_option_b) <= 200)
  );

-- 備註:
-- * RLS 不需動 — 跟 tarot_spread_id 同樣是透明欄位。
-- * saveDivination.ts 會在 spreadId === 'two-options' 時把這兩欄塞值;其他狀況維持 null。
-- * 舊資料(Phase 14 之前的二選一占卜)沒有原始 A / B,留 null,前端要 fallback 不顯示 A/B 區塊。
