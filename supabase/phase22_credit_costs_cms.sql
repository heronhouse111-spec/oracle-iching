-- Phase 22: Credit costs admin CMS
--
-- 把所有占卜成本(原本 hardcoded 在 lib/credits.ts CREDIT_COSTS)搬到 DB,
-- 讓 admin 可以隨時調整,不用 redeploy。
--
-- 設計重點:
--   - DB 是 source of truth;lib/credits.ts 的 CREDIT_COSTS 變成「fallback」
--     (DB 讀失敗 / 找不到 key 時用,不阻擋主流程)
--   - public read 任何 active row(前端 UI 顯示成本要用)
--   - admin 才能寫(透過 service_role 直接走 admin client)
--   - 改動全進 admin_audit_log
--
-- 對應程式:
--   - lib/creditCostsDb.ts  — server-side cached getter
--   - app/api/admin/credit-costs  — GET/POST upsert CRUD
--   - app/admin/credit-costs       — admin CMS UI

create table if not exists public.credit_costs (
  id              text primary key,         -- 'DIVINE' / 'TAROT' / 'YESNO' / 'DAILY' / ...
  amount          integer not null check (amount >= 0),
  label_zh        text not null,
  label_en        text not null,
  description_zh  text,
  description_en  text,
  category        text not null default 'general',  -- 'iching' / 'tarot' / 'shared' 等,UI 分組用
  active          boolean not null default true,
  sort_order      integer not null default 100,
  updated_at      timestamptz not null default now()
);

create index if not exists idx_credit_costs_active on public.credit_costs (active);

-- updated_at trigger
create or replace function public.touch_credit_costs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_credit_costs_touch on public.credit_costs;
create trigger trg_credit_costs_touch
  before update on public.credit_costs
  for each row execute function public.touch_credit_costs_updated_at();

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.credit_costs enable row level security;

drop policy if exists "Public can read active credit costs" on public.credit_costs;
create policy "Public can read active credit costs"
  on public.credit_costs for select
  using (active = true);

drop policy if exists "Admins can read all credit costs" on public.credit_costs;
create policy "Admins can read all credit costs"
  on public.credit_costs for select
  using (public.is_current_user_admin());

-- 寫入 (INSERT/UPDATE/DELETE) 只透過 service_role(admin API route)— 不開放 client 直寫。

-- ─────────────────────────────────────────────
-- Seed — 跟 lib/credits.ts 的 CREDIT_COSTS 對齊(phase 21 平衡後的數字)
-- ─────────────────────────────────────────────
insert into public.credit_costs
  (id, amount, label_zh, label_en, description_zh, description_en, category, sort_order)
values
  -- 易經
  ('DIVINE',         5,  '易經主流占卜',        'I Ching main reading',
   '三錢成卦 + AI 完整解說',                      'Three-coin cast + full AI reading',           'iching', 10),
  ('DIVINE_FOLLOWUP', 10, '易經衍伸占卜',        'I Ching follow-up',
   '接續前一輪占卜的延伸解說(讀脈絡 + 較長回覆)', 'Continuation reading (longer + reads context)', 'iching', 20),
  ('PLUM_BLOSSOM',   5,  '梅花易數',            'Plum Blossom',
   '時間起卦 + AI 解卦,跟主流同價',               'Time-cast + AI reading, same as main',         'iching', 30),
  ('DIRECTION_HEX',  6,  '方位卦象合參',        'Direction-Hexagram',
   '羅盤方位 + 完整六爻 + AI 合參解讀',            'Compass + 6-line + combined AI reading',       'iching', 40),
  ('YESNO',          2,  'Yes/No 一卦速答',     'Yes/No quick reading',
   'phase 21 由 1 點漲到 2 點(防 Yes/No 套利收集)', 'Bumped 1→2 in phase 21 (anti-collection-arb)', 'iching', 50),

  -- 塔羅
  ('TAROT',          5,  '塔羅三牌占卜',        'Tarot 3-card',
   '三張牌 + AI 解說',                            '3 cards + AI reading',                          'tarot', 60),
  ('TAROT_FOLLOWUP', 10, '塔羅衍伸占卜',        'Tarot follow-up',
   '接續前一輪占卜的延伸解說',                      'Continuation reading',                          'tarot', 70),
  ('TAROT_5_CARD',   8,  '愛情十字 5 牌',       'Love Cross 5-card',
   '5 張塔羅牌陣',                                 '5-card spread',                                 'tarot', 80),
  ('TAROT_10_CARD',  12, '凱爾特十字 10 牌',    'Celtic Cross 10-card',
   '10 張完整塔羅牌陣',                             '10-card complete spread',                       'tarot', 90),
  ('TAROT_12_CARD',  14, '12 牌(已下架)',     '12-card (retired)',
   '保留以備重啟年度十二宮',                        'Reserved if year-twelve relaunches',           'tarot', 100),

  -- 共用 / 加成
  ('CHAT',           1,  '老師對話一則',        'One chat with the master',
   '結果頁的追問對話',                              'Follow-up chat in result page',                 'shared', 110),
  ('DAILY',          1,  '每日一抽',            'Daily draw',
   '每日一卡 / 每日一卦,同日重抽不再扣',            'Daily card or hexagram, free re-read same day', 'shared', 120),
  ('DEEP_INSIGHT_SURCHARGE', 3, 'Deep Insight 加成', 'Deep Insight surcharge',
   '訂閱戶可選的深度模式加成,套用在主流占卜',        'Subscriber-only deep mode surcharge',           'shared', 130)
on conflict (id) do nothing;
