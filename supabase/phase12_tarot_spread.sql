-- ============================================
-- Phase 12 — Tarot Spread Identifier
-- ============================================
-- Phase 3 加了 tarot_cards jsonb,但只支援過去/現在/未來三牌。
-- 多牌陣上線後,光看 cards 數量無法區分「三牌時間軸」與「二選一」(都是 3 張),
-- 之後 /r/[id] 與首頁 hydrate 也需要原始 spread 才能渲染正確的位置標籤。
--
-- 新增:
--   tarot_spread_id text — 對應 data/spreads.ts 的 Spread.id(three-card / two-options /
--   love-cross / celtic-cross / year-twelve)
--
-- 既有資料 backfill 為 'three-card' (Phase 3 之前唯一支援的牌陣)。
--
-- Safe to run multiple times.
-- ============================================

alter table public.divinations
  add column if not exists tarot_spread_id text;

-- 既有 tarot 紀錄都來自三牌 — backfill 一次,讀取端就不必處理 null
update public.divinations
  set tarot_spread_id = 'three-card'
  where divine_type = 'tarot'
    and tarot_spread_id is null;

-- 雖然不強制 NOT NULL(易經紀錄沒值),但塔羅紀錄必須有 spread_id
alter table public.divinations
  drop constraint if exists divinations_tarot_spread_required_check;

alter table public.divinations
  add constraint divinations_tarot_spread_required_check check (
    divine_type <> 'tarot' or tarot_spread_id is not null
  );

-- 備註:
-- * RLS policies 不需改 — 都依 user_id / is_public / is_admin 判斷,新欄位透明。
-- * saveDivination.ts 同步改:tarot 分支多帶 tarot_spread_id。
-- * /r/[id] 與 / 主流程 hydrate 都要讀 tarot_spread_id 還原牌陣。
