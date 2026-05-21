-- ============================================
-- Phase 13 — Blog CMS
-- ============================================
-- 之前 blog 文章寫死在 data/blog.ts (10 篇),改 publish 一篇要 redeploy 整個 app。
-- 這支把 blog 搬到 Supabase,後台 /admin/blog 可以 CRUD,前台 /blog 直接讀 DB。
--
-- 設計:
--   - 一個 row = 一篇文章,所有語系欄位放同一 row(目前 zh + en,ja/ko 預留欄位)
--   - body_zh / body_en 用 text[] (Postgres native array) — 對應前台 paragraph 渲染
--   - 既有的 "## " 開頭 = h2、"**bold**" = strong 的 inline 慣例不變
--   - 公開讀(published 顯示給訪客),admin 寫(透過 service_role 繞 RLS)
--   - 索引 published_at desc 給 /blog 索引頁排序
--
-- Safe to run multiple times (if not exists)。Backfill 用 ON CONFLICT DO NOTHING 防重跑。
-- ============================================

create extension if not exists "pgcrypto";

create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  category      text not null default 'intro',
  published_at  date not null default current_date,
  /** 是否上架 — false 時 /blog 不列出、/blog/[slug] 回 404 */
  published     boolean not null default true,
  hero_image_url text,
  -- 中英是必填,日韓 nullable(目前 UI 還沒切到)
  title_zh      text not null,
  title_en      text not null,
  excerpt_zh    text not null,
  excerpt_en    text not null,
  body_zh       text[] not null default '{}',
  body_en       text[] not null default '{}',
  title_ja      text,
  title_ko      text,
  excerpt_ja    text,
  excerpt_ko    text,
  body_ja       text[],
  body_ko       text[],
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists blog_posts_published_at_idx
  on public.blog_posts (published_at desc)
  where published = true;

create index if not exists blog_posts_category_idx
  on public.blog_posts (category);

-- updated_at trigger:每次 UPDATE 自動刷新時戳
create or replace function public.touch_blog_posts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists blog_posts_touch on public.blog_posts;
create trigger blog_posts_touch
  before update on public.blog_posts
  for each row execute function public.touch_blog_posts_updated_at();

-- ── RLS ──
-- 公開讀只能拿 published=true 的;admin 透過 service_role 繞過 RLS,讀寫不受限。
alter table public.blog_posts enable row level security;

drop policy if exists "Published blog posts are readable by anyone" on public.blog_posts;
create policy "Published blog posts are readable by anyone"
  on public.blog_posts for select
  using (published = true);

-- 寫入完全限 service_role(client SDK 拿不到,API route 才能寫)
drop policy if exists "Service role can write blog posts" on public.blog_posts;
create policy "Service role can write blog posts"
  on public.blog_posts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================
-- BACKFILL — 把既有 data/blog.ts 的 10 篇灌進來
-- ============================================
-- ON CONFLICT (slug) DO NOTHING:重跑 migration 不會蓋掉後台已編輯過的版本。
-- 想要強制覆蓋成 seed 版,先 DELETE FROM blog_posts WHERE slug IN (...) 再跑。

insert into public.blog_posts (slug, category, published_at, title_zh, title_en, excerpt_zh, excerpt_en, body_zh, body_en) values
(
  'iching-vs-tarot',
  'intro',
  '2026-04-25',
  $$易經 vs 塔羅:該選哪個占卜?$$,
  $$I Ching vs Tarot — Which Should You Choose?$$,
  $$東方系統重時機與位置,西方塔羅重故事與情感。一篇文看懂兩者擅長的問題。$$,
  $$Eastern reading favours timing and position; Western tarot favours story and emotion.$$,
  ARRAY[
    $$「易經和塔羅,差別到底在哪?」這是來 Tarogram 的人最常問的第一個問題。簡單一句話:**易經適合問「時機」與「該怎麼做」,塔羅適合問「現在發生什麼」與「我和對方各自怎麼想」**。$$,
    $$## 易經:位置與時機的智慧$$,
    $$易經的核心是六爻 — 六個位置,每個位置代表事情的一個發展階段(從根基到頂點)。當你問「現在能不能去」「這份合約簽不簽」這類有明確時機的問題,易經能很精準告訴你「時機到沒、有沒有變數、若拖延會走向何方」。卦辭與爻辭兩千多年的累積,是「在這個時間點該怎麼定位自己」的指南。$$,
    $$## 塔羅:故事與情緒的鏡子$$,
    $$塔羅的 78 張牌是 78 個原型畫面。當你抽到三張、五張、十張牌排成一個牌陣,牌與牌之間互相對話,就會浮現一個關於你問題的故事。**塔羅特別擅長感情、人際、自我探索類的問題** — 因為這類問題的核心常常不是「答案」,而是「我看見了什麼」「對方在想什麼」「這段關係的能量長什麼樣」。$$,
    $$## 一句話的選擇指引$$,
    $$問「能不能、要不要、何時」→ 抽易經一卦。問「為什麼、什麼能量、對方怎麼看」→ 排一個塔羅牌陣。Tarogram 把兩個系統都做進來,你可以針對同一件事先抽一卦再排一個牌陣,讓兩種智慧對照,通常會發現它們在指同一個方向,只是角度不同。$$
  ]::text[],
  ARRAY[
    $$"What's the difference between I Ching and tarot?" — the most common first question on Tarogram. The short answer: **I Ching is for timing and positioning; tarot is for story and emotion**.$$,
    $$## I Ching — wisdom of position and timing$$,
    $$I Ching's core is six lines — six positions, each a stage of unfolding (from root to peak). When you ask "should I act now?" or "sign this contract or not?", I Ching tells you whether the timing is ripe, what variables exist, and where delay leads. The 2,000+ years of judgment and line texts are a guide for *how to position yourself in this moment*.$$,
    $$## Tarot — a mirror of story and feeling$$,
    $$Tarot's 78 cards are 78 archetypal images. When three, five, or ten cards land in a spread, the cards converse and a story emerges about your question. **Tarot excels at relationship, people, and self-discovery questions** — where the answer matters less than "what am I seeing," "what are they thinking," "what does this bond's energy look like."$$,
    $$## One-line picker$$,
    $$Asking "can I / should I / when" → cast one I Ching hexagram. Asking "why / what energy / how do they see this" → lay a tarot spread. Tarogram offers both. For the same matter, do an I Ching reading and then a tarot spread side by side — they usually point the same direction from different angles.$$
  ]::text[]
),
(
  'is-ai-tarot-accurate',
  'ai',
  '2026-04-22',
  $$AI 塔羅準嗎?2026 年深度分析$$,
  $$Is AI Tarot Accurate? A 2026 Deep Look$$,
  $$AI 不會「靈動」、但能在牌義詮釋的廣度與一致性勝過半數人類牌手。重點是怎麼問。$$,
  $$AI doesn't channel — but on breadth and consistency it beats half of human readers. The leverage is the question.$$,
  ARRAY[
    $$「AI 塔羅準嗎?」這個問題本身就值得拆解。「準」不是一個單一指標 — 它至少包含三件事:**牌義對得上、敘事連貫、對問題有實際指引**。$$,
    $$## AI 強在哪$$,
    $$現代 LLM 看過的塔羅牌義文獻、心理諮商案例、人際情境分析,遠超過任何一個人類牌手累積一輩子能讀的量。所以在「給定一張牌 + 給定一個情境,寫出一段牌義詮釋」這件事上,AI 的廣度與一致性其實非常高。Tarogram 用的是 DeepSeek 模型,中文寫作的水準與情感拿捏特別細膩。$$,
    $$## AI 弱在哪$$,
    $$AI 沒有「靈動」 — 它無法感知你抽牌時的能量、無法知道你在問問題時是真誠還是試探。它也無法判斷「你問這個問題的背後其實是另一個問題」(這是優秀人類牌手最有價值的一塊)。所以對 AI 而言,**輸入品質決定輸出品質**:你的問題寫得越具體、越誠實,AI 解讀的個人化程度就越高。$$,
    $$## 怎麼讓 AI 占卜更準$$,
    $$三個訣竅:第一,問題用一兩句話交代背景 — 不要只寫「感情運」,寫「最近跟交往兩年的對象冷戰中,我想知道是該主動和好還是先各自冷靜」。第二,選擇符合你需求的占卜師人格 — 月亮姊偏溫柔治癒、玄機老師偏直白嚴師。第三,結束後留下你看完的感受 — 用聊天框跟 AI 對話會比讀完就走得到更多細節。$$
  ]::text[],
  ARRAY[
    $$"Is AI tarot accurate?" — worth unpacking. "Accurate" isn't a single metric. It's at least three things: **card meanings line up, narrative coheres, advice fits your specific question**.$$,
    $$## What AI does well$$,
    $$Modern LLMs have read more tarot literature, counselling case studies, and relationship situations than any human reader could in a lifetime. So at "given this card + this context, write an interpretation", AI's breadth and consistency are very high. Tarogram uses DeepSeek, which handles emotional nuance in Chinese particularly well.$$,
    $$## Where AI falls short$$,
    $$AI lacks intuitive presence — it can't feel your energy when shuffling, can't tell whether you're sincere or testing. It also can't catch "the question behind your question" (a top human reader's superpower). So **input quality determines output quality**: the more specific and honest your prompt, the more personal the read.$$,
    $$## Three tips to sharpen AI readings$$,
    $$First, give 1–2 sentences of context — not "love" but "in a cold-war with my 2-year partner, should I make the first move or give us space?". Second, pick a persona that suits your need — Lunar Sister for gentle healing, Master Xuanji for blunt direction. Third, use the chat box after the reading; following up usually unlocks layers a single read misses.$$
  ]::text[]
),
(
  '78-tarot-cards-quick-reference',
  'card',
  '2026-04-20',
  $$78 張塔羅牌牌意速查 — 完整入門$$,
  $$78 Tarot Cards Quick Reference$$,
  $$從愚者到世界,從聖杯一到錢幣國王,一張表記住核心關鍵字。$$,
  $$From the Fool to the World, from Ace of Cups to King of Pentacles — one table for the essentials.$$,
  ARRAY[
    $$塔羅牌共 78 張:22 張**大阿爾克那**(Major Arcana)代表精神層次與重要人生課題;56 張**小阿爾克那**(Minor Arcana)分為四個花色,各 14 張,代表日常生活的四種能量。$$,
    $$## 大阿爾克那(0-21):人生原型$$,
    $$**0 愚者** — 起點與冒險。**1 魔術師** — 創造與意志。**2 女祭司** — 直覺與隱藏。**3 皇后** — 豐盛與孕育。**4 皇帝** — 結構與權威。**5 教皇** — 傳承與規範。**6 戀人** — 連結與選擇。**7 戰車** — 意志的勝利。**8 力量** — 內在馴服。**9 隱者** — 內省。**10 命運之輪** — 循環。**11 正義** — 因果。**12 倒吊人** — 等待與視角轉換。**13 死神** — 終結與蛻變。**14 節制** — 平衡。**15 惡魔** — 慾望與束縛。**16 塔** — 突發崩塌。**17 星星** — 希望。**18 月亮** — 夢與恐懼。**19 太陽** — 光明歡愉。**20 審判** — 召喚重生。**21 世界** — 完成與整合。$$,
    $$## 小阿爾克那(四花色)$$,
    $$**權杖(Wands)** 對應火元素 — 行動、熱情、事業、創造。**聖杯(Cups)** 對應水元素 — 情感、關係、直覺、藝術。**寶劍(Swords)** 對應風元素 — 思想、決策、衝突、真理。**錢幣(Pentacles)** 對應土元素 — 物質、健康、工作、實際層面。每個花色從 Ace(王牌,純粹能量起點)到 10(完成),再加上 Page(侍者)、Knight(騎士)、Queen(王后)、King(國王)四張宮廷牌,共 14 張。$$,
    $$## 想看每張牌的完整解析?$$,
    $$牌意只是地圖的索引。要看到一張牌完整的正逆位牌義、關鍵字、適用情境,可以到 78 張牌的牌意百科逐張查閱。$$
  ]::text[],
  ARRAY[
    $$Tarot has 78 cards: 22 **Major Arcana** for spiritual archetypes and life lessons, 56 **Minor Arcana** in four suits, 14 each, for daily energies.$$,
    $$## Major Arcana (0–21) — life archetypes$$,
    $$**0 Fool** — beginnings, leap. **1 Magician** — will, manifesting. **2 High Priestess** — intuition. **3 Empress** — abundance. **4 Emperor** — structure. **5 Hierophant** — tradition. **6 Lovers** — connection, choice. **7 Chariot** — will's victory. **8 Strength** — inner taming. **9 Hermit** — introspection. **10 Wheel** — cycles. **11 Justice** — cause-and-effect. **12 Hanged Man** — surrender, new view. **13 Death** — ending, rebirth. **14 Temperance** — balance. **15 Devil** — desire, bondage. **16 Tower** — sudden collapse. **17 Star** — hope. **18 Moon** — dreams, fears. **19 Sun** — joy. **20 Judgement** — calling, revival. **21 World** — completion.$$,
    $$## Minor Arcana (four suits)$$,
    $$**Wands** = Fire — action, passion, career. **Cups** = Water — emotion, relationships. **Swords** = Air — thought, decision, conflict. **Pentacles** = Earth — material, body, work. Each suit runs Ace–10 plus Page, Knight, Queen, King.$$,
    $$## Want each card in detail?$$,
    $$These are just index entries. Full upright/reversed meanings and contexts live in our 78-card encyclopedia.$$
  ]::text[]
),
(
  'three-card-spread-guide',
  'spread',
  '2026-04-18',
  $$三牌時間軸 — 最經典的入門牌陣$$,
  $$Three-Card Timeline — The Classic Starter Spread$$,
  $$過去-現在-未來,三張牌看出一件事的脈絡。新手第一個該學的牌陣。$$,
  $$Past-present-future. Three cards, one arc. The first spread every reader should learn.$$,
  ARRAY[
    $$三牌時間軸是塔羅最經典也最入門的牌陣。三張牌、三個位置:**過去 — 現在 — 未來**,組成一個關於你問題的迷你故事。$$,
    $$## 三個位置怎麼讀$$,
    $$**過去**位置代表「造成當下局面的根源」 — 不是流水帳的歷史,而是「這件事為什麼會走到這裡的關鍵動因」。**現在**位置代表「此刻最重要的能量或課題」 — 通常是整個牌陣的重心,讀牌時花最多時間在這張。**未來**位置代表「若現況不變,事情可能的去向」 — 不是命定的結局,而是「若你不採取新的行動,這條軌跡將通往哪裡」的提醒。$$,
    $$## 適合什麼問題$$,
    $$三牌牌陣適合任何想看脈絡的問題:「這段感情會走向哪裡?」「這份工作的發展?」「這個專案做下去會如何?」。它特別適合作為日常占卜的起手式 — 抽完三張牌,如果想更深入,可以針對其中一個位置再排一個五張牌的小牌陣。$$,
    $$## 三張牌之間的對話$$,
    $$讀三牌的關鍵不是「逐張解釋」,而是「看三張牌之間怎麼對話」。例如:過去抽到惡魔(束縛)、現在抽到塔(突發崩塌)、未來抽到星星(希望) — 這個牌組講的是「從一段被困住的關係中突然破裂,但這個破裂其實是通往新希望的路」。三張牌串起來說的故事,比單張的牌義更有力量。$$
  ]::text[],
  ARRAY[
    $$The three-card timeline is tarot's most classic starter spread. Three cards, three positions: **past — present — future** — a mini-story about your question.$$,
    $$## Reading the three positions$$,
    $$**Past** = the root that brought this matter here — not biography, but the key driver. **Present** = the most important energy or lesson right now — usually the spread's centre of gravity; spend most time here. **Future** = where this likely heads if nothing changes — not destiny, but a reminder of "this trajectory if you do nothing new".$$,
    $$## What it suits$$,
    $$Any question wanting an arc: "where is this relationship going?", "how will this job unfold?", "if I run this project, what?". Great as a daily go-to — if a position needs depth, lay a five-card spread on that single position next.$$,
    $$## The conversation between cards$$,
    $$The trick isn't reading each card alone — it's hearing how the three converse. Example: past Devil (bondage), present Tower (sudden collapse), future Star (hope). The story: "a stuck bond shatters suddenly, and that shattering is the road to new hope." The three together speak louder than any single card.$$
  ]::text[]
),
(
  'celtic-cross-real-world-guide',
  'spread',
  '2026-04-15',
  $$凱爾特十字實戰指南 — 十張牌做大命題$$,
  $$Celtic Cross Real-World Guide — Ten Cards for Big Questions$$,
  $$塔羅最完整的牌陣。十個位置看一個複雜命題的全景。$$,
  $$Tarot's most complete spread. Ten positions, panoramic view of one complex matter.$$,
  ARRAY[
    $$凱爾特十字是塔羅最有名也最完整的牌陣 — 十張牌,十個位置,適合處理重大、複雜、需要全景理解的命題。$$,
    $$## 什麼問題該用凱爾特十字$$,
    $$「該不該離職創業?」「這段五年的感情要不要結束?」「我接下來的人生方向?」 — 這些問題如果用三牌占卜,你只會得到一個粗略的指向。凱爾特十字像 X 光,能照見:現況、核心挑戰、你內心潛意識的拉力、過去的影響、可達成的意識目標、近未來、自我姿態、外境影響、希望與恐懼、最終結果。$$,
    $$## 十張牌的讀法$$,
    $$讀凱爾特十字最常見的錯誤是「逐張解釋」 — 十張讀完聽眾已經睡著。正確讀法是先**找出整個牌陣的兩三張關鍵牌**(通常是現況 + 核心挑戰 + 最終結果),用這兩三張當骨架編出主敘事;其他七張牌當「細節支撐」,在主敘事的關鍵點上補充。$$,
    $$## 凱爾特十字一定要 Deep Insight 模式$$,
    $$凱爾特十字資訊量太大,Quick Reading 會被壓縮成過度簡化的版本。在 Tarogram 用凱爾特十字時,**強烈建議搭配 Deep Insight 模式**(訂閱戶限定)— AI 會交叉比對牌與牌之間的呼應、揭示暗藏的模式,並給出可執行的下一步。$$
  ]::text[],
  ARRAY[
    $$The Celtic Cross is tarot's most famous and complete spread — 10 cards, 10 positions, panoramic on a big complex matter.$$,
    $$## When to use it$$,
    $$"Should I quit and start my own thing?", "end this 5-year relationship?", "what's my life direction?" — three cards on these gives only a rough vector. Celtic Cross is the X-ray: present, core challenge, subconscious pull, recent past, conscious aim, near future, self-stance, environment, hopes/fears, outcome.$$,
    $$## How to read 10 cards$$,
    $$Most common mistake: read each card in turn — listener asleep by card 10. Better: find the **two or three pivotal cards** (usually present + challenge + outcome), build the main narrative on that skeleton, and let the other seven serve as supporting details at narrative pivots.$$,
    $$## Always pair Celtic Cross with Deep Insight$$,
    $$There's too much information for Quick mode — it'll be over-compressed. On Tarogram, **pair Celtic Cross with Deep Insight** (Premium) — the AI cross-references cards, surfaces hidden patterns, and gives actionable next steps.$$
  ]::text[]
),
(
  'two-options-spread-when-to-use',
  'spread',
  '2026-04-12',
  $$二選一牌陣 — 卡在兩條路時用$$,
  $$Two Options Spread — When You're Stuck Between Paths$$,
  $$不是預言哪條路會贏,而是看見每條路的本質與課題。$$,
  $$Not prophesying which wins. Showing each path's nature and lesson.$$,
  ARRAY[
    $$「換工作 vs 留下」「選 A 公司還是 B 公司」「這段關係該繼續還是放手」 — 任何二元決策都可以用「二選一牌陣」處理。$$,
    $$## 三張牌的結構$$,
    $$二選一牌陣只有三張:**現況**(你此刻的處境與心情)、**選擇 A**(走 A 路徑將遇到的能量與課題)、**選擇 B**(走 B 路徑將遇到的能量與課題)。注意位置 2 和 3 不是「結果預言」 — 塔羅不會告訴你「選 A 會贏」,它告訴你「選 A 會讓你遇到這種類型的能量、要面對這種課題」。$$,
    $$## 怎麼解讀「現況」這張牌$$,
    $$很多人忽略現況這張牌,直接跳去比較 A 和 B。但**現況牌往往揭示「你之所以難以決定的真正原因」** — 也許你抽到月亮(夢與恐懼),意味著你還沒分清楚自己的恐懼與真實渴望;也許抽到惡魔(束縛),意味著你被某種你沒意識到的東西卡住。先處理現況,再比較 A 和 B,選擇會清楚很多。$$,
    $$## 二選一不能解的問題$$,
    $$如果你的選項其實有三個以上,別硬塞進二選一 — 改用三牌看脈絡或凱爾特十字看全景。如果你只是想要塔羅幫你下決定(「你告訴我選哪個」),這不是塔羅的工作 — 塔羅是揭示能量與課題,決定永遠是你自己做。$$
  ]::text[],
  ARRAY[
    $$"Switch jobs or stay?", "company A or B?", "continue or end?" — any binary decision fits the two-options spread.$$,
    $$## Three cards, three roles$$,
    $$Just three: **current ground** (where you stand), **option A** (energies and lessons on path A), **option B** (same on path B). Positions 2 and 3 are NOT outcome predictions — tarot doesn't say "A wins." It says "choosing A means meeting this energy, facing this lesson."$$,
    $$## Don't skip the current-ground card$$,
    $$Most people leap to comparing A vs B and ignore card 1. But **the current-ground card often reveals why you can't decide**. The Moon there means you haven't separated fear from real longing; the Devil means something unconscious has you stuck. Process card 1 first; then A vs B becomes much clearer.$$,
    $$## What it can't do$$,
    $$More than two options? Don't force it — use three-card or Celtic Cross. Want tarot to decide for you? That's not its job. Tarot reveals energy and lesson; the choice is always yours.$$
  ]::text[]
),
(
  'love-question-how-to-ask',
  'topic',
  '2026-04-09',
  $$感情占卜該怎麼問問題?$$,
  $$How to Phrase Love Questions for Tarot$$,
  $$「他喜歡我嗎?」是壞問題。換個問法,塔羅會給你完全不同的洞見。$$,
  $$"Does he like me?" is a poor question. Reframe it and tarot opens up.$$,
  ARRAY[
    $$感情問題是塔羅最常被問的領域。但很多人問了三次塔羅都沒得到滿意答案 — 不是塔羅不準,是**問題問錯了**。$$,
    $$## 為什麼「他喜歡我嗎?」是壞問題$$,
    $$這是 yes/no 包裝的問題,但同時心裡又期待塔羅給你一個複雜、滿滿希望的答案。結果你抽到一張曖昧的牌,既不滿意 yes 的詮釋、也不接受 no 的詮釋,反覆抽十次,塔羅的能量就被你問散了。$$,
    $$## 把問題從「結果」換成「能量」$$,
    $$好的感情問題不問結果,問能量:「**這段關係此刻的能量是什麼?**」「**他在我面前最常戴上的是哪個面具?**」「**我們之間最大的阻礙是什麼?**」「**如果我不主動改變,這段關係會走向哪裡?**」。這類問題,塔羅能給你的訊息會深得多 — 因為它在做塔羅最擅長的事:照見能量、揭示模式。$$,
    $$## 想真的知道結果?用 Yes/No 占卜$$,
    $$如果你**真的就只想要 yes 或 no**,那別用三牌或愛情十字 — 直接用 Tarogram 的 Yes/No 占卜,系統會根據抽到的牌給你明確答案,不會在中間繞圈。如果想看完整關係能量,用愛情十字 — 五張牌,你的視角、對方視角、兩人之間、阻礙、未來方向。$$
  ]::text[],
  ARRAY[
    $$Love is the most-asked tarot topic. But many ask three readings and walk away dissatisfied — not tarot's fault, **the question was wrong**.$$,
    $$## Why "does he like me?" is a poor question$$,
    $$It's a yes/no in disguise, but you secretly want a rich, hopeful answer. The reading lands on something ambiguous, you reject both interpretations, you re-shuffle ten times — the energy scatters.$$,
    $$## Trade outcome for energy$$,
    $$Good love questions ask energy, not outcome: "**what is the energy of this bond right now?**", "**what mask does he wear most often around me?**", "**what's the biggest obstacle between us?**", "**if I don't change anything, where does this go?**". Tarot does much more with these — they ask exactly what tarot is good at: revealing energy and pattern.$$,
    $$## Really need yes/no? Use Yes/No tarot$$,
    $$If you **truly want only yes or no**, skip three-card and love cross — use Tarogram's Yes/No reading directly; the system gives a clear verdict based on the drawn card. For full relationship energy, use the Love Cross — five cards: your view, their view, the bond, obstacle, trajectory.$$
  ]::text[]
),
(
  'career-tarot-common-cards',
  'topic',
  '2026-04-06',
  $$事業占卜常見牌組與訊號$$,
  $$Career Tarot — Common Cards and Signals$$,
  $$看到這些牌就要小心:錢幣三的合作、寶劍五的鬥爭、權杖騎士的衝動。$$,
  $$Watch these cards: 3 of Pentacles' collab, 5 of Swords' fight, Knight of Wands' rush.$$,
  ARRAY[
    $$事業占卜最常出現的牌,集中在錢幣(物質、實際)、權杖(行動、熱情)、寶劍(思考、決策)三個花色。學會辨認這些訊號,事業占卜的解讀會立刻立體起來。$$,
    $$## 錢幣牌組:給你穩定但慢的訊號$$,
    $$錢幣三 — 合作專案,但需要協調多方利益。錢幣四 — 守住既有的安全,別冒險。錢幣七 — 投入了卻還沒看到回報的階段,別急。錢幣十 — 長期累積到了階段性收割。看到錢幣牌,通常代表這份工作或案子的本質是「需要時間、可實際變現」。$$,
    $$## 權杖牌組:行動與熱情訊號$$,
    $$權杖 Ace — 新機會的火苗,但要看後面接什麼牌決定能否點燃。權杖三 — 視野打開、可以擴張。權杖騎士 — 衝動行動,常常缺乏計畫(逆位更明顯)。權杖十 — 過度承擔,需要放下一些。看到權杖,代表這個事業階段的關鍵在「你的行動意願與節奏」。$$,
    $$## 寶劍牌組:警示牌組$$,
    $$寶劍五 — 衝突中的勝利,但會留下裂痕。寶劍七 — 偷工或被偷,要警覺。寶劍十 — 一段已經結束、別再硬撐。寶劍三 — 心痛或關係決裂。**事業占卜抽到多張寶劍時要特別小心** — 這通常是「現在的環境不適合硬上」的訊號,該退一步重新評估。$$,
    $$## 想看一個牌的完整意涵?$$,
    $$牌意百科有完整的正逆位解析、關鍵字、適用情境。事業占卜建議搭配三牌或凱爾特十字。$$
  ]::text[],
  ARRAY[
    $$Career readings cluster in three suits: Pentacles (material, concrete), Wands (action, passion), Swords (thought, decision). Learn the signals and your readings get sharper.$$,
    $$## Pentacles — slow but solid signals$$,
    $$**3 of Pentacles** — collaboration, multi-stakeholder coordination. **4 of Pentacles** — guard what you have, don't risk now. **7 of Pentacles** — invested but no return yet, be patient. **10 of Pentacles** — long compounding pays off. Pentacles = "this work needs time and can be made real."$$,
    $$## Wands — action and momentum$$,
    $$**Ace of Wands** — new opportunity sparking. **3 of Wands** — vision opens, expansion possible. **Knight of Wands** — impulsive action, often plan-less (especially reversed). **10 of Wands** — overburdened, drop something. Wands = "this career stage hinges on your willingness to move."$$,
    $$## Swords — caution suit$$,
    $$**5 of Swords** — winning a fight but leaving cracks. **7 of Swords** — cutting corners or being cut. **10 of Swords** — done, stop forcing it. **3 of Swords** — heartbreak or rupture. **Multiple Swords in a career reading = caution** — usually "this environment isn't right to push hard now."$$,
    $$## Want full card detail?$$,
    $$Each card has full meanings in our 78-card encyclopedia. For career, pair with three-card or Celtic Cross.$$
  ]::text[]
),
(
  'money-tarot-beginner',
  'topic',
  '2026-04-03',
  $$財運占卜入門 — 怎麼問才不會被自己騙$$,
  $$Money Tarot for Beginners — Asking Without Self-Deception$$,
  $$想知道哪檔股票會漲?塔羅給不了你。但它能告訴你你的財富心智在哪。$$,
  $$Which stock will pump? Tarot can't say. But it can tell you where your money mind sits.$$,
  ARRAY[
    $$「這檔股票會不會漲?」「我會中樂透嗎?」這類問題塔羅給不了答案 — 不是塔羅不準,是這類問題本身就**超出塔羅的設計範圍**(也超出 Tarogram 的合規邊界,AI 不會給你具體投資建議)。$$,
    $$## 塔羅能回答什麼財運問題$$,
    $$塔羅擅長的是揭示「能量與心智」 — 在財富這個主題上,它能回答:「我目前對金錢的關係是什麼?」「我下半年的財運能量整體如何?」「這個投資決定背後我的真正動機是什麼?」「我接下來該重點累積還是擴張?」這些問題的答案能幫你做更好的財務決策,但決策本身仍然是你的責任。$$,
    $$## 財運占卜常見的牌訊號$$,
    $$錢幣 Ace — 新財源的種子。錢幣三 — 透過合作或專業獲得收入。錢幣六 — 給予與接受的平衡(可能是借錢、捐贈、互惠)。錢幣七 — 投入後的等待期。錢幣九 — 獨立累積的成果。錢幣十 — 家族層級的長期財富。寶劍六 — 從一段虧損中走出。命運之輪 — 財富循環的轉折點。$$,
    $$## 寫好財運問題的範例$$,
    $$壞問題:「我會發財嗎?」 好問題:「未來三個月,如果我延續目前的工作節奏與消費習慣,財富能量會走到哪裡?有什麼是我沒看見的?」 — 後者的答案能落地、能行動,前者只能讓你期待。$$
  ]::text[],
  ARRAY[
    $$"Will this stock go up?", "will I win the lottery?" — tarot can't answer these. Not tarot's fault — these are **outside its design** (and Tarogram's safety preamble forbids AI from giving specific investment advice).$$,
    $$## What tarot can answer about money$$,
    $$Tarot excels at energy and mindset. On wealth, it answers: "what is my current relationship to money?", "what's my financial energy this half-year?", "what's my real motive behind this investment?", "should I focus on accumulating or expanding next?". The answers help you decide; the decision remains yours.$$,
    $$## Common money-card signals$$,
    $$**Ace of Pentacles** — new income seed. **3 of Pentacles** — earnings via collaboration or expertise. **6 of Pentacles** — give-and-receive balance. **7 of Pentacles** — wait after investment. **9 of Pentacles** — solo accumulation. **10 of Pentacles** — family-scale wealth. **6 of Swords** — climbing out of loss. **Wheel of Fortune** — wealth-cycle turning point.$$,
    $$## Reframing example$$,
    $$Bad: "will I get rich?". Good: "if I keep my current work pace and spending for the next 3 months, where does my financial energy land — and what am I not seeing?". The second is actionable; the first only gives you hope.$$
  ]::text[]
),
(
  'daily-card-ritual',
  'topic',
  '2026-03-30',
  $$每日一卡的儀式感 — 為什麼有效$$,
  $$The Ritual of the Daily Card — Why It Works$$,
  $$每天 30 秒,讓塔羅成為你內在天氣預報。$$,
  $$30 seconds a day. Make tarot your inner weather report.$$,
  ARRAY[
    $$「每日一卡」聽起來很儀式化,但它其實是塔羅最務實的用法之一 — 把抽牌變成「給今天的能量做一次預習」。$$,
    $$## 為什麼一張牌就夠$$,
    $$你不需要每天用十張牌的凱爾特十字 — 太多訊息反而會稀釋。一張牌剛好,它**給你今天的關鍵字、不給你完整劇本**,留下空間讓你自己對照當天發生的事。$$,
    $$## 早晚一張的不同用法$$,
    $$**早上抽** — 把今天的牌當作「今天該留意的能量」。看到太陽,告訴自己今天適合主動;看到隱者,告訴自己今天適合慢、適合內省。**晚上抽** — 把今天的牌當作「今天的能量總結」。看到塔,問問自己今天是否經歷了什麼突發崩塌;看到星星,問問自己今天哪一刻感受到了希望。$$,
    $$## Tarogram 的每日一卡有什麼不同$$,
    $$Tarogram 的每日一卡用「使用者 ID + 當天日期」做 deterministic seed,意思是 — **同一個人在同一天無論抽幾次都會得到同一張牌**。這個設計刻意避免「不滿意就重抽」的習慣,讓你練習接受今天就是這張牌。同日重抽不再扣點,純粹是回頭看今日訊息用。$$,
    $$## 試試看$$,
    $$點開每日一卡,連續抽 30 天,你會開始發現自己的牌出現的模式 — 哪些月份的能量重複、哪些主題在繞圈。這比一次性的占卜更接近「自我覺察的長期練習」。$$
  ]::text[],
  ARRAY[
    $$"Daily card" sounds ceremonial, but it's actually one of the most practical uses of tarot — a 30-second preview of today's energy.$$,
    $$## Why one card is enough$$,
    $$You don't need a 10-card Celtic Cross every day — too much information dilutes. One card gives the day's keyword, not a full script — leaving room for you to match it against what actually happens.$$,
    $$## Morning vs evening use$$,
    $$**Morning** — read it as today's energy to watch. The Sun says today rewards initiative; the Hermit says today wants slow and inward. **Evening** — read it as today's summary. The Tower asks: did anything collapse today? The Star asks: when did I feel hope today?$$,
    $$## What's different in Tarogram's daily card$$,
    $$Tarogram seeds each daily card with **user ID + today's date** — meaning **the same person gets the same card on the same day no matter how many times they open it**. This deliberately blocks the "don't like it, re-shuffle" habit. Re-opens don't charge again; they're just for re-reading today's message.$$,
    $$## Try it$$,
    $$Open the daily card 30 days in a row. You'll start seeing patterns — which months repeat, which themes circle. This becomes a long-term self-awareness practice, not a one-shot reading.$$
  ]::text[]
)
on conflict (slug) do nothing;

-- 備註:
-- * 後續編輯走 /admin/blog → /api/admin/blog,寫入透過 service_role 繞 RLS。
-- * /app/blog 與 /app/blog/[slug] 改用 lib/blog.ts (anon-key + unstable_cache) 讀,
--   保持 SSG / static 不退化成 dynamic。
-- * data/blog.ts 之後就只剩 type 定義(可保留或刪除,前台已不依賴)。
