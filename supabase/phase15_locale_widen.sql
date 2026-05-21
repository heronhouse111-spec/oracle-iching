-- Phase 15: 把 locale CHECK 從 ('zh', 'en') 擴成 ('zh', 'en', 'ja', 'ko')
--
-- 為什麼:
--   既有限制只允許 zh / en,使用者切到日文或韓文後做的占卜在 INSERT 時被
--   PostgreSQL CHECK 擋掉,於是日韓使用者看不到自己的占卜紀錄。
--
-- 為什麼不加 'zh-CN':
--   zh-CN 是顯示變體 — client 仍以 locale='zh' 入庫,zhVariant='CN' 走前端
--   OpenCC 即時轉繁→簡。不需要 DB 多存一個 row 標記。
--
-- 影響範圍:
--   - profiles.preferred_locale (使用者偏好,設定頁面才寫;改了立即生效)
--   - divinations.locale (歷史紀錄,新存的 ja/ko 占卜會通過 CHECK)
--
-- 沒有資料遷移需要做 — 既有 row 都還是 'zh' / 'en',不必動。

alter table public.profiles
  drop constraint if exists profiles_preferred_locale_check;

alter table public.profiles
  add constraint profiles_preferred_locale_check
  check (preferred_locale in ('zh', 'en', 'ja', 'ko'));

alter table public.divinations
  drop constraint if exists divinations_locale_check;

alter table public.divinations
  add constraint divinations_locale_check
  check (locale in ('zh', 'en', 'ja', 'ko'));
