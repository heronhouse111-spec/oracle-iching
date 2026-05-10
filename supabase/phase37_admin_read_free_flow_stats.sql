-- ============================================
-- Phase 37 — Admin SELECT policies for free-flow stat sources
-- ============================================
-- 後台「總占卜次數 / 今日 / 訪客 vs 會員 / 30 日趨勢」需要讀以下四張表,
-- 但它們都沒有「admin 全讀」policy(只有「user 看自己」或完全沒 policy),
-- 所以 admin 走 cookie session 進來時會被 RLS 擋成空集合,dashboard 顯示 0。
--
-- 這個 migration 補上 phase2_admin.sql 同樣風格的 admin select policy,
-- 用 public.is_current_user_admin() helper 判斷。其他 policy 維持不變
-- (使用者本人仍然只能看自己;訪客寫入仍只走 service_role RPC)。
--
-- Safe to run multiple times — drop policy if exists + create policy。
--
-- 套用方式:整段貼進 Supabase Dashboard SQL Editor 執行。
-- ============================================

-- ── credit_transactions ────────────────────────
-- (phase5_credits.sql 既有「Users can view own credit transactions」保留)
drop policy if exists "Admins can view all credit transactions"
  on public.credit_transactions;
create policy "Admins can view all credit transactions"
  on public.credit_transactions for select
  using (public.is_current_user_admin());

-- ── daily_checkins ─────────────────────────────
-- (phase34_daily_checkin_history_unlock.sql 既有「Users can view own daily checkins」保留)
drop policy if exists "Admins can view all daily checkins"
  on public.daily_checkins;
create policy "Admins can view all daily checkins"
  on public.daily_checkins for select
  using (public.is_current_user_admin());

-- ── guest_yesno_log ────────────────────────────
-- (phase35 完全沒 policy — service_role 直寫直讀,user 看不到)
-- admin 加 select 不影響寫入路徑(寫入仍走 service_role RPC)
drop policy if exists "Admins can view guest yesno log"
  on public.guest_yesno_log;
create policy "Admins can view guest yesno log"
  on public.guest_yesno_log for select
  using (public.is_current_user_admin());

-- ── guest_daily_log ────────────────────────────
drop policy if exists "Admins can view guest daily log"
  on public.guest_daily_log;
create policy "Admins can view guest daily log"
  on public.guest_daily_log for select
  using (public.is_current_user_admin());

-- 驗證:登入 admin 後執行下列任一條都應該回 > 0(若實際有資料)
--   select count(*) from public.credit_transactions where reason = 'spend_yesno';
--   select count(*) from public.daily_checkins where used_at is not null;
--   select count(*) from public.guest_yesno_log;
--   select count(*) from public.guest_daily_log;
