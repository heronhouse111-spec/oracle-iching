-- ============================================
-- Phase 10 — Question Inspirations CMS
-- ============================================
-- 通用 key/value 內容表,先用來存問題靈感題庫。
-- 之後 CMS 化的其他文案(首頁 hero、blog 短文等)可共用同一張表。
--
-- value 欄位為 jsonb,結構由各 key 自己定義:
--   key = 'question_inspirations' :
--     { [categoryId]: [
--         { titleZh, titleEn, titleJa?, titleKo?,
--           questions: [ { zh, en, ja?, ko? }, ... ] },
--         ...
--       ] }
--
-- RLS:任何人可讀(內容本來就是要顯示給訪客的);寫入只透過
-- service_role(admin API),沒設 INSERT/UPDATE policy 等於擋下 client。
--
-- 不預埋種子 — API route 讀不到此 row 時會 fallback 到 repo 內的 static data file
-- (data/questionInspirations.ts),所以遷移執行後不會有空白期。Admin 第一次
-- 在後台「儲存」時才寫入 DB,從此 DB 為準。
-- ============================================

create table if not exists public.app_content (
  key             text primary key,
  value           jsonb not null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id)
);

alter table public.app_content enable row level security;

drop policy if exists "Public can read app content" on public.app_content;
create policy "Public can read app content"
  on public.app_content for select
  using (true);

drop policy if exists "Admins can view all app content" on public.app_content;
create policy "Admins can view all app content"
  on public.app_content for select
  using (public.is_current_user_admin());

-- 共用的 updated_at trigger(phase8 已建,這裡安全 re-create)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_content_updated on public.app_content;
create trigger trg_app_content_updated
  before update on public.app_content
  for each row execute function public.set_updated_at();
