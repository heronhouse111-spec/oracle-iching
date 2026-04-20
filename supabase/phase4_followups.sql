-- ============================================
-- Phase 4 — 衍伸問題繼續占卜 (follow-up divinations)
-- ============================================
-- 結果頁上「相關衍伸問題繼續占卜」按鈕:
--   使用者針對同一筆占卜,問更深入的延伸問題,再做一次易經/塔羅,
--   AI 知道「上一輪卦象 + 聊天紀錄 + 新卦象」後做 ~300 字連貫解說。
--
-- 儲存方式:不另開 table,直接掛在原始 divinations 那一 row 的
--   follow_ups jsonb 欄位,結構為陣列:
--   [
--     {
--       "id": "<uuid>",
--       "question": "那轉職後薪水會變好嗎?",
--       "createdAt": "2026-04-20T03:21:00Z",
--       "divineType": "iching" | "tarot",
--       "aiReading": "...300 字延伸解說...",
--       // iching
--       "hexagramNumber": 11,
--       "primaryLines": [...],
--       "changingLines": [...],
--       "relatingHexagramNumber": 12,
--       // tarot
--       "tarotCards": [{ cardId, position, isReversed }, ...]
--     },
--     ...
--   ]
--
-- 為什麼用 jsonb 而不是另一張 table:
--   - 這些延伸佔卜只跟本卦一起讀;沒有分享/搜尋/統計需求
--   - 一起讀一次 query 拿回整條對話,比 join 省事
--   - RLS 天然繼承本卦的 policy(user_id 判定)—— 不用再寫新 policy
--
-- Safe to run multiple times (if not exists).
-- ============================================

alter table public.divinations
  add column if not exists follow_ups jsonb not null default '[]'::jsonb;

comment on column public.divinations.follow_ups is
  'Chain of follow-up divinations attached to this root reading. Array of {id, question, createdAt, divineType, aiReading, hexagramNumber?, primaryLines?, changingLines?, relatingHexagramNumber?, tarotCards?}. RLS inherits from parent row.';
