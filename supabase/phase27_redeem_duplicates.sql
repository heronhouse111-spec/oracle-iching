-- Phase 27: 重複卡兌換點數
--
-- 玩家可以拿同一張卡的 10 張重複(obtain_count >= 10)兌換 10 點。
-- 兌換比率(每 10 張幾點)走 credit_costs CMS,admin 可調(預設 10)。
--
-- 設計重點:
--   1. RPC redeem_duplicate_cards() — atomic:扣 obtain_count + 加點 + 流水
--      (不刪 row,obtain_count 可降到 0,但 ✓ 收藏記錄保留)
--   2. p_credits_per_set 由 API route 傳進來(透過 getCreditCost 拿 cache 過的值),
--      RPC 不直接 join credit_costs — 維持 RPC 純粹、cache 行為一致
--   3. credit_transactions 自動有一筆 reason='redeem_duplicates' 流水(由 add_credits 寫)
--   4. admin_audit_log 由 API route 另寫(actor=user 自己,action='collection.redeem')
--
-- 為什麼不刪 row(obtain_count→0):
--   `owned` 在前端是「該 card_id 在 user_collections 有 row」決定的,
--   兌完還想保留圖鑑 ✓ 標記。下次再抽到時 record_card_obtained() 的
--   ON CONFLICT UPDATE 會把 0 → 1,行為正確。
--
-- 為什麼不限制 collection_type:
--   phase23 已新增 'iching_trigram',將來可能還有別的 type。
--   這支 RPC 對 collection_type 不做白名單檢查,只要 user_collections
--   讀得到對應 row 就允許兌換(防呆由 API route 的白名單把關)。

-- ─────────────────────────────────────────────
-- 1. credit_costs seed — 兌換比率
-- ─────────────────────────────────────────────
insert into public.credit_costs
  (id, amount, label_zh, label_en, description_zh, description_en, category, sort_order)
values
  ('REDEEM_DUPLICATE_RATE', 10,
   '重複卡兌換比率', 'Duplicate redemption rate',
   '每 10 張同卡重複可換的點數(設 0 等同關閉兌換功能)',
   'Credits per 10 duplicates of the same card (set 0 to disable redemption)',
   'shared', 140)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- 2. RPC — redeem_duplicate_cards
-- ─────────────────────────────────────────────
create or replace function public.redeem_duplicate_cards(
  p_user_id          uuid,
  p_collection_type  text,
  p_card_id          text,
  p_sets             int,
  p_credits_per_set  int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count_before    int;
  v_count_after     int;
  v_credits_total   int;
  v_new_balance     int;
begin
  -- 基本守門
  if p_sets is null or p_sets < 1 then
    raise exception 'INVALID_SETS' using errcode = 'P0001';
  end if;
  if p_sets > 100 then
    -- 防呆上限:單次最多換 100 組(1000 張),避免誤輸入
    raise exception 'SETS_TOO_LARGE' using errcode = 'P0001';
  end if;
  if p_credits_per_set is null or p_credits_per_set < 0 then
    raise exception 'INVALID_RATE' using errcode = 'P0001';
  end if;
  if p_credits_per_set = 0 then
    raise exception 'REDEMPTION_DISABLED' using errcode = 'P0001';
  end if;

  -- 鎖定該 row,讀目前 count
  select obtain_count into v_count_before
    from public.user_collections
   where user_id = p_user_id
     and collection_type = p_collection_type
     and card_id = p_card_id
   for update;

  if v_count_before is null then
    raise exception 'CARD_NOT_OWNED' using errcode = 'P0001';
  end if;

  if v_count_before < p_sets * 10 then
    raise exception 'INSUFFICIENT_DUPLICATES' using errcode = 'P0001';
  end if;

  v_count_after := v_count_before - p_sets * 10;
  v_credits_total := p_sets * p_credits_per_set;

  update public.user_collections
     set obtain_count = v_count_after,
         last_obtained_at = last_obtained_at  -- 不更新 last_obtained_at(兌換不算「再抽到」)
   where user_id = p_user_id
     and collection_type = p_collection_type
     and card_id = p_card_id;

  -- 加點 + 自動寫 credit_transactions(reason='redeem_duplicates')
  v_new_balance := public.add_credits(
    p_user_id,
    v_credits_total,
    'redeem_duplicates',
    null,
    jsonb_build_object(
      'collection_type', p_collection_type,
      'card_id',         p_card_id,
      'sets',            p_sets,
      'rate',            p_credits_per_set,
      'count_before',    v_count_before,
      'count_after',     v_count_after
    )
  );

  return jsonb_build_object(
    'count_before',    v_count_before,
    'count_after',     v_count_after,
    'sets',            p_sets,
    'credits_granted', v_credits_total,
    'new_balance',     v_new_balance
  );
end;
$$;

comment on function public.redeem_duplicate_cards(uuid, text, text, int, int) is
  '重複卡兌換點數。原子:扣 obtain_count + add_credits + 流水。' ||
  '錯誤:CARD_NOT_OWNED / INSUFFICIENT_DUPLICATES / INVALID_SETS / SETS_TOO_LARGE / INVALID_RATE / REDEMPTION_DISABLED。';

-- ─────────────────────────────────────────────
-- 3. /collection 規則文案新增一條 — rule.6 兌換規則
--    admin 可在 /admin/collection-hub 改字 + 翻譯
-- ─────────────────────────────────────────────
insert into public.collection_hub_content
  (id, section, title_zh, title_en, title_ja, title_ko, body_zh, body_en, body_ja, body_ko, link_href, image_slot, sort_order)
values
  ('rule.6', 'rule',
   '重複卡兌換點數', 'Redeem duplicates for credits', '重複カードをポイントに交換', '중복 카드 포인트 교환',
   E'同一張卦象或塔羅牌只要持有滿 10 張(無論來源),都可以在圖鑑頁該卡右下的綠色「↺ 兌換」鈕兌換成點數,預設 10 張 → 10 點(實際比率以圖鑑顯示為準,可由管理員調整)。兌換後該卡持有數 -10,但 ✓ 收藏記錄保留。\n• 卦象:在「易經 64 卦」圖鑑頁兌換,八卦也分開算\n• 塔羅:在「78 張塔羅牌」圖鑑頁兌換',
   E'Once you have 10 duplicates of the same hexagram or tarot card (from any source), tap the green "↺ Redeem" pill at the bottom-right of that card in the encyclopedia. By default 10 cards = 10 credits (the actual rate is shown in-app and can be tuned by admins). The owned count drops by 10 but the ✓ collected badge stays.\n• Hexagrams: redeem from the "I Ching 64 Hexagrams" encyclopedia (the 8 trigrams count separately)\n• Tarot: redeem from the "78 Tarot Cards" encyclopedia',
   E'同じ卦象やタロットカードを 10 枚以上(出処を問わず)持っていれば、図鑑ページの該当カード右下の緑色「↺ 交換」ボタンからポイントに交換できます。デフォルトで 10 枚 = 10 ポイント(実比率はアプリ内表示、管理者調整可)。所持数は -10、収集 ✓ マークは保持されます。\n• 卦象:「易経 64卦」図鑑で交換(八卦は別カウント)\n• タロット:「78枚タロット」図鑑で交換',
   E'같은 괘나 타로 카드를 10장 이상(출처 무관) 보유하면, 도감 페이지의 해당 카드 우측 하단 녹색 "↺ 교환" 버튼으로 포인트로 교환할 수 있습니다. 기본 10장 = 10 포인트(실제 비율은 앱 내 표시, 관리자 조정 가능). 보유 수는 -10이지만 ✓ 수집 표시는 유지됩니다.\n• 괘상: "주역 64괘" 도감에서 교환(팔괘는 별도 집계)\n• 타로: "78장 타로" 도감에서 교환',
   null, null, 115)
on conflict (id) do nothing;
