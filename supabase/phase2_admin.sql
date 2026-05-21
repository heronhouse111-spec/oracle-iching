-- ============================================
-- Phase 2 — Admin Dashboard
-- ============================================
-- Adds:
--   1. profiles.is_admin column
--   2. is_current_user_admin() SECURITY DEFINER helper
--      (避免 RLS policy 內 self-reference 造成遞迴 / 權限怪事)
--   3. Admin RLS policies on profiles and divinations
--      (admins 可讀全部資料,一般使用者只能看自己 — 原 policy 保留)
--   4. admin_users_view  (join profiles + auth.users,僅 admin 可讀)
--
-- Safe to run multiple times (uses `if not exists` / `create or replace`).
-- ============================================

-- ── 1. profiles.is_admin ────────────────────────────
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ── 2. Admin check helper (SECURITY DEFINER) ────────
-- SECURITY DEFINER 讓這個 function 繞過 RLS 直接查 profiles.is_admin
-- 這樣 policy 內呼叫它才不會踩到 policy 本身造成遞迴
create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;

-- ── 3. Admin RLS policies ───────────────────────────
-- profiles: admin 可讀全部
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_current_user_admin());

-- divinations: admin 可讀全部
drop policy if exists "Admins can view all divinations" on public.divinations;
create policy "Admins can view all divinations"
  on public.divinations for select
  using (public.is_current_user_admin());

-- (可選) subscriptions: admin 可讀全部
drop policy if exists "Admins can view all subscriptions" on public.subscriptions;
create policy "Admins can view all subscriptions"
  on public.subscriptions for select
  using (public.is_current_user_admin());

-- ── 4. admin_users_view ─────────────────────────────
-- 這個 view 需要 join auth.users(拿 email / last_sign_in_at)
-- auth.users 一般使用者沒權限,所以用預設 security_definer 的 view
-- + 在 WHERE 加上 admin 判定,等同於「只有 admin 能拿到資料」。
create or replace view public.admin_users_view
with (security_invoker = false)
as
select
  p.id,
  u.email,
  u.created_at as signed_up_at,
  u.last_sign_in_at,
  p.display_name,
  p.preferred_locale,
  p.is_admin
from public.profiles p
join auth.users u on u.id = p.id
where public.is_current_user_admin();

grant select on public.admin_users_view to authenticated;

-- ── 5. Bootstrap admin ──────────────────────────────
-- 把 heronhouse111@gmail.com 設為 admin
-- (之後要加其他 admin 就手動 UPDATE profiles set is_admin=true ...)
update public.profiles
set is_admin = true
where id = (
  select id from auth.users where email = 'heronhouse111@gmail.com' limit 1
);
