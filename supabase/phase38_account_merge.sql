-- ============================================================
-- phase38_account_merge.sql
-- 帳號合併:把「來源帳號 source」的點數/訂閱/紀錄併入「保留帳號 keep」。
--
-- ⚠️ 重要:
--   - 本檔的 DDL(建表、加欄位、建 function)是安全的 —— 套用後只是新增「待命」物件,
--     不會自動合併任何帳號。實際合併只在 merge_accounts() 被「呼叫」時才發生。
--   - merge_accounts() 動到點數與訂閱,**務必先在 staging 用測試帳號完整跑過**再於正式環境呼叫。
--   - 設計依據見 repo 內 ACCOUNT_MERGE_DESIGN.md。
--
-- 分工:
--   - 本 function 只處理「資料層」(點數、訂閱狀態、各 user 資料表搬移)。
--   - auth.users 身分(Google/Apple identity)的刪除與重新綁定,由 API 層處理
--     (因為要先驗證發起者同時握有兩邊 session,且刪 auth.users 會 cascade)。
-- ============================================================

-- 1. 稽核表:每次合併留一筆不可變紀錄
create table if not exists public.account_merges (
  id              uuid primary key default uuid_generate_v4(),
  keep_user_id    uuid not null,
  source_user_id  uuid not null,
  source_email    text,
  credits_moved   integer not null default 0,
  kept_subscription text,                 -- 'keep' | 'source'
  detail          jsonb,
  created_at      timestamptz not null default now()
);
comment on table public.account_merges is
  '帳號合併稽核紀錄。每次 merge_accounts() 成功寫一筆,不可逆,供日後查證。';

-- 2. profiles 標記:被合併掉的來源帳號指向保留帳號
alter table public.profiles
  add column if not exists merged_into uuid references auth.users(id);
comment on column public.profiles.merged_into is
  '若非 null,表示此帳號已被合併進 merged_into 指向的帳號,不應再有點數/訂閱。';

-- 3. 合併 function
--    p_keep              要保留的帳號(通常是目前登入中的帳號)
--    p_source            要併入並停用的來源帳號
--    p_keep_subscription 'keep' = 保留 keep 的訂閱; 'source' = 改用 source 的訂閱
--                        (未被選中的那份訂閱要由 API 層去金流取消,本 function 不碰金流)
create or replace function public.merge_accounts(
  p_keep uuid,
  p_source uuid,
  p_keep_subscription text default 'keep'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src_credits  integer;
  v_src_email    text;
  v_src_status   text;
  v_src_plan     text;
  v_src_started  timestamptz;
  v_src_exp      timestamptz;
  v_keep_new_balance integer;
begin
  -- ---- 前置檢查 ----
  if p_keep is null or p_source is null then
    raise exception 'merge_accounts: keep/source 不可為 null';
  end if;
  if p_keep = p_source then
    raise exception 'merge_accounts: 不可把帳號合併進自己';
  end if;
  if p_keep_subscription not in ('keep', 'source') then
    raise exception 'merge_accounts: p_keep_subscription 必須是 keep 或 source';
  end if;

  -- 鎖兩個 profile,避免併發重複合併
  perform 1 from public.profiles where id in (p_keep, p_source) for update;

  -- 讀來源資料
  select credits_balance, subscription_status, subscription_plan,
         subscription_started_at, subscription_expires_at
    into v_src_credits, v_src_status, v_src_plan, v_src_started, v_src_exp
    from public.profiles where id = p_source;
  if not found then raise exception 'merge_accounts: source profile % 不存在', p_source; end if;

  -- keep 必須存在,且兩邊都還沒被合併過
  perform 1 from public.profiles where id = p_keep;
  if not found then raise exception 'merge_accounts: keep profile % 不存在', p_keep; end if;
  if exists (select 1 from public.profiles where id in (p_keep, p_source) and merged_into is not null) then
    raise exception 'merge_accounts: 其中一個帳號已被合併過,拒絕重複合併';
  end if;

  select email into v_src_email from auth.users where id = p_source;

  -- ---- 1) 點數:相加 + 雙向流水帳 ----
  --   credit_transactions 欄位:delta(正加負扣)、balance_after(NOT NULL,當下結餘)
  if coalesce(v_src_credits, 0) <> 0 then
    update public.profiles
       set credits_balance = credits_balance + v_src_credits
     where id = p_keep
     returning credits_balance into v_keep_new_balance;
    insert into public.credit_transactions (user_id, delta, balance_after, reason, reference_id)
    values (p_keep,   v_src_credits,  v_keep_new_balance, 'account_merge_in',  p_source),
           (p_source, -v_src_credits, 0,                  'account_merge_out', p_keep);
    update public.profiles set credits_balance = 0 where id = p_source;
  end if;

  -- ---- 2) 訂閱:依使用者選擇 ----
  if p_keep_subscription = 'source' then
    update public.profiles
       set subscription_status     = v_src_status,
           subscription_plan       = v_src_plan,
           subscription_started_at = v_src_started,
           subscription_expires_at = v_src_exp
     where id = p_keep;
  end if;
  -- 來源帳號訂閱狀態收斂為 canceled(實際金流取消由 API 層處理)
  update public.profiles set subscription_status = 'canceled' where id = p_source;

  -- ---- 3) 簡單 re-point(該表沒有 per-user 複合鍵衝突問題) ----
  update public.divinations         set user_id    = p_keep where user_id    = p_source;
  update public.credit_grants       set user_id    = p_keep where user_id    = p_source;
  update public.subscriptions       set user_id    = p_keep where user_id    = p_source;
  update public.play_purchases      set user_id    = p_keep where user_id    = p_source; -- purchase_token 為全域 unique,安全
  update public.generated_music     set creator_id = p_keep where creator_id = p_source;
  update public.music_reports       set reporter_id= p_keep where reporter_id= p_source;
  -- credit_transactions:除了上面兩筆 audit,其餘流水也歸戶到 keep
  update public.credit_transactions set user_id = p_keep
   where user_id = p_source and reason <> 'account_merge_out';

  -- ---- 4) 複合主鍵的表:用 UPDATE...WHERE NOT EXISTS + DELETE 去重 ----
  --     不需逐欄列出,也不會撞唯一鍵。衝突時保留 keep 既有那筆。

  -- user_collections PK(user_id, collection_type, card_id):衝突時把張數相加
  update public.user_collections k
     set obtain_count = k.obtain_count + s.obtain_count
    from public.user_collections s
   where k.user_id = p_keep and s.user_id = p_source
     and k.collection_type = s.collection_type and k.card_id = s.card_id;
  update public.user_collections s set user_id = p_keep
   where s.user_id = p_source
     and not exists (
       select 1 from public.user_collections k
        where k.user_id = p_keep and k.collection_type = s.collection_type and k.card_id = s.card_id);
  delete from public.user_collections where user_id = p_source;

  -- collection_milestones PK(user_id, milestone_id):衝突保留既有
  update public.collection_milestones s set user_id = p_keep
   where s.user_id = p_source
     and not exists (
       select 1 from public.collection_milestones k
        where k.user_id = p_keep and k.milestone_id = s.milestone_id);
  delete from public.collection_milestones where user_id = p_source;

  -- daily_checkins PK(user_id, checkin_date):衝突保留既有(streak 以 keep 為準)
  update public.daily_checkins s set user_id = p_keep
   where s.user_id = p_source
     and not exists (
       select 1 from public.daily_checkins k
        where k.user_id = p_keep and k.checkin_date = s.checkin_date);
  delete from public.daily_checkins where user_id = p_source;

  -- history_unlocks PK(user_id, divination_id)
  update public.history_unlocks s set user_id = p_keep
   where s.user_id = p_source
     and not exists (
       select 1 from public.history_unlocks k
        where k.user_id = p_keep and k.divination_id = s.divination_id);
  delete from public.history_unlocks where user_id = p_source;

  -- promo_code_redemptions:依 (user_id, promo_code_id) 去重(避免同碼重複領)
  update public.promo_code_redemptions s set user_id = p_keep
   where s.user_id = p_source
     and not exists (
       select 1 from public.promo_code_redemptions k
        where k.user_id = p_keep and k.promo_code_id = s.promo_code_id);
  delete from public.promo_code_redemptions where user_id = p_source;

  -- music_collections PK(user_id, music_id)
  update public.music_collections s set user_id = p_keep
   where s.user_id = p_source
     and not exists (
       select 1 from public.music_collections k
        where k.user_id = p_keep and k.music_id = s.music_id);
  delete from public.music_collections where user_id = p_source;

  -- music_plays PK(user_id, music_id, played_date)
  update public.music_plays s set user_id = p_keep
   where s.user_id = p_source
     and not exists (
       select 1 from public.music_plays k
        where k.user_id = p_keep and k.music_id = s.music_id and k.played_date = s.played_date);
  delete from public.music_plays where user_id = p_source;

  -- music_creator_follows PK(follower_id, creator_id):兩個 user 欄位都要 re-point + 去自我追蹤
  update public.music_creator_follows s set follower_id = p_keep
   where s.follower_id = p_source
     and not exists (
       select 1 from public.music_creator_follows k
        where k.follower_id = p_keep and k.creator_id = s.creator_id);
  delete from public.music_creator_follows where follower_id = p_source;
  update public.music_creator_follows s set creator_id = p_keep
   where s.creator_id = p_source
     and not exists (
       select 1 from public.music_creator_follows k
        where k.creator_id = p_keep and k.follower_id = s.follower_id);
  delete from public.music_creator_follows where creator_id = p_source;
  -- 合併後若產生「自己追蹤自己」就刪掉
  delete from public.music_creator_follows where follower_id = creator_id;

  -- ---- 5) 標記來源帳號已合併 ----
  update public.profiles set merged_into = p_keep where id = p_source;

  -- ---- 6) 稽核紀錄 ----
  insert into public.account_merges
    (keep_user_id, source_user_id, source_email, credits_moved, kept_subscription, detail)
  values
    (p_keep, p_source, v_src_email, coalesce(v_src_credits,0), p_keep_subscription,
     jsonb_build_object('source_sub_status', v_src_status, 'source_sub_expires', v_src_exp));

  return jsonb_build_object(
    'ok', true,
    'keep', p_keep,
    'source', p_source,
    'credits_moved', coalesce(v_src_credits,0),
    'kept_subscription', p_keep_subscription
  );
end;
$$;

comment on function public.merge_accounts(uuid, uuid, text) is
  '把 source 帳號的點數/訂閱/紀錄併入 keep 帳號(資料層)。auth 身分處理在 API 層。呼叫前務必 staging 測試。';

-- 權限:只允許 service_role 呼叫(API 層用 service role,經身分驗證後才呼叫)。
revoke all on function public.merge_accounts(uuid, uuid, text) from public, anon, authenticated;
