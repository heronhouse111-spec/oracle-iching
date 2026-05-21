-- ============================================
-- Oracle I Ching - Phase 5 (security hardening)
-- ============================================
-- 目的:只允許後端 service_role 呼叫扣點/加點/退點 function,
--       防止登入者從前端直接呼叫 RPC 扣別人的點數。
--
-- 前置條件:phase5_credits.sql 已跑過
-- 此腳本可重複執行
-- ============================================

-- 收回預設的 public / authenticated / anon execute 權限
revoke execute on function public.spend_credits(uuid, integer, text, uuid, jsonb) from public;
revoke execute on function public.spend_credits(uuid, integer, text, uuid, jsonb) from anon;
revoke execute on function public.spend_credits(uuid, integer, text, uuid, jsonb) from authenticated;

revoke execute on function public.add_credits(uuid, integer, text, uuid, jsonb) from public;
revoke execute on function public.add_credits(uuid, integer, text, uuid, jsonb) from anon;
revoke execute on function public.add_credits(uuid, integer, text, uuid, jsonb) from authenticated;

revoke execute on function public.refund_credits(uuid, integer, uuid, text) from public;
revoke execute on function public.refund_credits(uuid, integer, uuid, text) from anon;
revoke execute on function public.refund_credits(uuid, integer, uuid, text) from authenticated;

-- service_role 一律保留 execute(supabase 預設就有,這裡 grant 明示)
grant execute on function public.spend_credits(uuid, integer, text, uuid, jsonb) to service_role;
grant execute on function public.add_credits(uuid, integer, text, uuid, jsonb) to service_role;
grant execute on function public.refund_credits(uuid, integer, uuid, text) to service_role;

-- 驗證:下面兩段都應該回傳 service_role 那列(authenticated 應該看不到 execute)
--
--   select r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_exec
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--     cross join pg_roles r
--    where n.nspname = 'public'
--      and p.proname in ('spend_credits', 'add_credits', 'refund_credits')
--      and r.rolname in ('anon', 'authenticated', 'service_role')
--    order by p.proname, r.rolname;
