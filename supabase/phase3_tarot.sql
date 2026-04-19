-- ============================================
-- Phase 3 — Tarot Support
-- ============================================
-- divinations 表原本只為易經設計 (hexagram_number / primary_lines NOT NULL)。
-- 加塔羅之後這兩欄對塔羅紀錄沒意義,必須放寬 NOT NULL 約束,
-- 並加上:
--   1. divine_type ('iching' | 'tarot') — 辨識是哪種占卜
--   2. tarot_cards jsonb — 存三張牌 [{ cardId, position, isReversed }]
-- 既有資料 backfill 為 'iching'。
--
-- Safe to run multiple times (if not exists / drop+create where可).
-- ============================================

-- ── 1. 加 divine_type ───────────────────────────
alter table public.divinations
  add column if not exists divine_type text not null default 'iching';

-- 先移除舊 check(如果存在),再重建成含 tarot 的版本
alter table public.divinations
  drop constraint if exists divinations_divine_type_check;

alter table public.divinations
  add constraint divinations_divine_type_check
  check (divine_type in ('iching', 'tarot'));

-- ── 2. 加 tarot_cards jsonb ─────────────────────
-- 結構:[{ "cardId": "major-00-fool", "position": "past", "isReversed": false }, ...]
alter table public.divinations
  add column if not exists tarot_cards jsonb;

-- ── 3. 放寬易經欄位的 NOT NULL 約束(塔羅紀錄無值)─
-- 直接 drop not null(這操作對既有易經資料無副作用,它們還是有值)
alter table public.divinations
  alter column hexagram_number drop not null;

alter table public.divinations
  alter column primary_lines drop not null;

-- ── 4. 一致性檢查:依 divine_type 要求對應欄位非 NULL ──
-- 易經:hexagram_number + primary_lines 必備
-- 塔羅:tarot_cards 必備
alter table public.divinations
  drop constraint if exists divinations_type_fields_check;

alter table public.divinations
  add constraint divinations_type_fields_check check (
    (divine_type = 'iching' and hexagram_number is not null and primary_lines is not null)
    or
    (divine_type = 'tarot' and tarot_cards is not null)
  );

-- ── 5. 既有資料 backfill (保險起見 — default 已處理新 row) ──
update public.divinations
  set divine_type = 'iching'
  where divine_type is null;

-- ── 6. Index for divine_type filtering ──────────
create index if not exists divinations_divine_type_idx
  on public.divinations (divine_type);

-- 備註:
-- * RLS policies (Users can view/insert/update/delete own + Public readable + Admin read all)
--   全部不需改動 — 它們是依 user_id / is_public / is_admin 做判斷,對新欄位透明。
-- * saveDivination.ts 要同步改:塔羅走 tarot 分支,填 tarot_cards + divine_type='tarot',
--   hexagram_number / primary_lines 都傳 null。
