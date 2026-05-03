-- ============================================
-- Oracle I Ching - Phase 27: AI 背景音樂生成 + 排行榜 + 創作者分潤
-- ============================================
-- 執行時機:Supabase SQL Editor
-- 前置條件:phase5_credits.sql / phase20_card_collection.sql 已跑過
-- 此腳本可重複執行
--
-- 設計概要:
--   generated_music         — 所有歌曲(平台種子 / 永久免費 / 用戶生成)
--   music_categories        — 主題分類(生成時必選)
--   music_collections       — 用戶 20pt 收藏的歌(永久,但不能下載)
--   music_plays             — 播放紀錄(以日去重,排名用)
--   music_rankings_daily    — 每日 00:00 cron 快照,鎖定當天分潤級距
--   music_creator_follows   — 追蹤創作者
--   music_reports           — 違規檢舉
--
-- 點數:
--   生成 100 pt / 重生 50 pt / 收藏 20 pt / 訂閱戶收藏 16 pt
--
-- 分潤(以買家實付的 20 pt 為基準):
--   Top 10        → 10 pt(50%)
--   Top 11–50     →  5 pt(25%)
--   Top 51–100    →  2 pt(10%)
--   100+/種子/匿名 → 0
--
-- 排名公式:
--   分數 = 獨立購買數 × 0.7 + 獨立播放完成用戶數 × 0.3
--        × 時間衰減(>30d ×0.85,>60d ×0.7)


-- ============================================
-- 1. music_categories — 主題分類
-- ============================================

create table if not exists public.music_categories (
  id          text primary key,
  slug        text not null unique,
  emoji       text,
  label_zh    text not null,
  label_en    text not null,
  label_ja    text not null,
  label_ko    text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_music_categories_active_sort
  on public.music_categories (active, sort_order);

drop trigger if exists trg_music_categories_touch on public.music_categories;
create trigger trg_music_categories_touch
  before update on public.music_categories
  for each row execute function public.update_updated_at();

insert into public.music_categories
  (id, slug, emoji, label_zh, label_en, label_ja, label_ko, sort_order)
values
  ('meditation', 'meditation', '🧘', '冥想',  'Meditation', '瞑想',     '명상', 10),
  ('mystery',    'mystery',    '🔮', '神秘',  'Mystery',    '神秘',     '신비', 20),
  ('nature',     'nature',     '🌿', '自然',  'Nature',     '自然',     '자연', 30),
  ('oriental',   'oriental',   '🏮', '東方',  'Oriental',   '東洋',     '동양', 40),
  ('focus',      'focus',      '🎯', '專注',  'Focus',      '集中',     '집중', 50),
  ('dream',      'dream',      '🌙', '夢境',  'Dream',      '夢境',     '꿈',   60)
on conflict (id) do nothing;


-- ============================================
-- 2. generated_music — 主表
-- ============================================

create table if not exists public.generated_music (
  id                       uuid primary key default uuid_generate_v4(),

  creator_id               uuid references auth.users(id) on delete set null,
  creator_display_name     text,

  title                    text not null,
  prompt                   text not null,
  prompt_locale            text not null default 'zh'
    check (prompt_locale in ('zh', 'en', 'ja', 'ko')),
  category_id              text not null
    references public.music_categories(id) on delete restrict,

  storage_path             text not null,
  duration_seconds         int  not null check (duration_seconds > 0),
  provider                 text not null
    check (provider in ('stable_audio', 'mubert', 'platform_seed')),
  provider_track_id        text,

  visibility               text not null default 'private'
    check (visibility in ('private', 'public', 'removed_by_user', 'removed_by_moderation')),
  is_seed                  boolean not null default false,
  is_free                  boolean not null default false,

  moderation_status        text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'flagged', 'rejected')),
  moderation_notes         text,

  play_count               int not null default 0,
  collect_count            int not null default 0,
  creator_earnings_total   int not null default 0,

  created_at               timestamptz not null default now(),
  published_at             timestamptz,
  updated_at               timestamptz not null default now()
);

create index if not exists idx_music_creator
  on public.generated_music (creator_id) where creator_id is not null;

create index if not exists idx_music_visibility_category
  on public.generated_music (visibility, category_id, moderation_status)
  where visibility = 'public' and moderation_status = 'approved';

create index if not exists idx_music_published_at
  on public.generated_music (published_at desc nulls last)
  where visibility = 'public';

create index if not exists idx_music_seed_free
  on public.generated_music (is_seed, is_free)
  where is_seed = true or is_free = true;

drop trigger if exists trg_music_touch on public.generated_music;
create trigger trg_music_touch
  before update on public.generated_music
  for each row execute function public.update_updated_at();


-- ============================================
-- 3. music_collections — 用戶收藏
-- ============================================

create table if not exists public.music_collections (
  user_id            uuid not null references auth.users(id) on delete cascade,
  music_id           uuid not null references public.generated_music(id) on delete cascade,
  collected_at       timestamptz not null default now(),

  points_paid        int not null,
  creator_payout     int not null default 0,
  creator_tier       text not null default 'long_tail'
    check (creator_tier in ('top10', 'top50', 'top100', 'long_tail')),
  was_subscriber     boolean not null default false,

  primary key (user_id, music_id)
);

create index if not exists idx_collections_music_collected
  on public.music_collections (music_id, collected_at desc);

create index if not exists idx_collections_user_collected
  on public.music_collections (user_id, collected_at desc);


-- ============================================
-- 4. music_plays — 播放紀錄(以日去重)
-- ============================================

create table if not exists public.music_plays (
  user_id           uuid not null references auth.users(id) on delete cascade,
  music_id          uuid not null references public.generated_music(id) on delete cascade,
  played_date       date not null,
  play_count_today  int  not null default 1,
  completed         boolean not null default false,
  ip_hash           text,
  primary key (user_id, music_id, played_date)
);

create index if not exists idx_plays_music_date
  on public.music_plays (music_id, played_date);

create index if not exists idx_plays_user_date
  on public.music_plays (user_id, played_date desc);


-- ============================================
-- 5. music_rankings_daily — 每日排名快照
-- ============================================

create table if not exists public.music_rankings_daily (
  date               date not null,
  music_id           uuid not null references public.generated_music(id) on delete cascade,
  category_id        text not null references public.music_categories(id) on delete cascade,
  rank_in_category   int  not null,
  payout_tier        text not null
    check (payout_tier in ('top10', 'top50', 'top100', 'long_tail')),
  score              numeric not null,
  primary key (date, music_id, category_id)
);

create index if not exists idx_rankings_date_category_rank
  on public.music_rankings_daily (date, category_id, rank_in_category);

create index if not exists idx_rankings_music_date
  on public.music_rankings_daily (music_id, date desc);


-- ============================================
-- 6. music_creator_follows
-- ============================================

create table if not exists public.music_creator_follows (
  follower_id  uuid not null references auth.users(id) on delete cascade,
  creator_id   uuid not null references auth.users(id) on delete cascade,
  followed_at  timestamptz not null default now(),
  primary key (follower_id, creator_id),
  check (follower_id <> creator_id)
);

create index if not exists idx_follows_creator
  on public.music_creator_follows (creator_id, followed_at desc);


-- ============================================
-- 7. music_reports
-- ============================================

create table if not exists public.music_reports (
  id           uuid primary key default uuid_generate_v4(),
  music_id     uuid not null references public.generated_music(id) on delete cascade,
  reporter_id  uuid references auth.users(id) on delete set null,
  reason       text not null
    check (reason in ('inappropriate', 'spam', 'copyright', 'low_quality', 'other')),
  notes        text,
  status       text not null default 'pending'
    check (status in ('pending', 'reviewed_no_action', 'removed')),
  reviewed_by  uuid references auth.users(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_reports_music_status
  on public.music_reports (music_id, status);

create index if not exists idx_reports_pending
  on public.music_reports (created_at desc) where status = 'pending';


-- ============================================
-- 8. Storage bucket: app-music
-- ============================================

insert into storage.buckets (id, name, public)
values ('app-music', 'app-music', true)
on conflict (id) do nothing;

drop policy if exists "app-music public read" on storage.objects;
create policy "app-music public read"
  on storage.objects for select
  using (bucket_id = 'app-music');

drop policy if exists "app-music admin manage" on storage.objects;
create policy "app-music admin manage"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'app-music' and public.is_current_user_admin())
  with check (bucket_id = 'app-music' and public.is_current_user_admin());


-- ============================================
-- 9. RLS
-- ============================================

alter table public.music_categories enable row level security;

drop policy if exists "Public reads active categories" on public.music_categories;
create policy "Public reads active categories"
  on public.music_categories for select
  using (active = true);

drop policy if exists "Admins read all categories" on public.music_categories;
create policy "Admins read all categories"
  on public.music_categories for select
  using (public.is_current_user_admin());


alter table public.generated_music enable row level security;

drop policy if exists "Public reads approved public music" on public.generated_music;
create policy "Public reads approved public music"
  on public.generated_music for select
  using (visibility = 'public' and moderation_status = 'approved');

drop policy if exists "Creators read own music" on public.generated_music;
create policy "Creators read own music"
  on public.generated_music for select
  using (auth.uid() = creator_id);

drop policy if exists "Admins read all music" on public.generated_music;
create policy "Admins read all music"
  on public.generated_music for select
  using (public.is_current_user_admin());


alter table public.music_collections enable row level security;

drop policy if exists "Users read own collections" on public.music_collections;
create policy "Users read own collections"
  on public.music_collections for select
  using (auth.uid() = user_id);

drop policy if exists "Admins read all collections" on public.music_collections;
create policy "Admins read all collections"
  on public.music_collections for select
  using (public.is_current_user_admin());


alter table public.music_plays enable row level security;

drop policy if exists "Users read own plays" on public.music_plays;
create policy "Users read own plays"
  on public.music_plays for select
  using (auth.uid() = user_id);

drop policy if exists "Admins read all plays" on public.music_plays;
create policy "Admins read all plays"
  on public.music_plays for select
  using (public.is_current_user_admin());


alter table public.music_rankings_daily enable row level security;

drop policy if exists "Public reads rankings" on public.music_rankings_daily;
create policy "Public reads rankings"
  on public.music_rankings_daily for select
  using (true);


alter table public.music_creator_follows enable row level security;

drop policy if exists "Users read own follows" on public.music_creator_follows;
create policy "Users read own follows"
  on public.music_creator_follows for select
  using (auth.uid() = follower_id or auth.uid() = creator_id);

drop policy if exists "Users follow others" on public.music_creator_follows;
create policy "Users follow others"
  on public.music_creator_follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "Users unfollow own" on public.music_creator_follows;
create policy "Users unfollow own"
  on public.music_creator_follows for delete
  using (auth.uid() = follower_id);


alter table public.music_reports enable row level security;

drop policy if exists "Users read own reports" on public.music_reports;
create policy "Users read own reports"
  on public.music_reports for select
  using (auth.uid() = reporter_id);

drop policy if exists "Admins read all reports" on public.music_reports;
create policy "Admins read all reports"
  on public.music_reports for select
  using (public.is_current_user_admin());

drop policy if exists "Users submit reports" on public.music_reports;
create policy "Users submit reports"
  on public.music_reports for insert
  with check (auth.uid() = reporter_id);


-- ============================================
-- 10. register_generated_music
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
  p_publish_now       boolean default false
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
    title, prompt, prompt_locale, category_id,
    storage_path, duration_seconds, provider, provider_track_id,
    visibility, is_seed, is_free,
    moderation_status, published_at
  ) values (
    p_creator_id, v_display_name,
    p_title, p_prompt, p_prompt_locale, p_category_id,
    p_storage_path, p_duration_seconds, p_provider, p_provider_track_id,
    v_visibility, p_is_seed, p_is_free,
    v_moderation, v_published_at
  )
  returning id into v_music_id;

  return v_music_id;
end;
$$;


-- ============================================
-- 11. publish_music
-- ============================================

create or replace function public.publish_music(
  p_user_id  uuid,
  p_music_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
  v_visibility text;
  v_moderation text;
begin
  select creator_id, visibility, moderation_status
    into v_creator_id, v_visibility, v_moderation
    from public.generated_music where id = p_music_id;

  if v_creator_id is null then
    raise exception 'MUSIC_NOT_FOUND';
  end if;
  if v_creator_id <> p_user_id then
    raise exception 'NOT_OWNER';
  end if;
  if v_visibility = 'public' then
    return true;
  end if;
  if v_visibility in ('removed_by_user', 'removed_by_moderation') then
    raise exception 'MUSIC_REMOVED';
  end if;
  if v_moderation = 'rejected' then
    raise exception 'MUSIC_REJECTED';
  end if;
  if v_moderation <> 'approved' then
    raise exception 'MUSIC_MODERATION_PENDING';
  end if;

  update public.generated_music
     set visibility = 'public',
         published_at = coalesce(published_at, now()),
         creator_display_name = coalesce(
           creator_display_name,
           (select display_name from public.profiles where id = p_user_id)
         )
   where id = p_music_id;

  return true;
end;
$$;


-- ============================================
-- 12. collect_music
-- ============================================

create or replace function public.collect_music(
  p_user_id  uuid,
  p_music_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_music record;
  v_is_subscriber boolean;
  v_cost int;
  v_payout int := 0;
  v_payout_tier text := 'long_tail';
  v_today date := current_date;
  v_balance int;
  v_reason text;
begin
  select id, creator_id, visibility, moderation_status, is_seed, is_free, category_id
    into v_music
    from public.generated_music where id = p_music_id;

  if v_music.id is null then
    raise exception 'MUSIC_NOT_FOUND';
  end if;
  if v_music.visibility <> 'public' then
    raise exception 'MUSIC_NOT_PUBLIC';
  end if;
  if v_music.moderation_status <> 'approved' then
    raise exception 'MUSIC_NOT_APPROVED';
  end if;
  if v_music.is_free then
    raise exception 'MUSIC_IS_FREE';
  end if;
  if v_music.creator_id is not null and v_music.creator_id = p_user_id then
    raise exception 'CANNOT_COLLECT_OWN_MUSIC';
  end if;
  if exists (
    select 1 from public.music_collections
     where user_id = p_user_id and music_id = p_music_id
  ) then
    raise exception 'ALREADY_COLLECTED';
  end if;

  select public.has_active_subscription(p_user_id) into v_is_subscriber;
  v_cost := case when v_is_subscriber then 16 else 20 end;
  v_reason := case when v_is_subscriber
    then 'spend_music_collect_subscriber'
    else 'spend_music_collect' end;

  if v_music.creator_id is not null and not v_music.is_seed then
    select payout_tier into v_payout_tier
      from public.music_rankings_daily
     where date = v_today
       and music_id = p_music_id
       and category_id = v_music.category_id;

    v_payout_tier := coalesce(v_payout_tier, 'long_tail');
    v_payout := case v_payout_tier
      when 'top10'  then 10
      when 'top50'  then 5
      when 'top100' then 2
      else 0
    end;
  end if;

  v_balance := public.spend_credits(
    p_user_id, v_cost, v_reason, p_music_id,
    jsonb_build_object('music_id', p_music_id, 'creator_id', v_music.creator_id)
  );

  insert into public.music_collections (
    user_id, music_id, points_paid,
    creator_payout, creator_tier, was_subscriber
  ) values (
    p_user_id, p_music_id, v_cost,
    v_payout, v_payout_tier, v_is_subscriber
  );

  update public.generated_music
     set collect_count = collect_count + 1,
         creator_earnings_total = creator_earnings_total + v_payout
   where id = p_music_id;

  if v_payout > 0 and v_music.creator_id is not null then
    perform public.add_credits(
      v_music.creator_id, v_payout, 'creator_earning_collect', p_music_id,
      jsonb_build_object('buyer_id', p_user_id, 'tier', v_payout_tier)
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'cost', v_cost,
    'creator_payout', v_payout,
    'creator_tier', v_payout_tier,
    'balance', v_balance
  );
end;
$$;


-- ============================================
-- 13. record_music_play
-- ============================================

create or replace function public.record_music_play(
  p_user_id   uuid,
  p_music_id  uuid,
  p_completed boolean default false,
  p_ip_hash   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.music_plays
    (user_id, music_id, played_date, play_count_today, completed, ip_hash)
  values
    (p_user_id, p_music_id, current_date, 1, p_completed, p_ip_hash)
  on conflict (user_id, music_id, played_date) do update
    set play_count_today = public.music_plays.play_count_today + 1,
        completed = public.music_plays.completed or excluded.completed,
        ip_hash = coalesce(public.music_plays.ip_hash, excluded.ip_hash);

  update public.generated_music
     set play_count = play_count + 1
   where id = p_music_id;
end;
$$;


-- ============================================
-- 14. compute_music_daily_rankings
-- ============================================

create or replace function public.compute_music_daily_rankings(
  p_date date default current_date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  delete from public.music_rankings_daily where date = p_date;

  with scores as (
    select
      m.id          as music_id,
      m.category_id,
      coalesce((
        select count(distinct mc.user_id)::numeric
          from public.music_collections mc
         where mc.music_id = m.id
           and mc.collected_at > (p_date - interval '30 days')
      ), 0) * 0.7 as collect_score,
      coalesce((
        select count(distinct mp.user_id)::numeric
          from public.music_plays mp
         where mp.music_id = m.id
           and mp.completed = true
           and mp.played_date > (p_date - interval '30 days')
      ), 0) * 0.3 as play_score,
      case
        when m.published_at < (p_date - interval '60 days') then 0.7
        when m.published_at < (p_date - interval '30 days') then 0.85
        else 1.0
      end as decay_factor
    from public.generated_music m
    where m.visibility = 'public'
      and m.moderation_status = 'approved'
      and m.is_free = false
  ),
  ranked as (
    select
      music_id,
      category_id,
      (collect_score + play_score) * decay_factor as score,
      row_number() over (
        partition by category_id
        order by (collect_score + play_score) * decay_factor desc, music_id
      ) as rank_in_category
    from scores
  )
  insert into public.music_rankings_daily
    (date, music_id, category_id, rank_in_category, payout_tier, score)
  select
    p_date,
    music_id,
    category_id,
    rank_in_category,
    case
      when rank_in_category <= 10  then 'top10'
      when rank_in_category <= 50  then 'top50'
      when rank_in_category <= 100 then 'top100'
      else 'long_tail'
    end,
    score
  from ranked;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.compute_music_daily_rankings(date) is
  '每日排名計算。Vercel Cron / Supabase Scheduled 在 00:00 UTC+8 呼叫。回傳寫入列數。';


-- ============================================
-- 15. takedown_music_by_creator
-- ============================================

create or replace function public.takedown_music_by_creator(
  p_user_id  uuid,
  p_music_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
  v_visibility text;
  v_total_refund int := 0;
  v_total_clawback int := 0;
  v_buyer record;
  v_buyers_count int;
begin
  select creator_id, visibility into v_creator_id, v_visibility
    from public.generated_music where id = p_music_id;

  if v_creator_id is null or v_creator_id <> p_user_id then
    raise exception 'NOT_OWNER';
  end if;
  if v_visibility <> 'public' then
    raise exception 'MUSIC_NOT_PUBLIC';
  end if;

  select count(*)::int into v_buyers_count
    from public.music_collections where music_id = p_music_id;

  for v_buyer in
    select user_id, points_paid, creator_payout
      from public.music_collections
     where music_id = p_music_id
  loop
    perform public.add_credits(
      v_buyer.user_id, v_buyer.points_paid, 'refund_music_takedown',
      p_music_id, jsonb_build_object('reason', 'creator_takedown')
    );
    v_total_refund := v_total_refund + v_buyer.points_paid;
    v_total_clawback := v_total_clawback + v_buyer.creator_payout;
  end loop;

  if v_total_clawback > 0 then
    update public.profiles
       set credits_balance = credits_balance - v_total_clawback
     where id = v_creator_id;

    insert into public.credit_transactions
      (user_id, delta, balance_after, reason, reference_id, metadata)
    select
      v_creator_id, -v_total_clawback,
      (select credits_balance from public.profiles where id = v_creator_id),
      'clawback_music_takedown',
      p_music_id,
      jsonb_build_object('total_refund', v_total_refund);
  end if;

  update public.generated_music
     set visibility = 'removed_by_user'
   where id = p_music_id;

  return jsonb_build_object(
    'success', true,
    'buyers_refunded', v_buyers_count,
    'total_refund', v_total_refund,
    'creator_clawback', v_total_clawback
  );
end;
$$;


-- ============================================
-- 16. takedown_music_by_moderation
-- ============================================

create or replace function public.takedown_music_by_moderation(
  p_admin_id uuid,
  p_music_id uuid,
  p_reason   text default 'moderation_violation'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
  v_total_refund int := 0;
  v_total_clawback int := 0;
  v_buyer record;
begin
  if not public.is_current_user_admin() then
    raise exception 'NOT_ADMIN';
  end if;

  select creator_id into v_creator_id
    from public.generated_music where id = p_music_id;

  for v_buyer in
    select user_id, points_paid, creator_payout
      from public.music_collections
     where music_id = p_music_id
  loop
    perform public.add_credits(
      v_buyer.user_id, v_buyer.points_paid, 'refund_music_moderation',
      p_music_id, jsonb_build_object('reason', p_reason)
    );
    v_total_refund := v_total_refund + v_buyer.points_paid;
    v_total_clawback := v_total_clawback + v_buyer.creator_payout;
  end loop;

  if v_creator_id is not null and v_total_clawback > 0 then
    update public.profiles
       set credits_balance = credits_balance - v_total_clawback
     where id = v_creator_id;

    insert into public.credit_transactions
      (user_id, delta, balance_after, reason, reference_id, metadata)
    select
      v_creator_id, -v_total_clawback,
      (select credits_balance from public.profiles where id = v_creator_id),
      'forfeit_music_moderation',
      p_music_id,
      jsonb_build_object('admin', p_admin_id, 'reason', p_reason);
  end if;

  update public.generated_music
     set visibility = 'removed_by_moderation',
         moderation_status = 'rejected',
         moderation_notes = p_reason
   where id = p_music_id;

  return jsonb_build_object(
    'success', true,
    'total_refund', v_total_refund,
    'creator_clawback', v_total_clawback
  );
end;
$$;


-- ============================================
-- 17. refund_music_generation
-- ============================================

create or replace function public.refund_music_generation(
  p_user_id   uuid,
  p_amount    int,
  p_error     text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.add_credits(
    p_user_id, p_amount, 'refund_music_generate_failed',
    null, jsonb_build_object('error', coalesce(p_error, 'unknown'))
  );
end;
$$;


-- ============================================
-- 完成 — 驗證查詢:
--   select tablename from pg_tables where schemaname='public'
--    and tablename like 'music_%' or tablename = 'generated_music' order by tablename;
--   select id, label_zh, sort_order from public.music_categories order by sort_order;
--   select id, public from storage.buckets where id = 'app-music';
-- ============================================
