-- ============================================================
-- phase31 — 修正 register_generated_music 多載(overload)衝突
-- ============================================================
--
-- 問題:
--   phase27 建立了 12 參數版的 register_generated_music。
--   phase28 / phase30 改成 13 參數版(多了 p_title_translations jsonb default null),
--   但因為參數簽章不同,create or replace 並未覆蓋舊版,而是「多建一個」。
--   結果正式環境同時存在兩個同名函式:
--     register_generated_music(uuid,text,text,text,text,text,int,text,text,boolean,boolean,boolean)        -- 12 args (phase27)
--     register_generated_music(uuid,text,text,text,text,text,int,text,text,boolean,boolean,boolean,jsonb)  -- 13 args (phase28/30)
--
--   /api/music/generate 呼叫 RPC 時只傳 12 個具名參數(未傳 p_title_translations)。
--   這 12 個參數「同時符合」兩個函式(13 參數那個第 13 個有預設值),
--   PostgREST 無法選擇 → PGRST203「Could not choose the best candidate function」
--   → API 回 MUSIC_REGISTER_FAILED「音檔註冊失敗,已自動退點」。
--
-- 修法:
--   刪掉過時的 12 參數版本,只保留 phase30 的 13 參數版本。
--   之後 12 參數的呼叫會明確對應到唯一的 13 參數函式(p_title_translations 取預設 null)。
--
-- 安全性:
--   DROP ... IF EXISTS,只刪指定簽章;13 參數版不受影響。冪等,可重複執行。
-- ============================================================

drop function if exists public.register_generated_music(
  uuid,     -- p_creator_id
  text,     -- p_title
  text,     -- p_prompt
  text,     -- p_prompt_locale
  text,     -- p_category_id
  text,     -- p_storage_path
  int,      -- p_duration_seconds
  text,     -- p_provider
  text,     -- p_provider_track_id
  boolean,  -- p_is_seed
  boolean,  -- p_is_free
  boolean   -- p_publish_now
);

-- 驗證(執行後應只剩 1 筆 = 13 個參數那版):
--   select oid::regprocedure
--     from pg_proc
--    where proname = 'register_generated_music';
