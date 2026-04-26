-- ============================================
-- Phase 8 — Admin CMS Foundations
-- ============================================
-- 加入完整的後台管理基礎建設:
--
--   1. admin_audit_log               審計線索:誰、何時、做了什麼
--   2. credit_grants                 手動補/扣點記錄(獨立於 spend/refill 軌跡)
--   3. admin_adjust_credits()        admin RPC:可正可負,自動寫 credit_grants
--   4. credit_packs                  CMS-driven 加購點數方案
--   5. subscription_plans            CMS-driven 訂閱方案
--   6. announcements                 首頁 banner / 跑馬燈內容
--   7. feature_flags                 開關功能(usd_payment / yearly_sub / 等)
--   8. ai_prompts                    AI 系統提示詞(支援版本 + active 標記)
--
-- 全部都用 if not exists,可重複執行。
-- 所有寫入操作只開給 admin (service_role 不受 RLS 影響,直接走 admin API)。
-- ============================================

-- ─────────────────────────────────────────────
-- 1. admin_audit_log
-- ─────────────────────────────────────────────
create table if not exists public.admin_audit_log (
  id              bigserial primary key,
  actor_id        uuid not null references auth.users(id) on delete restrict,
  actor_email     text not null,                  -- snapshot(防止 user 刪除後追溯不到)
  action          text not null,                  -- e.g. 'credits.grant' / 'pricing.update' / 'announcement.create'
  target_type     text,                           -- 'user' / 'order' / 'pack' / 'plan' / null
  target_id       text,                           -- 對應 type 的 id (user uuid / mtn / pack_id ...)
  payload         jsonb not null default '{}'::jsonb,  -- 完整 before/after diff 或操作參數
  ip_address      text,                           -- 來源 IP(從 request header 抓)
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_actor_id on public.admin_audit_log(actor_id, created_at desc);
create index if not exists idx_audit_action on public.admin_audit_log(action, created_at desc);
create index if not exists idx_audit_target on public.admin_audit_log(target_type, target_id);

-- 只 admin 可讀
alter table public.admin_audit_log enable row level security;
drop policy if exists "Admins can view audit log" on public.admin_audit_log;
create policy "Admins can view audit log"
  on public.admin_audit_log for select
  using (public.is_current_user_admin());

-- 寫入只透過 service_role(API route),不開放 client 直寫
-- (沒設 INSERT policy 等於擋下所有 anon/authenticated 寫入)


-- ─────────────────────────────────────────────
-- 2. credit_grants — 手動補/扣點記錄
-- ─────────────────────────────────────────────
create table if not exists public.credit_grants (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  delta           integer not null,                -- 正補負扣
  balance_after   integer not null,                -- 操作後餘額(snapshot,方便回溯)
  reason          text not null,                   -- 必填:操作原因
  granted_by      uuid not null references auth.users(id),
  granted_by_email text not null,
  related_order_mtn text,                          -- 如果跟某筆訂單有關(退款補償)
  created_at      timestamptz not null default now()
);

create index if not exists idx_grants_user on public.credit_grants(user_id, created_at desc);
create index if not exists idx_grants_granter on public.credit_grants(granted_by, created_at desc);

alter table public.credit_grants enable row level security;
drop policy if exists "Admins can view all credit grants" on public.credit_grants;
create policy "Admins can view all credit grants"
  on public.credit_grants for select
  using (public.is_current_user_admin());

drop policy if exists "Users can view own credit grants" on public.credit_grants;
create policy "Users can view own credit grants"
  on public.credit_grants for select
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- 3. admin_adjust_credits() — admin RPC,允許正負
-- ─────────────────────────────────────────────
-- 不像 add_credits 拒絕 <=0,這個 RPC 同時支援補/扣,並自動寫 credit_grants log。
-- 必須由 server-side admin API 呼叫(check is_current_user_admin)。
create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_delta integer,
  p_reason text,
  p_related_order_mtn text default null
)
returns integer  -- 回傳新餘額
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
  v_actor_email text;
begin
  -- 安全檢查:呼叫者必須是 admin
  if not public.is_current_user_admin() then
    raise exception 'FORBIDDEN: only admin can adjust credits';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reason is required';
  end if;

  if p_delta = 0 then
    raise exception 'delta cannot be zero';
  end if;

  -- 上下限保護:單次最多正負 1 萬點(防誤操作)
  if p_delta > 10000 or p_delta < -10000 then
    raise exception 'delta out of safe range [-10000, 10000]: %', p_delta;
  end if;

  -- 原子更新餘額(允許扣到 0 但不能扣成負數)
  update public.profiles
     set credits_balance = greatest(0, credits_balance + p_delta)
   where id = p_user_id
  returning credits_balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'profile not found for user %', p_user_id;
  end if;

  -- 抓 actor email(snapshot)
  select email into v_actor_email
  from auth.users where id = auth.uid();

  -- 寫 grant 記錄
  insert into public.credit_grants(
    user_id, delta, balance_after, reason,
    granted_by, granted_by_email, related_order_mtn
  ) values (
    p_user_id, p_delta, v_new_balance, p_reason,
    auth.uid(), v_actor_email, p_related_order_mtn
  );

  return v_new_balance;
end;
$$;

grant execute on function public.admin_adjust_credits(uuid, integer, text, text) to authenticated;

comment on function public.admin_adjust_credits is
  'Admin only. 可正可負調整 user 點數,自動寫 credit_grants log,扣不到負數。';


-- ─────────────────────────────────────────────
-- 4. credit_packs — CMS-driven 加購方案
-- ─────────────────────────────────────────────
create table if not exists public.credit_packs (
  id              text primary key,                  -- 'pack_200' / 'pack_500' / 'pack_1200'
  credits         integer not null,
  bonus_credits   integer not null default 0,
  price_twd       integer not null,
  price_usd       numeric(10,2),                     -- 可空(USD 還沒開)
  highlighted     boolean not null default false,    -- 「最划算」徽章
  active          boolean not null default true,     -- false = 隱藏
  display_order   integer not null default 100,
  zh_label        text,                              -- "200 點"
  en_label        text,                              -- "200 credits"
  play_sku_id     text,                              -- 對應 Play Console SKU(orc.credits.pack200)
  notes           text,                              -- 內部備註(後台用)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.credit_packs enable row level security;
-- 公開讀(active=true 的方案任何人能看,給 /account/credits 用)
drop policy if exists "Public can view active credit packs" on public.credit_packs;
create policy "Public can view active credit packs"
  on public.credit_packs for select
  using (active = true);
drop policy if exists "Admins can view all credit packs" on public.credit_packs;
create policy "Admins can view all credit packs"
  on public.credit_packs for select
  using (public.is_current_user_admin());

-- 預埋目前的三個方案
insert into public.credit_packs (id, credits, bonus_credits, price_twd, price_usd, highlighted, display_order, zh_label, en_label, play_sku_id)
values
  ('pack_200',  200,  0,   60,  2.00, false, 10, '200 點',          '200 credits',           'orc.credits.pack200'),
  ('pack_500',  500,  50,  120, 4.00, true,  20, '500 點 + 贈 50',  '500 credits + 50 bonus','orc.credits.pack500'),
  ('pack_1200', 1200, 200, 240, 8.00, false, 30, '1200 點 + 贈 200','1200 credits + 200 bonus','orc.credits.pack1200')
on conflict (id) do nothing;


-- ─────────────────────────────────────────────
-- 5. subscription_plans — CMS-driven 訂閱方案
-- ─────────────────────────────────────────────
create table if not exists public.subscription_plans (
  id              text primary key,                  -- 'monthly' / 'yearly'
  price_twd       integer not null,
  price_usd       numeric(10,2),
  amortize_months integer not null,                  -- 月訂=1 / 年訂=12
  monthly_credits integer not null default 600,      -- 每月配給點數
  highlighted     boolean not null default false,
  active          boolean not null default true,
  display_order   integer not null default 100,
  zh_label        text,
  en_label        text,
  play_sku_id     text,                              -- orc.subscription.monthly
  ecpay_period_type text,                            -- 'M' / 'Y'(綠界定期定額用)
  ecpay_frequency integer,                           -- 1
  ecpay_exec_times integer,                          -- 99 / 9
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;
drop policy if exists "Public can view active plans" on public.subscription_plans;
create policy "Public can view active plans"
  on public.subscription_plans for select
  using (active = true);
drop policy if exists "Admins can view all plans" on public.subscription_plans;
create policy "Admins can view all plans"
  on public.subscription_plans for select
  using (public.is_current_user_admin());

insert into public.subscription_plans
  (id, price_twd, price_usd, amortize_months, monthly_credits, highlighted, display_order,
   zh_label, en_label, play_sku_id, ecpay_period_type, ecpay_frequency, ecpay_exec_times)
values
  ('monthly', 150, 5.00,  1,  600, false, 10, '月訂閱', 'Monthly',
   'orc.subscription.monthly', 'M', 1, 99),
  ('yearly',  1440, 48.00, 12, 600, true,  20, '年訂閱', 'Yearly',
   'orc.subscription.yearly',  'Y', 1, 9)
on conflict (id) do nothing;


-- ─────────────────────────────────────────────
-- 6. announcements — 公告 banner
-- ─────────────────────────────────────────────
create table if not exists public.announcements (
  id              bigserial primary key,
  zh_text         text,                              -- 中文版內容(可空,某語系不顯示)
  en_text         text,                              -- 英文版內容
  link_url        text,                              -- 點擊後跳轉(可空 = 純資訊)
  severity        text not null default 'info',     -- 'info' / 'warn' / 'critical'
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,                       -- null = 永久顯示直到 active=false
  active          boolean not null default true,
  display_order   integer not null default 100,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint announcements_severity_check check (severity in ('info', 'warn', 'critical'))
);

create index if not exists idx_announcements_active on public.announcements(active, starts_at, ends_at);

alter table public.announcements enable row level security;
-- 公開讀生效中的(active + 在時間區間內)
drop policy if exists "Public can view live announcements" on public.announcements;
create policy "Public can view live announcements"
  on public.announcements for select
  using (
    active = true
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
  );
drop policy if exists "Admins can view all announcements" on public.announcements;
create policy "Admins can view all announcements"
  on public.announcements for select
  using (public.is_current_user_admin());


-- ─────────────────────────────────────────────
-- 7. feature_flags — 功能開關
-- ─────────────────────────────────────────────
create table if not exists public.feature_flags (
  key             text primary key,                  -- 'usd_payment_enabled' / 'yearly_subscription_enabled'
  enabled         boolean not null default false,
  description     text,                              -- 給後台 UI 顯示的說明文字
  payload         jsonb default '{}'::jsonb,         -- 可選 — 進階配置(例如 rollout %)
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id)
);

alter table public.feature_flags enable row level security;
-- 所有 authenticated 都可讀(NEXT_PUBLIC_ 都會 bake 進 client,flags 也是公開資訊)
drop policy if exists "Authenticated can view flags" on public.feature_flags;
create policy "Authenticated can view flags"
  on public.feature_flags for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

insert into public.feature_flags (key, enabled, description) values
  ('usd_payment_enabled',         false, '是否開放 USD 國際信用卡支付(Stripe / 等待整合)'),
  ('yearly_subscription_enabled', true,  '是否在訂閱頁顯示年訂閱方案'),
  ('ai_followup_enabled',         true,  '是否開放 AI 衍伸問卜(扣 10 點)'),
  ('tarot_mode_enabled',          true,  '是否開放塔羅占卜分頁(關閉 = 只剩易經)'),
  ('share_card_enabled',          true,  '是否開放占卜結果分享卡片功能'),
  ('referral_enabled',            false, '推薦人系統(規劃中)')
on conflict (key) do nothing;


-- ─────────────────────────────────────────────
-- 8. ai_prompts — AI 系統提示詞版本管理
-- ─────────────────────────────────────────────
create table if not exists public.ai_prompts (
  id              bigserial primary key,
  slot            text not null,                     -- 'iching_main' / 'tarot_main' / 'followup' / 'safety_preamble'
  version         integer not null,                  -- 版本號(同一 slot 自增)
  content         text not null,                     -- prompt 內容
  active          boolean not null default false,    -- 是否生效中
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  unique (slot, version)
);

create index if not exists idx_prompts_slot_active on public.ai_prompts(slot, active);

alter table public.ai_prompts enable row level security;
drop policy if exists "Admins can view ai prompts" on public.ai_prompts;
create policy "Admins can view ai prompts"
  on public.ai_prompts for select
  using (public.is_current_user_admin());


-- ─────────────────────────────────────────────
-- 9. updated_at trigger 共用
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_credit_packs_updated on public.credit_packs;
create trigger trg_credit_packs_updated
  before update on public.credit_packs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_subscription_plans_updated on public.subscription_plans;
create trigger trg_subscription_plans_updated
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();

drop trigger if exists trg_announcements_updated on public.announcements;
create trigger trg_announcements_updated
  before update on public.announcements
  for each row execute function public.set_updated_at();

drop trigger if exists trg_feature_flags_updated on public.feature_flags;
create trigger trg_feature_flags_updated
  before update on public.feature_flags
  for each row execute function public.set_updated_at();
