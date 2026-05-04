-- ============================================
-- Oracle I Ching - Phase 29: 30 首種子歌指派假創作者名
-- ============================================
-- 執行時機:Supabase SQL Editor
-- 前置條件:phase27_music_generation.sql + phase28_music_localized_titles.sql 已跑過
--           且 30 首種子歌已生成(seed-music.mjs --apply --seed-only)
-- 此腳本可重複執行
--
-- 目的:讓平台種子歌看起來像其他使用者創作的(社群感),
--       但 is_seed=true 仍保留(內部標記,collect_music 仍走「不付分潤」路徑)。
--
-- 名字混合三種風格,讓清單看起來自然:
--   - 中文古典(冥想/神秘/東方類)
--   - 現代英文 handle(自然/夢境/專注類)
--   - 日韓羅馬拼音(增加多元性)


update public.generated_music
   set creator_display_name = case title
     -- 冥想 (5)
     when 'Misty Forest Dawn'        then '月見子'
     when 'Tibetan Bowl Mantra'      then '檀香居士'
     when 'Morning Light Meditation' then '阿青'
     when 'Forest Heart Stillness'   then '寒山客'
     when 'Crystal Bowl Serenity'    then '妙音禪'

     -- 神秘 (5)
     when 'Oracle Whisper'           then '玄武書'
     when 'Divination Hour'          then '紫檀香'
     when 'Ancient Temple Hall'      then '鐘靈'
     when 'Foggy Forest Night'       then 'nightfall_jp'
     when 'Glass Crystal Echoes'     then '觀自在'

     -- 自然 (5)
     when 'Forest Stream'            then '流螢草堂'
     when 'Gentle Rainfall'          then 'blueforest'
     when 'Mountain Mist'            then '雲深處'
     when 'Ocean Murmur'             then 'sleepwave'
     when 'Bamboo Wind Chimes'       then 'arashi'

     -- 東方 (5)
     when 'Guzheng Reverie'          then '古韻齋主'
     when 'Shakuhachi Stillness'     then 'yumi.k'
     when 'Imperial Court Echo'      then '紫禁謎'
     when 'Zen Garden Breath'        then 'kazuto'
     when 'Tibetan Temple Chant'     then '般若行者'

     -- 專注 (5)
     when 'Reading in Rain'          then '子夜書房'
     when 'Minimal Focus'            then 'ambient_soul'
     when 'Coffee Shop Jazz'         then 'linwen'
     when 'Library Silence'          then '拾月'
     when 'Deep Work Beats'          then 'moonwhisperer'

     -- 夢境 (5)
     when 'Cloud Drift'              then '雲遊禪人'
     when 'Cosmic Lullaby'           then '星塵子'
     when 'Music Box Cradle'         then '小綠'
     when 'Dream Piano'              then '風起兮'
     when 'Lucid Dreaming'           then 'zen_forest'

     else creator_display_name
   end
 where is_seed = true
   and provider = 'platform_seed';


-- ============================================
-- 驗證:
--   select category_id, title, creator_display_name
--     from public.generated_music
--    where is_seed = true
--    order by category_id, title;
--   → 30 列,每首 creator_display_name 應該都有名字(非 null / 非空)
-- ============================================
