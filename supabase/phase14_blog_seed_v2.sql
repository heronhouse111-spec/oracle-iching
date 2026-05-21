-- ============================================
-- Phase 14 — Blog Seed v2 (8 篇新文章)
-- ============================================
-- 在 Phase 13 backfill 的 10 篇之上,再加 8 篇:
--   2 篇平台介紹 (welcome / how-to-use)
--   6 篇易經 + 塔羅主題文章
--
-- 全部直接上架 (published=true),前台 /blog 立即顯示;後台 /admin/blog 也能編輯。
-- 用 ON CONFLICT (slug) DO NOTHING — 重跑這支不會蓋掉之後在後台修改過的版本。
--
-- 前置:Phase 13 必須先跑(blog_posts 表)。
-- ============================================

insert into public.blog_posts (slug, category, published_at, published, title_zh, title_en, excerpt_zh, excerpt_en, body_zh, body_en) values
(
  'welcome-to-tarogram',
  'intro',
  '2026-04-29',
  true,
  $$Tarogram 易問 — 一個結合易經與塔羅的占卜平台$$,
  $$Welcome to Tarogram — Where I Ching Meets Tarot, with AI$$,
  $$一個給認真想透過占卜認識自己的人的平台。雙系統、AI 解盤、跨裝置同步,從一個問題開始。$$,
  $$A divination platform for people who want to know themselves better — dual systems, AI interpretation, cross-device sync. Start with one question.$$,
  ARRAY[
    $$Tarogram(易問)是一個把**易經與塔羅整合在一起**的占卜平台。一個問題,你可以同時或單獨用兩個系統來看 — 易經給你結構與時機,塔羅給你情緒與象徵。AI 老師會把抽到的內容串成一段針對你問題的完整解讀,看完還能繼續跟老師對話、就同一件事再抽一次衍伸占卜。$$,
    $$## 為什麼叫「易問」?$$,
    $$「易」對應易經(《周易》),也是「容易」 — 我們希望占卜對任何人都不再是門檻很高的神祕儀式。「問」對應的是占卜的本質:**所有占卜的起點都是一個誠實的問題**。Tarogram 整個流程的設計都圍繞著「如何幫使用者把心裡那個模糊的疑問變成一個能被回答的問題」。$$,
    $$## 雙系統:易經 + 塔羅$$,
    $$易經的核心是六爻 — 六個位置代表事情發展的六個階段,卦辭與爻辭累積了兩千多年,**特別擅長回答「時機」與「結構」類的問題**(現在能不能去、這份合約簽不簽、怎麼定位自己)。塔羅 78 張牌則像 78 個原型畫面,當幾張牌排成牌陣互相對話,**特別擅長回答「故事」與「情緒」**(對方怎麼想、這段關係的能量、我自己卡在哪)。Tarogram 把兩套都做進來,你可以對同一個問題用兩個系統互相印證 — 通常你會發現它們指向同一個方向,只是角度不同。$$,
    $$## AI 解盤 + 占卜師人格$$,
    $$我們用的是 DeepSeek 模型,中文寫作的細膩度與情感拿捏特別好。系統會把你抽到的牌或卦、你的問題、你選的占卜師人格全部串起來,寫出一段針對你具體情境的解讀(不是固定的牌義朗讀)。占卜師人格目前有「月亮姊」溫柔治癒、「玄機老師」直白嚴師等多個選擇;訂閱戶可解鎖 premium 人格與 Deep Insight 深度模式。$$,
    $$## 適合誰用$$,
    $$Tarogram 適合:**有具體問題想透過占卜思考的人**、想學易經或塔羅但不知道從哪開始的入門者、想把占卜納入日常自我覺察的使用者(每日一卡 / 每日一卦)。我們不是純粹的娛樂工具 — 你會看到 AI 解盤刻意避免具體投資建議、刻意避免說「他/她一定愛你」這類絕對承諾。占卜的真正價值不是給你預言,而是**讓你看清楚自己當下卡在哪裡**。$$
  ]::text[],
  ARRAY[
    $$Tarogram is a divination platform that **brings I Ching and tarot together in one place**. For a single question, you can use either system or both — I Ching gives you structure and timing, tarot gives you emotion and symbol. An AI master weaves what you draw into a reading shaped to your question, and you can keep chatting after, or do a follow-up reading on the same matter.$$,
    $$## Why "易問" (Yiwen)?$$,
    $$"Yi" (易) refers to I Ching and also means "easy" — we want divination to stop being a high-barrier mystical ritual. "Wen" (問) means "to ask", which is the essence of divination: **every reading begins with an honest question**. Tarogram's flow is designed around helping you turn the vague feeling in your chest into a question that can actually be answered.$$,
    $$## Dual systems: I Ching + tarot$$,
    $$I Ching's core is six lines — six positions representing six stages of unfolding. With 2,000+ years of judgment and line texts behind it, it **excels at "timing" and "structural" questions** (should I act now, sign this contract, position myself how). Tarot's 78 cards are 78 archetypal images; when several cards land in a spread and converse, they're **especially powerful for story and emotion** (how do they see this, what's the energy of this bond, where am I stuck). Tarogram includes both — read the same matter through both lenses and you'll usually find they point the same direction from different angles.$$,
    $$## AI interpretation + diviner personas$$,
    $$We use DeepSeek, which handles emotional nuance in Chinese particularly well. The system weaves your drawn cards or hexagram, your question, and your chosen diviner persona into a reading shaped to your specific situation (not a fixed card-meaning recitation). Personas include "Lunar Sister" (gentle, healing) and "Master Xuanji" (direct, strict); premium personas and Deep Insight mode are unlocked with a subscription.$$,
    $$## Who it's for$$,
    $$Tarogram is for: **people with specific questions to think through via divination**, beginners curious about I Ching or tarot but unsure where to start, and those wanting daily self-awareness practice (Daily Card / Daily Hexagram). We're not pure entertainment — the AI deliberately avoids specific investment advice and absolute promises like "they definitely love you". Divination's real value isn't prediction; it's **clarity on where you're stuck right now**.$$
  ]::text[]
),
(
  'how-to-use-tarogram',
  'intro',
  '2026-04-29',
  true,
  $$怎麼用 Tarogram 占卜?從問題到 AI 解盤的完整流程$$,
  $$How to Use Tarogram — The Complete Flow from Question to AI Reading$$,
  $$第一次來 Tarogram?三分鐘看懂從選類別、寫問題、抽卦或牌、到 AI 解讀的完整步驟。$$,
  $$First time on Tarogram? A three-minute walkthrough from category selection to writing your question to drawing cards or hexagrams to AI interpretation.$$,
  ARRAY[
    $$第一次來 Tarogram 不知道從哪裡開始?整個占卜流程其實只有四步,從首頁點下去到看到 AI 解盤大約**三到五分鐘**。本文帶你完整走一遍。$$,
    $$## 第一步:選擇問事類別$$,
    $$首頁有六個類別 — 感情、事業、財運、健康、學業、綜合。**選對類別會讓 AI 知道用哪種語氣與重點解讀**(感情問題會多談關係能量,事業問題會多談行動建議)。如果你的問題跨好幾個領域,選「綜合」最安全。每個類別都附問題靈感範例,卡住時可以參考。$$,
    $$## 第二步:寫下你的問題$$,
    $$這是整個流程**最重要的一步**。問題寫得好,AI 解讀就深;寫得空泛,AI 也只能給你空泛的答案。原則:加 1-2 句背景(不要只寫「感情運」,寫「最近跟交往兩年的對象冷戰中」),問題本身用「什麼能量」「卡在哪裡」「該怎麼做」這類開放式句型,而不是「他愛我嗎」這種 yes/no。$$,
    $$## 第三步:選擇易經或塔羅,抽牌或擲卦$$,
    $$易經有「自動」(系統一鍵擲六爻)與「手動」(自己點擊擲銅錢)兩種模式 — 結果完全等價,選哪個看你想要的儀式感。塔羅則先選牌陣 — 三牌時間軸、二選一、愛情十字、凱爾特十字、年度十二宮 — 再依序翻開每張牌。卦象或牌全部出來後,系統自動進入 AI 解盤畫面。$$,
    $$## 第四步:讀解盤、跟老師對話、衍伸占卜$$,
    $$AI 解盤是 streaming 的,文字會一段段出現。讀完後**強烈建議在下方聊天框跟老師繼續對話** — 多問一兩句、釐清細節、追問「那我具體該怎麼做」,你會得到比一次性解盤多得多的細節。如果同一件事想再從另一個角度看,可以按「衍伸占卜」就同一件事再抽一次,系統會把先前的脈絡帶進去。$$,
    $$## 加值:占卜紀錄、分享、訂閱$$,
    $$登入會員後所有占卜會雲端同步到「占卜紀錄」,跨裝置都看得到;每筆占卜都能產生匿名分享連結,給朋友看不會露你的帳號。訂閱戶解鎖完整歷史、無浮水印分享圖、premium 占卜師、Deep Insight 深度模式。$$
  ]::text[],
  ARRAY[
    $$First time on Tarogram and not sure where to start? The whole flow is just four steps, taking about **three to five minutes** from clicking through to seeing the AI reading. Here's the full walkthrough.$$,
    $$## Step 1: pick your question category$$,
    $$The home page has six categories — Love, Career, Money, Health, Study, General. **Picking the right one tells the AI what tone and focus to use** (Love readings emphasise relational energy; Career readings give more actionable advice). If your question spans several domains, "General" is the safe default. Each category has prompt examples if you're stuck.$$,
    $$## Step 2: write your question$$,
    $$This is **the single most important step**. A well-written question gets a deep reading; a vague one gets a vague answer. The rule: include 1-2 sentences of context (not "love" but "in a cold-war with my 2-year partner"), and frame the question with "what energy", "where am I stuck", or "what should I do" — open-ended phrasing, not yes/no.$$,
    $$## Step 3: choose I Ching or tarot, then draw$$,
    $$I Ching has Auto (system tosses six lines in one click) and Manual (you click to toss each coin) — the results are identical; pick based on the ritual feel you want. Tarot starts with picking a spread — Three-Card Timeline, Two Options, Love Cross, Celtic Cross, Yearly 12-House — then you reveal cards one by one. Once everything is laid out, the system auto-advances to the AI reading.$$,
    $$## Step 4: read, chat with the master, follow up$$,
    $$The AI reading streams in paragraph by paragraph. After it finishes, **we strongly recommend keeping the conversation going in the chat box** — ask one or two follow-ups, clarify details, push for "so what should I actually do" — you'll get far more nuance than a one-shot reading. Want to look at the same matter from another angle? Hit "follow-up reading" to draw again on the same question; the system carries the prior context forward.$$,
    $$## Extras: history, sharing, subscription$$,
    $$Sign in and all your readings sync to "History" across devices. Each reading can generate an anonymous share link — friends can see it without your account info. Subscribers unlock unlimited history, watermark-free share images, premium personas, and Deep Insight mode.$$
  ]::text[]
),
(
  'iching-beginner-yinyang-lines',
  'intro',
  '2026-04-28',
  true,
  $$易經入門:六爻、陰陽、卦象從零開始$$,
  $$I Ching Basics — Six Lines, Yin and Yang, from Zero$$,
  $$看到 ䷀ 跟 ䷁ 兩個怪符號完全不知道是什麼?從最基本的陰陽爻開始,三分鐘看懂六十四卦怎麼來的。$$,
  $$䷀ and ䷁ look like alien symbols? Start from yin and yang lines — in three minutes you'll see how the 64 hexagrams emerge.$$,
  ARRAY[
    $$易經第一眼看起來最讓人卡住的就是那些「橫線符號」。其實規則只有一個:**陰爻、陽爻**,兩種而已,所有 64 卦都是這兩種爻的不同組合。本文從最底層帶你建立 mental model,看完就能讀懂任何一個卦的結構。$$,
    $$## 兩個基本元素:陰爻、陽爻$$,
    $$**陽爻**:一條完整的橫線(——),代表主動、剛、明、進。**陰爻**:中間斷開的橫線(— —),代表接受、柔、暗、靜。陽不等於「好」、陰不等於「壞」,它們是一對互補的能量(就像白天與黑夜、行動與休息),少了一邊都不行。所有易經占卜的起點都是「擲出一條爻 = 陽爻或陰爻」。$$,
    $$## 三爻成卦:八個基本卦$$,
    $$把三條爻疊在一起就形成一個三爻卦,三爻有 2³ = **八種組合**,稱為「八卦」:乾(☰天)、兌(☱澤)、離(☲火)、震(☳雷)、巽(☴風)、坎(☵水)、艮(☶山)、坤(☷地)。每個三爻卦對應一種自然現象與一組能量特性。**這八個就是整個易經的字母表**,記住它們其他就好理解。$$,
    $$## 兩兩相重:六十四卦$$,
    $$把八卦兩兩重疊(上面一個三爻卦 + 下面一個三爻卦),就得到 8 × 8 = **64 卦**。例如:乾上 + 乾下 = 第 1 卦「乾為天」(䷀,六條都是陽爻);坤上 + 坤下 = 第 2 卦「坤為地」(䷁,六條都是陰爻)。卦象 Unicode 字元(䷀..䷿)對應的就是這 64 個圖形,每個都是獨一無二的「能量配方」。$$,
    $$## 怎麼讀懂卦象$$,
    $$看到一個卦,先看**從下到上六條爻的陰陽分布**(易經習慣由下往上讀,因為「事情從根基長上來」)。再看**上下兩個三爻卦是什麼**(例如上水下火 = 既濟、上火下水 = 未濟)。最後讀**卦辭**(整個卦的總體訊息)和**爻辭**(每一爻位的具體訊息)。Tarogram 的 64 卦完整介紹頁可以一卦一卦慢慢看。$$
  ]::text[],
  ARRAY[
    $$The first thing that trips up I Ching beginners is those horizontal-line symbols. The rule is actually simple: there are only **yin lines and yang lines**, and every one of the 64 hexagrams is just a combination of these two. This article builds the mental model from the bottom up so you can read any hexagram's structure.$$,
    $$## Two basic elements: yin and yang lines$$,
    $$**Yang line**: an unbroken horizontal stroke (——), representing active, firm, bright, advancing. **Yin line**: a broken horizontal stroke (— —), representing receptive, yielding, dim, still. Yang doesn't mean "good" and yin doesn't mean "bad" — they're complementary energies (like day and night, action and rest), and you can't have one without the other. Every I Ching reading starts with "toss a line: yang or yin".$$,
    $$## Three lines make a trigram: the eight basics$$,
    $$Stack three lines together and you get a trigram. Three lines have 2³ = **eight combinations**, called "the eight trigrams": Qian (☰ Heaven), Dui (☱ Lake), Li (☲ Fire), Zhen (☳ Thunder), Xun (☴ Wind), Kan (☵ Water), Gen (☶ Mountain), Kun (☷ Earth). Each trigram maps to a natural phenomenon and a set of energetic qualities. **These eight are the alphabet of I Ching** — once you know them, the rest gets easy.$$,
    $$## Stack two trigrams: the 64 hexagrams$$,
    $$Stack any two trigrams (one upper + one lower) and you get 8 × 8 = **64 hexagrams**. Example: Qian above + Qian below = Hexagram 1 "The Creative" (䷀, all six yang); Kun above + Kun below = Hexagram 2 "The Receptive" (䷁, all six yin). The Unicode characters ䷀..䷿ correspond to these 64 patterns; each is a unique "energy recipe".$$,
    $$## How to read a hexagram$$,
    $$Look first at **the yin/yang distribution from bottom to top** (I Ching reads bottom up — things grow from roots). Then identify **the upper and lower trigrams** (e.g., water above fire = After Completion; fire above water = Before Completion). Finally read the **judgment** (the hexagram's overall message) and **line texts** (each position's specific message). Tarogram's 64-hexagram encyclopedia walks through them one by one.$$
  ]::text[]
),
(
  'major-vs-minor-arcana',
  'card',
  '2026-04-28',
  true,
  $$大阿爾克那 vs 小阿爾克那:抽到時的意義差別$$,
  $$Major vs Minor Arcana — What It Means When You Draw Each$$,
  $$抽到死神牌會發生什麼大事,但抽到聖杯三只是朋友聚會?大牌與小牌的「重量」差別,新手最容易誤判。$$,
  $$Will Death really bring a major life event but Three of Cups just mean a friend's gathering? The weight difference between Major and Minor Arcana — easy for beginners to misread.$$,
  ARRAY[
    $$塔羅 78 張牌分成兩組:**22 張大阿爾克那**(Major Arcana)和 **56 張小阿爾克那**(Minor Arcana,分四個花色各 14 張)。新手常以為兩組牌是「同一個層級的」 — 但實際上它們在訊號強度上有明顯的「重量差」,讀牌時不分清楚會誤判很多。$$,
    $$## 大阿爾克那:命運層級的訊號$$,
    $$大阿爾克那是 22 張人生原型 — 愚者、魔術師、戀人、死神、世界 等等。當大牌出現,它通常**指的不是日常瑣事,而是一個更大格局的轉折或主題**。死神不是真的死,但它可能在說「一段重要的東西正在結束」;塔牌不是真的有塔倒了,但它可能在說「你長期維持的某個架構即將崩塌」。一個牌陣裡如果出現多張大牌,代表**這件事的層級超出你原本預想的範圍**。$$,
    $$## 小阿爾克那:日常層級的能量$$,
    $$小阿爾克那的 56 張牌(權杖、聖杯、寶劍、錢幣)講的是**日常生活的四種能量** — 行動、情感、思考、物質。錢幣三可能就是真的「跟同事合作做一個案子」;聖杯五可能就是真的「為一段感情難過」。小牌的訊號**比較具體、比較貼近當下**,沒有大牌那種「命運層級」的份量。但它們不是「不重要」 — 只是用比較生活化的語言在說話。$$,
    $$## 一個牌陣裡的大牌數量說明什麼$$,
    $$三牌占卜抽到三張全是大牌:這件事是你**人生階段的關鍵命題**。三牌全是小牌:這件事**還在日常層級可以用具體行動處理**,別把它放大到命運層級嚇自己。大小混合:看大牌出現在哪個位置 — 大牌在「現況」位置 = 這件事比你想的重;大牌在「未來」位置 = 接下來會有大轉折。$$,
    $$## 抽到全是小牌不是「沒事」$$,
    $$新手常見的誤解是「沒抽到大牌 = 這次占卜不準/太普通」。但其實小牌組合起來**敘事力一點也不弱**。例如錢幣三 + 寶劍五 + 聖杯八 — 這個組合在說「合作中遇到衝突,最後可能要選擇離開」 — 完全沒大牌但訊息很清楚。讀塔羅的能力,有一半是學會「讀小牌之間的故事」。$$
  ]::text[],
  ARRAY[
    $$Tarot's 78 cards split into two groups: **22 Major Arcana** and **56 Minor Arcana** (four suits, 14 each). Beginners often treat them as "the same kind of card" — but they actually have meaningfully different "signal weights", and not distinguishing them leads to a lot of misreading.$$,
    $$## Major Arcana — fate-level signals$$,
    $$The 22 Major Arcana are life archetypes — the Fool, Magician, Lovers, Death, World, etc. When a Major shows up, it usually **isn't pointing at daily trivia; it's pointing at a bigger pivot or theme**. Death isn't literal death but might be saying "something important is ending"; the Tower isn't a literal collapse but might be saying "a structure you've maintained for years is about to crack". Multiple Majors in one spread = **this matter is bigger than you assumed**.$$,
    $$## Minor Arcana — daily-life energies$$,
    $$The 56 Minors (Wands, Cups, Swords, Pentacles) speak in **the four energies of daily life** — action, emotion, thought, material. Three of Pentacles can literally mean "collaborating with a coworker on a project"; Five of Cups can literally mean "grieving a relationship". Minor signals are **more concrete and immediate**; they don't carry that fate-level weight Majors do. But they aren't "less important" — they just speak in everyday language.$$,
    $$## What the count of Majors in a spread tells you$$,
    $$Three Majors in a three-card reading: this matter is a **key theme of your current life chapter**. Three Minors: it's **at the daily level — handle it with concrete action**, don't inflate it to fate-level and scare yourself. Mixed: look at where the Major sits — Major in "present" = heavier than you thought; Major in "future" = a big pivot ahead.$$,
    $$## All Minors doesn't mean "nothing's happening"$$,
    $$A common beginner mistake: "no Majors = boring or inaccurate reading". Wrong — **Minors stitched together can be very narratively strong**. Three of Pentacles + Five of Swords + Eight of Cups says "in a collaboration, conflict arises, eventually the choice is to walk away" — no Majors but the message is crystal clear. Half of reading skill is **learning to read the story between Minors**.$$
  ]::text[]
),
(
  'changing-lines-primary-relating',
  'topic',
  '2026-04-27',
  true,
  $$變爻、本卦、之卦:易經占卜最重要的動態觀念$$,
  $$Changing Lines, Primary and Relating Hexagrams — The Dynamic Heart of I Ching$$,
  $$如果易經只看本卦,你只看到「現在」。變爻告訴你「事情會往哪裡走」 — 這才是易經占卜真正的力量。$$,
  $$Read only the primary hexagram and you see only the present. Changing lines tell you where it's heading — that's where I Ching's true power lives.$$,
  ARRAY[
    $$很多易經初學者只學了「擲銅錢、查卦辭」就以為自己會占卜了,結果讀來讀去總覺得卦象有點「死」。真正讓易經卦象**動起來**的觀念是:變爻、本卦、之卦。沒有掌握這三個,易經占卜的力量大概只發揮了一半。$$,
    $$## 什麼是變爻?$$,
    $$用三枚銅錢擲一爻時,結果有四種可能:三正面(老陰,變)、二正一反(少陽)、一正二反(少陰)、三反面(老陽,變)。**「老陰、老陽」就是變爻** — 它們代表這個位置的能量「達到極點、即將翻轉」(老陰 → 變陽、老陽 → 變陰)。少陽少陰則是穩定狀態,不變。一次占卜可能有 0~6 個變爻。$$,
    $$## 本卦 vs 之卦:現在 vs 趨勢$$,
    $$**本卦**:你擲出來的六爻原狀,代表事情**目前的能量配置**。**之卦**:把所有變爻翻轉(陰變陽、陽變陰)後得到的新卦,代表事情**若依目前能量繼續發展,會走向的方向**。所以一個完整的易經解讀是「現在是 X 卦,但因為這幾個位置在變,事情正往 Y 卦走」 — 這個動態敘事比單看本卦深得多。$$,
    $$## 沒變爻時怎麼讀$$,
    $$如果擲出來六爻全是少陰少陽(沒變爻),代表事情**目前處於穩定狀態,沒有特別需要轉向**。這時直接讀本卦的卦辭就好,不用想之卦。沒變爻不代表「占卜失敗」,反而是一個訊號 — 你問的這件事現在的能量已經定型,不會在短期內有大變化。$$,
    $$## 多個變爻的優先順序$$,
    $$傳統有一套「主爻」判斷法則(朱熹《易學啟蒙》):一個變爻時讀該變爻爻辭;兩個變爻讀上面那爻;三個變爻讀本卦卦辭+之卦卦辭;四個變爻讀之卦下面兩爻不變的爻辭;五個變爻讀之卦不變的那爻;六爻全變(乾坤兩卦特殊)讀「用九」「用六」。**規則複雜,新手不必死記** — 重點是知道「變爻越多,事情正在大幅轉動」這個原則就夠了。$$
  ]::text[],
  ARRAY[
    $$Many I Ching beginners learn just "toss the coins, look up the judgment" and think they can divine — then everything feels a bit static. What truly **brings hexagrams to life** are three concepts: changing lines, primary hexagram, relating hexagram. Without these, you're using maybe half of I Ching's power.$$,
    $$## What's a changing line?$$,
    $$When you toss three coins for one line, four results are possible: three heads (Old Yin, changing), two heads one tail (Young Yang), one head two tails (Young Yin), three tails (Old Yang, changing). **"Old Yin and Old Yang" are changing lines** — they represent energy at this position "reaching its peak and about to flip" (Old Yin → becomes Yang; Old Yang → becomes Yin). Young Yin and Young Yang are stable. One reading can have 0–6 changing lines.$$,
    $$## Primary vs relating: present vs trajectory$$,
    $$**Primary hexagram**: the six lines exactly as you tossed them — the **current energy configuration**. **Relating hexagram**: flip every changing line (yin to yang or vice versa) to get a new hexagram — **where things head if energy keeps unfolding**. So a complete I Ching reading is "right now we're at X, but because these positions are changing, it's moving toward Y" — this dynamic narrative goes far deeper than reading the primary alone.$$,
    $$## What if there are no changing lines?$$,
    $$If all six lines are Young Yin or Young Yang (no changers), it means the matter **is in a stable state, not pivoting right now**. Just read the primary's judgment; no need to think about a relating hexagram. No changing lines isn't "the reading failed" — it's a signal: the energy of this question is settled and won't shift dramatically in the short term.$$,
    $$## Priority when there are multiple changing lines$$,
    $$Tradition has a "main line" rule (Zhu Xi's I Ching primer): one changing line → read its line text; two changing lines → read the upper one; three → read primary judgment + relating judgment; four → read the two unchanged lines of the relating, lower one; five → read the unchanged line of the relating; all six (special for Qian/Kun) → read "Use Nines / Use Sixes". **The rules are complex; beginners don't need to memorise** — the principle "more changing lines = more dramatic transition" is enough to start with.$$
  ]::text[]
),
(
  'upright-vs-reversed-myth',
  'card',
  '2026-04-27',
  true,
  $$正位 vs 逆位:逆位牌真的比較負面嗎?$$,
  $$Upright vs Reversed — Are Reversed Cards Really More Negative?$$,
  $$抽到逆位太陽就一定是「希望破滅」嗎?新手常見的誤解。逆位真正在說的是「能量受阻或反向流動」。$$,
  $$Does reversed Sun always mean "hope dashed"? A common beginner misconception. Reversed actually means "energy blocked or flowing inward".$$,
  ARRAY[
    $$新手最容易陷入的塔羅誤解就是「正位 = 好牌、逆位 = 壞牌」。這個簡化會讓你抽到一張逆位太陽就嚇得不敢看,卻完全錯讀了塔羅在告訴你的事。本文釐清逆位真正的三種意義。$$,
    $$## 逆位的三種真實意義$$,
    $$**第一**:能量被阻擋或延遲(原本應該流動的能量現在卡住了)。**第二**:能量反向流動(原本朝外的能量現在轉朝內,例如「太陽 → 內在的喜悅、自我肯定」、「皇帝 → 內在的權威而非外在的權威」)。**第三**:能量過度或失衡(例如「正義逆位 = 過度法律主義、太計較公平」)。這三種意義要根據其他牌的脈絡判斷,**不是看到逆位就直接套「相反的意義」**。$$,
    $$## 哪些牌逆位反而是好事$$,
    $$有些「警示牌」逆位其實是**警示鬆綁**的訊號:寶劍十逆位 — 痛苦階段正在過去;惡魔逆位 — 從某段束縛中掙脫;塔逆位 — 危機正在減輕(但仍餘震)。這類牌的逆位常常是**新手期待的好消息**,卻被誤讀成壞消息。讀牌時要把每張牌的「正位是什麼」先想清楚,逆位才有對照基準。$$,
    $$## 哪些牌逆位真的要當心$$,
    $$相對地,有些原本溫暖的牌逆位確實是**警訊**:聖杯王后逆位 — 情感操控、母性過度;權杖騎士逆位 — 衝動失控、半途而廢;星星逆位 — 失去希望、靈感枯竭。讀到這類逆位時要更仔細看周圍牌,通常它在說「**你以為一切正常,但其實有東西已經出問題了**」。$$,
    $$## 抽到很多逆位代表什麼$$,
    $$一個牌陣抽到一半以上是逆位,**整體能量是內向的、卡住的、需要回頭看的**。這時候不是「占卜結果很糟」,而是塔羅在告訴你「這件事情你需要先停下來、回到內在處理,而不是繼續往外推」。Tarogram 的塔羅占卜會自動在 AI 解盤裡把正逆位的微妙差異講清楚 — 不必擔心讀錯。$$
  ]::text[],
  ARRAY[
    $$The most common tarot misconception for beginners: "upright = good card, reversed = bad card". This shortcut will scare you into avoiding a reversed Sun and completely miss what tarot is telling you. Here are the three real meanings of reversed.$$,
    $$## Three real meanings of reversed$$,
    $$**One**: energy blocked or delayed (what should be flowing is now stuck). **Two**: energy flowing inward (what was outward turns inward — e.g., "Sun → inner joy, self-validation"; "Emperor → inner authority instead of external"). **Three**: excess or imbalance (e.g., "Justice reversed = over-legalistic, hyper-fair"). Which one applies depends on the surrounding cards — **don't reflexively read reversed as "the opposite meaning"**.$$,
    $$## Reversed cards that are actually good news$$,
    $$Some "warning cards" reversed are signals **the warning is easing**: Ten of Swords reversed — the painful phase is passing; Devil reversed — breaking free of a bondage; Tower reversed — crisis subsiding (with aftershocks). These reversed are often **the good news beginners are hoping for**, but get misread as bad. Always think about what the upright meaning is first; reversed only makes sense in contrast.$$,
    $$## Reversed cards that really are warnings$$,
    $$Conversely, some warm cards reversed really are **alarms**: Queen of Cups reversed — emotional manipulation, smothering motherliness; Knight of Wands reversed — out-of-control impulse, unfinished moves; Star reversed — losing hope, creative drought. When these appear, look more carefully at the surrounding cards — usually they say "**you think everything's fine but something's already broken**".$$,
    $$## What it means when you draw lots of reversed$$,
    $$More than half the spread reversed: **the overall energy is inward, stuck, asking you to look back**. This isn't "the reading is bad" — it's tarot saying "you need to pause and process this internally instead of pushing outward". Tarogram's tarot readings automatically explain upright/reversed nuances inside the AI interpretation — you don't need to worry about misreading.$$
  ]::text[]
),
(
  'timing-questions-tarot-iching',
  'topic',
  '2026-04-26',
  true,
  $$占卜能回答「什麼時候」嗎?塔羅與易經各自的時間觀$$,
  $$Can Divination Answer "When"? Timing in Tarot and I Ching$$,
  $$「他什麼時候會聯絡我?」「我幾月會接到 offer?」塔羅給時間其實很模糊,易經則有獨特的時間語言。$$,
  $$"When will they call me?" "What month will the offer come?" Tarot's timing is fuzzy; I Ching has a unique vocabulary for time.$$,
  ARRAY[
    $$「占卜能不能告訴我具體日期?」是來占卜的人最常問也最讓老師頭痛的問題。簡單答案:**塔羅與易經都不擅長給精確日期**,但它們各自有不同的時間語言。理解這個差別,你才不會反覆問同一個問題又失望。$$,
    $$## 塔羅怎麼算時間$$,
    $$塔羅有幾種傳統的「時間對應法」:小阿爾克那的數字 1-10 對應週數或月數(權杖一 = 一週/一個月內、權杖十 = 十週/十個月);宮廷牌對應人不對應時間(常常代表「等對方先動」)。但這些對應法**準度因牌組與牌手而異,不是嚴謹的時間預測**。比較可靠的塔羅時間訊號是「現在的能量趨勢」 — 例如抽到太陽 = 短期內、隱者 = 需要等、命運之輪 = 即將轉變。$$,
    $$## 易經的時間語言:卦的「位」$$,
    $$易經的時間觀很特別:它不講「幾月幾日」,而是用「位」表達。一個卦六爻代表事情發展的六個階段(初爻=剛開始、上爻=接近結束)。**變爻所在的位置就告訴你「目前事情走到哪一階段」**:變爻在初二爻 = 剛起頭、還早;變爻在三四爻 = 進行到中段;變爻在五上爻 = 接近收尾。這比塔羅給的時間訊號更系統。$$,
    $$## 為什麼具體日期占卜不準$$,
    $$占卜的本質是「映照當下能量」,不是「預測未來」。**未來受太多變數影響**(你的決定、外境變化、其他人的行動),沒有任何工具能精確預測「下週三下午三點他會打電話」這類事。市面上那些聲稱能算出具體日期的占卜法,要嘛是運氣矇對、要嘛是把模糊答案說得很具體讓你自己對號入座。$$,
    $$## 怎麼問才會有用的時間答案$$,
    $$把「他什麼時候聯絡我」換成 — 「現在這段關係的能量正往哪裡走?如果我不主動,大概還需要多久才會有實質進展?」前者的答案模糊到讓你失望;後者的答案能告訴你**現在處於哪個階段、需不需要主動推一把**,這個資訊比一個日期實用得多。$$
  ]::text[],
  ARRAY[
    $$"Can divination give me a specific date?" — the most common and most-difficult-to-answer question. Short answer: **neither tarot nor I Ching is good at precise dates**, but each has a different vocabulary for time. Understanding this saves you from re-asking and being disappointed again.$$,
    $$## How tarot handles time$$,
    $$Tarot has a few traditional "time correspondence" systems: Minor numbers 1-10 mapping to weeks or months (Ace of Wands = within a week/month, Ten of Wands = ten weeks/months); court cards mapping to people, not time (often meaning "wait for them to move"). But these correspondences **vary widely by deck and reader and aren't rigorous predictions**. A more reliable timing signal is "current energy trend" — Sun = short-term, Hermit = needs to wait, Wheel of Fortune = about to pivot.$$,
    $$## I Ching's time vocabulary: line "position"$$,
    $$I Ching's view of time is unusual: it doesn't speak in dates but in "position". A hexagram's six lines represent six stages (line 1 = just starting, line 6 = nearing completion). **Where the changing line sits tells you which stage things are at**: line 1-2 = just begun, plenty of runway; line 3-4 = mid-stream; line 5-6 = nearing completion. This is more systematic than tarot's timing signals.$$,
    $$## Why specific-date readings don't work$$,
    $$Divination's nature is "mirror current energy", not "predict the future". **The future has too many variables** (your decisions, external shifts, others' actions). No tool can precisely predict "next Wednesday at 3pm they'll call". Anyone selling divination methods that claim exact dates is either lucky or being vague enough that you self-fit the answer.$$,
    $$## How to ask timing questions usefully$$,
    $$Reframe "when will they call me" as: "what's the energy trajectory of this relationship now? If I don't reach out, roughly how long until something concrete shifts?" The first answer is too vague to be useful; the second tells you **which stage you're in and whether you need to push** — far more actionable than a date.$$
  ]::text[]
),
(
  'divination-ethics-when-not',
  'topic',
  '2026-04-26',
  true,
  $$占卜倫理:什麼時候不該為自己或他人占卜?$$,
  $$Divination Ethics — When Not to Read for Yourself or Others$$,
  $$同一件事抽十次是浪費能量。為他人占卜未經同意是越界。占卜不是萬能,有些事問了反而傷害自己。$$,
  $$Re-reading the same question ten times wastes energy. Reading for someone without consent crosses a line. Some questions hurt you more by being asked.$$,
  ARRAY[
    $$占卜這件事很容易上癮 — 一旦發現它好像「真的有用」,你會想為每件事都抽一次。但**有些占卜該避免**,做了不只沒幫助,還會傷害你跟身邊的人。本文整理四個最重要的倫理界線。$$,
    $$## 不要反覆抽同一個問題$$,
    $$今天抽出來的牌不滿意,於是明天再抽一次、後天再抽一次 — 這是新手最常犯的錯。**塔羅與易經不是 Google 搜尋,你不會因為再 query 一次就得到不同的「正確答案」**。反覆抽會讓你漸漸不相信任何結果,也會讓占卜失去儀式感。如果你真的對某次答案不滿意,**改問法**,而不是重抽。Tarogram 的衍伸占卜功能就是設計給「同一件事換角度問」用的。$$,
    $$## 不該未經同意為他人占卜$$,
    $$「我幫朋友抽一張看她跟那個男生有沒有機會」 — 這在傳統占卜倫理裡是**越界**。原因有兩個:第一,你窺探了對方的能量場(對方根本不知道有人在替她看);第二,結果可能讓你帶著偏見對待當事人(你抽到不好的牌,接下來看朋友的感情就會用負面預設)。為他人占卜的前提是**對方主動同意**,並且最好是當事人自己問問題,你只負責解讀。$$,
    $$## 重大決策不能完全交給占卜$$,
    $$該不該結婚、該不該動手術、該不該投資多少 — 這類重大決策**永遠不能由占卜全權決定**。占卜可以幫你看清楚當下的能量狀態與內在傾向,但最終決策權在你身上,責任也在你身上。Tarogram 的 AI 解盤刻意避免給具體投資建議、醫療建議,這不是技術限制,是**設計上的倫理選擇**。$$,
    $$## 情緒太激動時先別占卜$$,
    $$剛跟伴侶吵完架、剛被拒絕、剛失業 — 這些時刻**不是好的占卜時機**。情緒太強會讓你帶著預設答案去問,並且選擇性解讀結果(你想要 yes 就會把曖昧的牌讀成 yes)。**先讓情緒沉澱二十四小時再占卜**,得到的答案會清晰得多,也比較不會傷害你。占卜是內在覺察的工具,不是情緒發洩的出口。$$
  ]::text[],
  ARRAY[
    $$Divination is easy to get addicted to — once you discover it "actually works", you want to read everything. But **some readings should be avoided**; doing them not only doesn't help, it harms you and the people around you. Here are four important ethical lines.$$,
    $$## Don't keep re-asking the same question$$,
    $$Don't like today's reading, so you ask again tomorrow and the day after — the most common beginner mistake. **Tarot and I Ching aren't Google searches; you don't get a different "correct answer" by re-querying**. Repeating erodes your trust in any result and drains the ritual. If you genuinely don't like an answer, **rephrase the question**, don't reshuffle. Tarogram's "follow-up reading" feature is designed exactly for "asking the same matter from a different angle".$$,
    $$## Don't read for others without consent$$,
    $$"I'll pull a card to see if my friend has a chance with that guy" — in traditional divination ethics this **crosses a line**. Two reasons: first, you're peering into someone's energy field without them knowing; second, the result could bias your treatment of them (a bad card and you'll subtly project negativity onto the friendship). Reading for others requires **active consent**, ideally with the person asking the question themselves while you only interpret.$$,
    $$## Major decisions can't be outsourced to divination$$,
    $$Whether to marry, whether to have surgery, how much to invest — these big decisions **should never be made by divination alone**. Divination can clarify current energy and inner tendencies, but the final choice and the responsibility belong to you. Tarogram's AI deliberately avoids specific investment or medical advice — not a technical limitation, an **ethical design choice**.$$,
    $$## Don't divine when emotionally activated$$,
    $$Right after fighting with a partner, being rejected, losing a job — **not the time to do a reading**. Strong emotion makes you ask with a preset answer in mind and read selectively (wanting yes, you'll read ambiguous cards as yes). **Let the emotion settle for 24 hours first**; the answer will be much clearer and less harmful. Divination is a tool for inner awareness, not an outlet for emotional release.$$
  ]::text[]
)
on conflict (slug) do nothing;

-- 備註:
-- * 全部直接 published=true,migration 跑完前台 /blog 立即顯示 8 篇新文章
-- * 後台 /admin/blog 所有 row 都看得到、可以編輯/刪除
-- * 重跑 migration 不會蓋掉之後在後台修改過的版本
