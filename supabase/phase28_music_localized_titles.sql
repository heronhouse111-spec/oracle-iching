-- ============================================
-- Oracle I Ching - Phase 28: 音樂標題多語系
-- ============================================
-- 執行時機:Supabase SQL Editor
-- 前置條件:phase27_music_generation.sql 已跑過
-- 此腳本可重複執行
--
-- 改變:
--   1. generated_music 加 title_translations jsonb 欄位
--      結構:{"zh": "...", "en": "...", "ja": "...", "ko": "..."}
--      UI 顯示優先讀對應 locale,沒填回退 title 原欄位
--   2. register_generated_music 接受 p_title_translations 參數
--   3. Backfill 既有 2 首永久免費歌:title 改英文 + 多語翻譯


-- ============================================
-- 1. 加欄位
-- ============================================

alter table public.generated_music
  add column if not exists title_translations jsonb;

comment on column public.generated_music.title_translations is
  '多語系標題:{"zh": "...", "en": "...", "ja": "...", "ko": "..."}。
   平台種子 / 免費歌會填,UI 顯示時優先用 title_translations[locale];
   用戶生成不填,直接顯示 title 欄位(用戶語言為主)。';


-- ============================================
-- 2. 更新 register_generated_music 接受 translations
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
    v_visibility := 'public';
    v_moderation := 'approved';
    v_published_at := now();
    v_display_name := null;
  elsif p_publish_now then
    v_visibility := 'public';
    v_moderation := 'approved';
    v_published_at := now();
    select display_name into v_display_name
      from public.profiles where id = p_creator_id;
  else
    v_visibility := 'private';
    v_moderation := 'pending';
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
-- 3. Backfill 2 首永久免費歌:英文 title + 多語翻譯
-- ============================================

update public.generated_music
   set title = 'Heart Meditation',
       title_translations = jsonb_build_object(
         'zh', '靜心冥想(精選長曲)',
         'en', 'Heart Meditation (Featured)',
         'ja', '静心瞑想(精選長曲)',
         'ko', '정심 명상 (추천 장곡)'
       )
 where is_free = true
   and category_id = 'meditation'
   and provider = 'platform_seed';

update public.generated_music
   set title = 'Eastern Zen Garden',
       title_translations = jsonb_build_object(
         'zh', '東方禪境(精選長曲)',
         'en', 'Eastern Zen Garden (Featured)',
         'ja', '東方禅境(精選長曲)',
         'ko', '동방 선의 경지 (추천 장곡)'
       )
 where is_free = true
   and category_id = 'oriental'
   and provider = 'platform_seed';


-- ============================================
-- 完成 — 驗證:
--   select id, title, title_translations
--     from public.generated_music
--    where is_free = true;
--   → 應看到 'Heart Meditation' / 'Eastern Zen Garden' + 4 語 jsonb
-- ============================================
