-- ============================================
-- Phase 9 — Admin Advanced (Phase 3+4 of admin roadmap)
-- ============================================
-- 加入:
--   1. profiles.role          多級角色(super_admin / admin / support / user)
--   2. profiles.banned        封鎖標記 + reason + 時間
--   3. promo_codes            促銷碼系統
--   4. promo_code_redemptions 兌換記錄(防重用)
--   5. is_current_user_role_at_least() helper
--   6. Audit log RLS 給 admin 查看
--
-- 全部 idempotent。
-- ============================================

-- ─────────────────────────────────────────────
-- 1. profiles.role
-- ─────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'admin_role') then
    create type public.admin_role as enum ('user', 'support', 'admin', 'super_admin');
  end if;
end $$;

alter table public.profiles
  add column if not exists role public.admin_role not null default 'user';

-- 把現有 is_admin = true 的人遷成 admin role
update public.profiles set role = 'admin' where is_admin = true and role = 'user';

-- 把第一個 admin (heronhouse111@gmail.com) 升為 super_admin
update public.profiles
   set role = 'super_admin'
 where id = (select id from auth.users where email = 'heronhouse111@gmail.com' limit 1);

create index if not exists idx_profiles_role on public.profiles(role) where role <> 'user';


-- ─────────────────────────────────────────────
-- 2. profiles.banned
-- ─────────────────────────────────────────────
alter table public.profiles
  add column if not exists banned boolean not null default false,
  add column if not exists banned_reason text,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by uuid references auth.users(id);

create index if not exists idx_profiles_banned on public.profiles(banned) where banned = true;


-- ─────────────────────────────────────────────
-- 3. role helpers (取代 is_current_user_admin 的擴充版)
-- ─────────────────────────────────────────────
-- 把 role 對應到數值:user=0 / support=1 / admin=2 / super_admin=3
create or replace function public.role_to_int(r public.admin_role)
returns integer
language sql
immutable
as $$
  select case r
    when 'super_admin' then 3
    when 'admin' then 2
    when 'support' then 1
    else 0
  end;
$$;

create or replace function public.is_current_user_role_at_least(min_role public.admin_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select public.role_to_int(role) >= public.role_to_int(min_role)
      from public.profiles where id = auth.uid()
    ),
    false
  );
$$;

grant execute on function public.is_current_user_role_at_least(public.admin_role) to authenticated;

-- 保留 is_current_user_admin() 為 backward compatible(改成 role >= admin)
create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_current_user_role_at_least('admin'::public.admin_role);
$$;


-- ─────────────────────────────────────────────
-- 4. promo_codes
-- ─────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'promo_discount_type') then
    create type public.promo_discount_type as enum (
      'percentage',     -- 折扣百分比(value=10 表示打 90 折)
      'fixed_amount',   -- 固定金額折(value=50 NTD)
      'bonus_credits',  -- 加贈點數(value=100,只對 credit_pack 有效)
      'free_period'     -- 免費期(value=月份數,只對 subscription 有效)
    );
  end if;
end $$;

create table if not exists public.promo_codes (
  id              bigserial primary key,
  code            text not null unique,                  -- 'NEWUSER10' / 'LUNAR2026'(大小寫不敏感,儲存時轉大寫)
  description     text,                                  -- 內部說明
  discount_type   public.promo_discount_type not null,
  discount_value  numeric(10,2) not null,                -- 視 type 決定意義
  applies_to      text not null default 'all',           -- 'all' / 'credit_pack' / 'subscription' / 'pack:pack_500'(可指定特定方案)
  usage_limit     integer,                               -- null = 無限次。整體使用上限
  per_user_limit  integer not null default 1,            -- 同一個 user 可用幾次
  starts_at       timestamptz not null default now(),
  expires_at      timestamptz,                           -- null = 永不過期(配合 active 使用)
  active          boolean not null default true,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  total_redemptions integer not null default 0,          -- denormalized count(redemption insert trigger 維護)
  notes           text
);

create index if not exists idx_promo_code on public.promo_codes(upper(code));
create index if not exists idx_promo_active on public.promo_codes(active, expires_at);

alter table public.promo_codes enable row level security;
drop policy if exists "Admins can view all promo codes" on public.promo_codes;
create policy "Admins can view all promo codes"
  on public.promo_codes for select
  using (public.is_current_user_admin());

-- 公開 verify(限定:active + 在時間區間 + 還有額度)— 不能讓 client 自己 read
-- 而是透過 /api/promo/apply server 端代查
-- (沒設 SELECT policy 給 anon 等於擋住所有 client read)


-- ─────────────────────────────────────────────
-- 5. promo_code_redemptions
-- ─────────────────────────────────────────────
create table if not exists public.promo_code_redemptions (
  id              bigserial primary key,
  promo_code_id   bigint not null references public.promo_codes(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  merchant_trade_no text,                            -- 對應 ECPay 訂單(如有)
  applied_amount  numeric(10,2),                     -- 實際折抵的金額或加贈點數
  applied_to      text,                              -- 'pack_500' / 'monthly' / 'pack:pack_200'
  redeemed_at     timestamptz not null default now(),
  unique (promo_code_id, user_id, merchant_trade_no) -- 同一張 code + 同一筆訂單只能用一次
);

create index if not exists idx_redemptions_user on public.promo_code_redemptions(user_id, redeemed_at desc);
create index if not exists idx_redemptions_code on public.promo_code_redemptions(promo_code_id, redeemed_at desc);

alter table public.promo_code_redemptions enable row level security;
drop policy if exists "Admins can view all redemptions" on public.promo_code_redemptions;
create policy "Admins can view all redemptions"
  on public.promo_code_redemptions for select
  using (public.is_current_user_admin());

drop policy if exists "Users can view own redemptions" on public.promo_code_redemptions;
create policy "Users can view own redemptions"
  on public.promo_code_redemptions for select
  using (auth.uid() = user_id);


-- 維護 promo_codes.total_redemptions
create or replace function public.bump_promo_redemption_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.promo_codes
       set total_redemptions = total_redemptions + 1
     where id = new.promo_code_id;
  elsif tg_op = 'DELETE' then
    update public.promo_codes
       set total_redemptions = greatest(0, total_redemptions - 1)
     where id = old.promo_code_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_bump_redemption_count on public.promo_code_redemptions;
create trigger trg_bump_redemption_count
  after insert or delete on public.promo_code_redemptions
  for each row execute function public.bump_promo_redemption_count();


-- ─────────────────────────────────────────────
-- 6. promo_codes updated_at trigger
-- ─────────────────────────────────────────────
drop trigger if exists trg_promo_codes_updated on public.promo_codes;
create trigger trg_promo_codes_updated
  before update on public.promo_codes
  for each row execute function public.set_updated_at();


-- ─────────────────────────────────────────────
-- 7. (開發者方便)admin_users_view 加 role
-- ─────────────────────────────────────────────
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
  p.is_admin,
  p.role,
  p.banned,
  p.banned_reason,
  p.banned_at
from public.profiles p
join auth.users u on u.id = p.id
where public.is_current_user_admin();

grant select on public.admin_users_view to authenticated;
