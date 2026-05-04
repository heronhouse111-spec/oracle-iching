-- ============================================
-- Oracle I Ching - Phase 31: 修 takedown_music_by_moderation 的 admin 檢查
-- ============================================
-- 執行時機:Supabase SQL Editor
-- 前置條件:phase27 / phase30 已跑過
-- 此腳本可重複執行
--
-- Bug:
--   原 takedown_music_by_moderation() 內檢查 is_current_user_admin(),
--   但這支唯一的呼叫端是 /api/admin/music/moderation(用 service_role
--   client 呼叫 RPC,auth.uid() 是 null) → is_current_user_admin() 永遠回 false
--   → 直接 raise NOT_ADMIN,沒人能用後台下架功能。
--
-- 修法:
--   把 SQL 內的 is_current_user_admin() 檢查拿掉。
--   API /api/admin/music/moderation 已經用 assertAdmin() 把關了,
--   service_role 的 RPC 呼叫不需要 SQL 再檢一次(且實際上做不到)。

create or replace function public.takedown_music_by_moderation(
  p_admin_id uuid,
  p_music_id uuid,
  p_reason   text default 'moderation_violation'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
  v_total_refund int := 0;
  v_total_clawback int := 0;
  v_buyer record;
begin
  -- 注意:這支只能透過 service_role(後端 admin API)呼叫,
  -- API 端用 assertAdmin() 把關。SQL 內不再檢查 is_current_user_admin
  -- 因為 service_role 的 auth.uid() 是 null,該函式永遠回 false。

  select creator_id into v_creator_id
    from public.generated_music where id = p_music_id;

  for v_buyer in
    select user_id, points_paid, creator_payout
      from public.music_collections
     where music_id = p_music_id
  loop
    perform public.add_credits(
      v_buyer.user_id, v_buyer.points_paid, 'refund_music_moderation',
      p_music_id, jsonb_build_object('reason', p_reason)
    );
    v_total_refund := v_total_refund + v_buyer.points_paid;
    v_total_clawback := v_total_clawback + v_buyer.creator_payout;
  end loop;

  if v_creator_id is not null and v_total_clawback > 0 then
    update public.profiles
       set credits_balance = credits_balance - v_total_clawback
     where id = v_creator_id;

    insert into public.credit_transactions
      (user_id, delta, balance_after, reason, reference_id, metadata)
    select
      v_creator_id, -v_total_clawback,
      (select credits_balance from public.profiles where id = v_creator_id),
      'forfeit_music_moderation',
      p_music_id,
      jsonb_build_object('admin', p_admin_id, 'reason', p_reason);
  end if;

  update public.generated_music
     set visibility = 'removed_by_moderation',
         moderation_status = 'rejected',
         moderation_notes = p_reason
   where id = p_music_id;

  return jsonb_build_object(
    'success', true,
    'total_refund', v_total_refund,
    'creator_clawback', v_total_clawback
  );
end;
$$;
