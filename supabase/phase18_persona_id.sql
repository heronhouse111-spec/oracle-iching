-- Phase 18: divinations.persona_id
--
-- 占卜時用了哪位 AI 占卜師(persona)— 之前沒記下來,所以分享頁/分享圖
-- 都只能顯示通用「老師解盤」。加這欄之後可以顯示「周文王解盤」「孔子解盤」等。
--
-- 對應程式:
--   - lib/personas.ts        (persona id 字典)
--   - lib/saveDivination.ts  (寫入)
--   - app/r/[id]/page.tsx    (分享頁讀取)
--   - components/ShareCard.tsx (分享圖讀取)
--
-- nullable + 無 default — 舊資料保持 NULL,讀取端 fallback 為「老師」。
-- 不加 FK / CHECK,因為 persona id 字典是程式碼裡的 const,DB 不該硬綁。

alter table public.divinations
  add column if not exists persona_id text;

comment on column public.divinations.persona_id is
  'AI persona id used at divination time (see lib/personas.ts). NULL for records created before phase 18 — UI falls back to "老師".';
