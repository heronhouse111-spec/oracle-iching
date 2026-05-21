-- ============================================
-- Phase 2 — Public Share (社交分享 v2)
-- ============================================
-- 加上:
--   1. divinations.is_public 欄位 (default false)
--   2. "Public divinations readable by anyone" RLS policy
--      (讓未登入訪客也能讀 is_public=true 的卦,好讓 /r/[id] 公開頁 + OG image 產得出來)
--   3. index on (is_public, created_at) — 之後如果要做 "熱門分享" 再用
--
-- 注意:UPDATE 還是只有 owner 能做(由原本的 profiles owner policy 控),
-- 所以只有占卜者本人能把自己的卦翻成 public / 撤回。
--
-- Safe to run multiple times (uses if not exists / drop+create).
-- ============================================

-- ── 1. is_public 欄位 ────────────────────────
alter table public.divinations
  add column if not exists is_public boolean not null default false;

-- 輕量 index,方便未來拉「公開占卜列表」
create index if not exists divinations_is_public_created_at_idx
  on public.divinations (is_public, created_at desc)
  where is_public = true;

-- ── 2. 公開讀 RLS policy ─────────────────────
-- 任何角色(含未登入的 anon)都能讀 is_public=true 的 rows
drop policy if exists "Public divinations are readable by anyone"
  on public.divinations;

create policy "Public divinations are readable by anyone"
  on public.divinations for select
  to anon, authenticated
  using (is_public = true);

-- 備註:
-- * 原有 "Users can view own divinations" policy 依然存在,且會繼續作用,
--   這邊新的 policy 是 OR 關係 — 登入者讀自己 + 任何人讀 is_public。
-- * admin 的 "Admins can view all divinations" policy 也還在,跟這個共存。

-- ── 3. UPDATE policy(讓 owner 能翻 is_public)─────
-- 原本 schema.sql 只寫了 SELECT / INSERT / DELETE policy,漏了 UPDATE。
-- 沒這條的話,.update({ is_public: true }) 會被 RLS 靜默擋掉
-- (supabase-js 對 RLS-blocked update 不會 throw,只 return empty data),
-- UI 樂觀顯示「已公開」但 DB 沒動,/r/{id} 讀不到 → 404。
drop policy if exists "Users can update own divinations"
  on public.divinations;

create policy "Users can update own divinations"
  on public.divinations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
