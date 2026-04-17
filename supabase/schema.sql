-- ============================================
-- Oracle I Ching - Supabase Database Schema
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- Users profile table (extends Supabase Auth)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  preferred_locale text default 'zh' check (preferred_locale in ('zh', 'en')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- Divination records table
-- ============================================
create table public.divinations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  question text not null,
  category text not null check (category in ('love', 'career', 'wealth', 'health', 'study', 'general')),
  hexagram_number integer not null check (hexagram_number between 1 and 64),
  primary_lines integer[] not null,
  changing_lines integer[] default '{}',
  relating_hexagram_number integer check (relating_hexagram_number between 1 and 64),
  ai_reading text,
  locale text default 'zh' check (locale in ('zh', 'en')),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.divinations enable row level security;

create policy "Users can view own divinations"
  on public.divinations for select
  using (auth.uid() = user_id);

create policy "Users can insert own divinations"
  on public.divinations for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own divinations"
  on public.divinations for delete
  using (auth.uid() = user_id);

-- Index for faster queries
create index idx_divinations_user_id on public.divinations(user_id);
create index idx_divinations_created_at on public.divinations(created_at desc);

-- ============================================
-- Updated at trigger
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();
