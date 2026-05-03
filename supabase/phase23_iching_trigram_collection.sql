-- Phase 23: Iching trigram (八卦) collection
--
-- 把後天八卦(8 卦)當成獨立的收藏分類,跟既有的 64 卦 hexagram 分開:
--   - collection_type = 'iching_trigram'
--   - cardId = 3-bit code('111' = 乾、'000' = 坤、'100' = 震、...)
--   - 來源:目前只有方位卦象合參(direction-hexagram)會收
--
-- 為什麼跟 'iching' 分開:現有 iching_8/25/40/64 里程碑是 distinct_count,
--   若 trigram 共用同一 collection_type,8 個 trigram 會灌進同一個分母,
--   可能讓 iching_64「易經大師」提早觸發。獨立分類後互不干擾。
--
-- 對應程式:
--   - lib/cardCollection.ts → CollectionType 已新增 'iching_trigram'
--   - app/api/iching/direction-hexagram/route.ts → 在收 hexagram 後再記一次 trigram
--   - app/iching/hexagrams/HexagramsIndexView.tsx → 八卦速覽用 owned set 套灰階
--
-- 不需要動 phase20 的 schema(user_collections / collection_milestone_configs
-- 兩個表的 collection_type 都是 TEXT 沒 enum 約束,直接寫新值即可)。

insert into public.collection_milestone_configs
  (id, collection_type, kind, threshold, param, reward_credits,
   label_zh, label_en, label_ja, label_ko, sort_order)
values
  ('iching_trigram_4', 'iching_trigram', 'distinct_count', 4, null, 5,
   '八卦過半', 'Half the Trigrams', '八卦過半', '팔괘 절반', 10),
  ('iching_trigram_8', 'iching_trigram', 'distinct_count', 8, null, 20,
   '八卦全收', 'All Eight Trigrams', '八卦全収', '팔괘 전체', 20)
on conflict (id) do nothing;
