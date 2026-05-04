-- phase31_iching_two_options_method.sql
--
-- 易經二擇一(雙卦版)— 把它整合進 divinations 表的 method 分流,並新增
-- B 卦的欄位(A 卦走主欄位 hexagram_number / primary_lines / changing_lines /
-- relating_hexagram_number,B 卦走 cast_b_*)。選項標籤共用 phase15 的
-- two_option_a / two_option_b(原本只給 tarot two-options spread 用,現在易經
-- two-options method 也共享同欄)。
--
-- 也新增 credit_costs row IC_TWO_OPTIONS = 10(admin 之後可從 /admin/credit-costs
-- 改價;沒這 row 也不會壞,lib/credits.ts CREDIT_COSTS 是 fallback)。
--
-- 純加欄位 + 放寬約束 + seed,完全向後相容。
-- Safe to run multiple times.

-- ─────────────────────────────────────────────
-- 1. divinations.method 加入 'two-options'
-- ─────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'divinations_method_check'
  ) then
    alter table public.divinations
      drop constraint divinations_method_check;
  end if;
  alter table public.divinations
    add constraint divinations_method_check
    check (method in (
      'main',
      'yesno',
      'daily',
      'direction-hexagram',
      'plum-blossom',
      'two-options'
    ));
end $$;

-- ─────────────────────────────────────────────
-- 2. 新增 cast_b_* 欄位 — 二擇一的 B 卦
-- ─────────────────────────────────────────────
alter table public.divinations
  add column if not exists cast_b_hexagram_number int,
  add column if not exists cast_b_primary_lines jsonb,
  add column if not exists cast_b_changing_lines jsonb,
  add column if not exists cast_b_relating_hexagram_number int;

-- 1..64 範圍校驗(只有 method='two-options' 才會有值,其他占法為 null)
alter table public.divinations
  drop constraint if exists divinations_cast_b_hex_range_check;
alter table public.divinations
  add constraint divinations_cast_b_hex_range_check check (
    (cast_b_hexagram_number is null or (cast_b_hexagram_number between 1 and 64))
    and (cast_b_relating_hexagram_number is null
         or (cast_b_relating_hexagram_number between 1 and 64))
  );

-- 索引:讓 admin 後台「最近的二擇一占卜」列表查詢快(method 已有 index 但跨多 method 時順便加 partial)
create index if not exists divinations_two_options_idx
  on public.divinations (created_at desc)
  where method = 'two-options';

-- ─────────────────────────────────────────────
-- 3. credit_costs seed — IC_TWO_OPTIONS = 10
-- ─────────────────────────────────────────────
insert into public.credit_costs
  (id, amount, label_zh, label_en, description_zh, description_en, category, sort_order)
values
  ('IC_TWO_OPTIONS', 10, '易經二擇一', 'I Ching · A or B Decision',
   'A / B 各擲三錢法成卦,雙卦比對 + 約 600 字 AI 決斷解讀',
   'Three-coin cast for A and B; two-hexagram comparison + ~400-word AI verdict',
   'iching', 35)
on conflict (id) do nothing;

-- 備註:
-- * RLS 不需動 — 跟既有易經欄位同樣是透明欄位,沿用 user_id ownership policy。
-- * lib/saveDivination.ts 在 method='two-options' 時會把 castB 寫進 cast_b_*,
--   選項標籤寫進 two_option_a / two_option_b(共用 phase15 的欄位)。
-- * /history 頁面在 method='two-options' 時會並排渲染兩卦 + A/B 標籤。
