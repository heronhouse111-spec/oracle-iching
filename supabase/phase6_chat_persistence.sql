-- ============================================
-- Phase 6 — 聊天紀錄持久化 (chat_messages)
-- ============================================
-- 之前跟「老師」的對話只活在前端 state,跳頁就消失。
-- 訂閱會員要能從 /history 點回任一筆占卜繼續對話 →
-- 對話內容必須跟 follow_ups 一樣掛在 divinations.chat_messages 上。
--
-- 儲存結構:陣列,時間順序(最新的在尾端)
--   [
--     { "role": "user",      "content": "那我該辭職嗎?", "createdAt": "2026-04-20T03:21:00Z" },
--     { "role": "assistant", "content": "依本卦來看……", "createdAt": "2026-04-20T03:21:04Z" }
--   ]
--
-- 為什麼用 jsonb 而不是另開 chat_messages table:
--   - 跟 follow_ups 對稱(同一哲學:附屬於 root 的 append-only 陣列)
--   - 跟 divination 一起讀一次 query 就拿回全部
--   - RLS 繼承 parent row,不用新 policy
--   - 每個 divination 的對話是獨立的,不需跨表查詢
--
-- Safe to run multiple times (if not exists)
-- ============================================

alter table public.divinations
  add column if not exists chat_messages jsonb not null default '[]'::jsonb;

comment on column public.divinations.chat_messages is
  'Chain of chat messages between user and AI master for this divination. Array of {role: "user"|"assistant", content: string, createdAt: ISO timestamp}. RLS inherits from parent row.';
