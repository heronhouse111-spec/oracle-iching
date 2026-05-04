-- ============================================
-- Oracle I Ching - Phase 30: 修正用戶生成音樂的 moderation_status
-- ============================================
-- 執行時機:Supabase SQL Editor
-- 前置條件:phase27 / phase28 / phase29 已跑過
-- 此腳本可重複執行
--
-- 問題:
--   原 register_generated_music 對 user-generated(非 seed / free)的歌
--   把 moderation_status 設成 'pending',但沒有後續流程把它改成 'approved',
--   導致用戶按「公開到排行榜」時 publish_music() 檢查狀態 → 拒絕。
--
-- 修法:
--   1. user-generated 走 /api/music/generate 已過 lib/music/moderation,
--      所以入庫時直接標 'approved'(visibility 仍是 'private')。
--   2. Backfill 既有卡住的 private 'pending' 歌 → 'approved'。
--
-- 注意:publish API 在 SQL 之前還會再過一次 moderation 縱深防守,
--       所以這裡標 'approved' 不會繞開審核 — 只是讓「我創作的」
--       可以被自己 publish。


-- ============================================
-- 1. Backfill 既有 user-generated 卡住的歌
-- ============================================
-- 條件:有 creator_id(用戶生成,非 seed)、status='pending'、provider 是
--      實際 AI(stable_audio / mubert) → 確認是 generate API 走過的流程
update public.generated_music
   set moderation_status = 'approved'
 where moderation_status = 'pending'
   and creator_id is not null
   and provider in ('stable_audio', 'mubert');


-- ============================================
-- 2. 重寫 register_generated_music 讓未來新生成直接 approved
-- ============================================

create or replace function public.register_generated_music(
  p_creator_id        uuid,
  p_title             text,
  p_prompt            text,
  p_prompt_locale     text,
  p_category_id       text,
  p_storage_path      text,
  p_duration_seconds  int,
  p_provider          text,
  p_provider_track_id text default null,
  p_is_seed           boolean default false,
  p_is_free           boolean default false,
  p_publish_now       boolean default false,
  p_title_translations jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_music_id uuid;
  v_display_name text;
  v_visibility text;
  v_moderation text;
  v_published_at timestamptz;
begin
  if p_is_seed or p_is_free then
    -- 平台預備:直接 public + approved
    v_visibility := 'public';
    v_moderation := 'approved';
    v_published_at := now();
    v_display_name := null;
  elsif p_publish_now then
    -- 用戶生成且立刻公開
    v_visibility := 'public';
    v_moderation := 'approved';
    v_published_at := now();
    select display_name into v_display_name
      from public.profiles where id = p_creator_id;
  else
    -- 用戶生成預設 private,但 moderation 標 approved
    -- (假設呼叫端 /api/music/generate 已過 moderateMusicText 黑名單 + OpenAI)
    -- 用戶按「公開到排行榜」時 publish API 會再過一次 moderation 縱深防守。
    v_visibility := 'private';
    v_moderation := 'approved';
    v_published_at := null;
    select display_name into v_display_name
      from public.profiles where id = p_creator_id;
  end if;

  insert into public.generated_music (
    creator_id, creator_display_name,
    title, title_translations,
    prompt, prompt_locale, category_id,
    storage_path, duration_seconds, provider, provider_track_id,
    visibility, is_seed, is_free,
    moderation_status, published_at
  ) values (
    p_creator_id, v_display_name,
    p_title, p_title_translations,
    p_prompt, p_prompt_locale, p_category_id,
    p_storage_path, p_duration_seconds, p_provider, p_provider_track_id,
    v_visibility, p_is_seed, p_is_free,
    v_moderation, v_published_at
  )
  returning id into v_music_id;

  return v_music_id;
end;
$$;


-- ============================================
-- 驗證:
--   select moderation_status, count(*)
--     from public.generated_music
--    where creator_id is not null
--    group by moderation_status;
--   → 應該全部都是 'approved'(沒有 pending 卡著)
-- ============================================
