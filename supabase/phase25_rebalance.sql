-- Phase 25: 經濟平衡微調(2026-05)
--
-- 兩項調整:
--   1. CHAT 1 → 2 點:長對話 context 累積後 token 成本逼近 1 點收入
--      (毛利掉到 75%),漲到 2 點能守住 90%+ 毛利。
--   2. iching_8 獎勵 10 → 5:現行設定下用 DAILY (1 點/天) 8~14 天就能
--      集滿 8 卦解鎖 10 點 = 淨賺 0~2 點(套利漏洞)。獎勵砍半後
--      變成「投入 8~14、獎勵 5」,維持鼓勵感但不再是淨賺。
--
-- 同步要動的:
--   - lib/credits.ts CREDIT_COSTS.CHAT          ✅ 已改
--   - lib/uiCreditCosts.ts UI_CREDIT_COSTS.CHAT  ✅ 已改
--   - phase22 / phase20 seed                     ✅ 已改(只影響新環境)
--   - 線上 DB(本檔)                              ⬇️ 跑下面

update public.credit_costs
set amount = 2,
    description_zh = '結果頁的追問對話(長對話 context 成本提升)',
    description_en = 'Follow-up chat (long context aware)'
where id = 'CHAT';

update public.collection_milestone_configs
set reward_credits = 5
where id = 'iching_8';
