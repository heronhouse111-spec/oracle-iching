-- phase17_iching_plum_blossom.sql
--
-- 把 'plum-blossom' 加入 divinations.method 的 check 約束。
-- phase16 留下的 check 只認 ('main', 'yesno', 'daily', 'direction-hexagram')。
--
-- 這支 migration 是純放寬約束,完全向後相容。

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
      'plum-blossom'
    ));
end $$;
