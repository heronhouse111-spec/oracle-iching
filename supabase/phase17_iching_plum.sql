-- phase17_iching_plum.sql
--
-- 為 divinations.method 加入 'plum' 合法值,讓「梅花易數時間起卦」可以寫入。
--
-- 原 phase16 的 check constraint 是 method in ('main','yesno','daily','direction-hexagram'),
-- 這支把它擴成包含 'plum'。做法是 drop 後 re-add(沒辦法直接 alter check constraint)。
--
-- credit_transactions.reason 是 free-form text,新加的 'spend_plum' 直接寫入即可,不需 migration。
--
-- 純擴大允許值,完全向後相容。

alter table public.divinations
  drop constraint if exists divinations_method_check;

alter table public.divinations
  add constraint divinations_method_check
  check (method in ('main', 'yesno', 'daily', 'direction-hexagram', 'plum'));
