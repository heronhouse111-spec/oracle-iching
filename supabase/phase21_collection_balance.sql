-- Phase 21: 卡牌收集獎勵下調 + 平衡修正
--
-- 動機:phase20 seed 的 milestone reward 太慷慨,加上 Yes/No 1 點 + 凱爾特 12 點
-- 抽 10 張 + 易經抽到本卦/之卦兩張都算,造成「集滿 = 純印鈔」:
--
--   Yes/No 64 卦 = -64 點,獎勵 +300 = 淨賺 +236
--   凱爾特刷塔羅 78 張 = -200,獎勵 +560 = 淨賺 +360
--
-- 本支 migration 把里程碑獎勵下調到「儀式感金額」(共 250 點 vs 原 860 點),
-- 配合程式碼層面的 yes_no 不算收集 + 易經 method 只記本卦,把套利空間關掉。
--
-- 修改後使用者體驗:
--   - 「天天打開 app 抽 daily」變成集滿最划算的方式 ✓ retention hook
--   - 集滿仍有 fun money(夠買 1-2 包加購的快感)
--   - 不再有人挖洞洗點

update public.collection_milestone_configs set reward_credits = 5   where id = 'iching_8';
update public.collection_milestone_configs set reward_credits = 10  where id = 'iching_25';
update public.collection_milestone_configs set reward_credits = 20  where id = 'iching_40';
update public.collection_milestone_configs set reward_credits = 50  where id = 'iching_64';

update public.collection_milestone_configs set reward_credits = 10  where id = 'tarot_22';
update public.collection_milestone_configs set reward_credits = 20  where id = 'tarot_major_full';
update public.collection_milestone_configs set reward_credits = 10  where id = 'tarot_wands';
update public.collection_milestone_configs set reward_credits = 10  where id = 'tarot_cups';
update public.collection_milestone_configs set reward_credits = 10  where id = 'tarot_swords';
update public.collection_milestone_configs set reward_credits = 10  where id = 'tarot_pentacles';
update public.collection_milestone_configs set reward_credits = 15  where id = 'tarot_50';
update public.collection_milestone_configs set reward_credits = 80  where id = 'tarot_78';

-- 注意:已經領過的 user 不會被回收(collection_milestones.reward_credits 是
-- 領取當下 snapshot)。這是 acceptable — admin 可以個案處理,但不能事後懲罰
-- 已經乖乖玩的玩家。
