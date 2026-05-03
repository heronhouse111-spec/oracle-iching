-- Phase 23: Collection Hub content CMS
--
-- /collection 收藏中心頁的所有文案(2 張 hero card / 規則說明 / CTA / 底部提醒)
-- 都搬到 DB,由 admin 在 /admin/collection-hub 即時編輯,並支援 4 語系自動翻譯。
--
-- 對應程式:
--   - app/collection/page.tsx               — 從 /api/collection-hub 拉內容
--   - app/api/collection-hub/route.ts       — public GET
--   - app/api/admin/collection-hub/...      — admin CRUD + 自動翻譯
--   - app/admin/collection-hub/page.tsx     — 後台 inline 編輯 + 一鍵翻譯
--
-- Schema:
--   - id (PK):key,例如 'page.title' / 'card.iching.title' / 'rule.1.body'
--   - section:UI 分組 — 'page' / 'card' / 'cta' / 'rule' / 'milestones' / 'footer'
--   - title_xx + body_xx (4 語系):有些 row 只用 title (如卡片副標),body 留 null
--   - link_href:卡片用,連到圖鑑頁
--   - image_slot:卡片背景圖,對應 ui_images 的 slot id
--
-- 自動翻譯由 admin 點按鈕觸發,從 _zh 欄位呼叫 DeepSeek 翻譯填 _en / _ja / _ko。

create table if not exists public.collection_hub_content (
  id              text primary key,
  section         text not null check (section in ('page', 'card', 'cta', 'rule', 'milestones', 'footer')),
  title_zh        text,
  title_en        text,
  title_ja        text,
  title_ko        text,
  body_zh         text,
  body_en         text,
  body_ja         text,
  body_ko         text,
  link_href       text,
  image_slot      text,
  sort_order      int  not null default 100,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_hub_content_section_active
  on public.collection_hub_content (section, active, sort_order);

-- updated_at trigger
create or replace function public.touch_hub_content_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_hub_content_touch on public.collection_hub_content;
create trigger trg_hub_content_touch
  before update on public.collection_hub_content
  for each row execute function public.touch_hub_content_updated_at();

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table public.collection_hub_content enable row level security;

drop policy if exists "Public can read active hub content" on public.collection_hub_content;
create policy "Public can read active hub content"
  on public.collection_hub_content for select
  using (active = true);

drop policy if exists "Admins can read all hub content" on public.collection_hub_content;
create policy "Admins can read all hub content"
  on public.collection_hub_content for select
  using (public.is_current_user_admin());

-- 寫入只走 service_role(admin API route)

-- ─────────────────────────────────────────────
-- Seed — 跟原 /collection/page.tsx hardcode 對齊
-- ─────────────────────────────────────────────
insert into public.collection_hub_content
  (id, section, title_zh, title_en, title_ja, title_ko, body_zh, body_en, body_ja, body_ko, link_href, image_slot, sort_order)
values
  -- ── Page header ──
  ('page.title', 'page',
   '我的收藏中心', 'My Collection', '私のコレクション', '나의 수집 센터',
   null, null, null, null, null, null, 10),
  ('page.subtitle', 'page',
   '天天打開,慢慢集齊 64 卦與 78 張塔羅。每抽到一張新卡,圖鑑就從灰階變彩色 — 集滿里程碑還有點數獎勵。',
   'Open daily, slowly complete the 64 hexagrams and 78 tarot cards. Each new card turns from grey to colour in the encyclopedia — milestones grant credit rewards.',
   '毎日開いて、64卦と78枚のタロットを少しずつ集めていく。新カードを引くたびに図鑑がグレーからカラーに変わり、達成ごとにポイント報酬。',
   '매일 열어서 64괘와 78장 타로를 천천히 수집하세요. 새 카드를 뽑을 때마다 도감이 흑백에서 컬러로 바뀌고, 달성마다 포인트 보상.',
   null, null, null, null, null, null, 20),

  -- ── 兩張 hero 卡 ──
  ('card.iching', 'card',
   '易經卦象收藏', 'I Ching Hexagrams', '易経卦象収集', '주역 괘상 수집',
   '64 卦完整圖鑑', 'Complete 64 hexagrams', '64卦の完全図鑑', '64괘 완전 도감',
   '/iching/hexagrams', 'cta.iching', 30),
  ('card.tarot', 'card',
   '塔羅牌收藏', 'Tarot Cards', 'タロットカード収集', '타로 카드 수집',
   '78 張完整百科', 'Complete 78 cards', '78枚の完全百科', '78장 완전 백과',
   '/tarot/cards', 'cta.tarot', 40),

  -- ── 未登入 CTA ──
  ('cta.login', 'cta',
   '登入開始收集', 'Sign in & start', 'ログインして開始', '로그인하여 시작',
   '登入後即可開始收集,所有抽到的卡牌會自動寫入個人圖鑑。',
   'Sign in to start collecting — drawn cards auto-save to your personal encyclopedia.',
   'ログインで収集開始 — 引いたカードは自動的に個人図鑑に保存されます。',
   '로그인 후 수집 시작 — 뽑은 카드는 개인 도감에 자동 저장됩니다.',
   null, null, 50),

  -- ── 收集規則 section ──
  ('rules.section_title', 'rule',
   '收集規則', 'How It Works', '収集ルール', '수집 규칙',
   null, null, null, null, null, null, 60),
  ('rule.1', 'rule',
   '會收集到卡牌的占卜', 'Readings that count', '収集に算入される占い', '수집에 포함되는 점',
   '每日一抽(易經 / 塔羅)、主流占卜(易經三錢 / 塔羅各種牌陣)、梅花易數、方位卦象 — 抽到的卦象 / 牌都會寫入你的圖鑑。',
   'Daily draws (I Ching / Tarot), main readings (I Ching three-coin / Tarot spreads), Plum Blossom, Direction-Hexagram — every drawn hexagram or card is saved to your encyclopedia.',
   '毎日一回(易経 / タロット)、主流占い(易経三銭 / タロット各種スプレッド)、梅花易数、方位卦象 — 引いた卦象とカードは図鑑に保存されます。',
   '매일 한 번(주역 / 타로), 주요 점(주역 삼전 / 타로 각종 스프레드), 매화역수, 방위 괘상 — 뽑힌 괘와 카드는 도감에 저장됩니다.',
   null, null, 70),
  ('rule.2', 'rule',
   '不算收集的', 'What doesn''t count', '算入されないもの', '포함되지 않는 것',
   E'• Yes/No 是非占卜(輕量入口,不計入收集)\n• 衍伸占卜(同一件事的延伸對話)\n• 老師對話',
   E'• Yes/No quick readings (lightweight entry — not counted)\n• Follow-up readings (continuations of the same matter)\n• Chats with the master',
   E'• Yes/No 是非占い(軽量入口、算入なし)\n• フォローアップ占い(同じ件の継続会話)\n• 占い師との対話',
   E'• Yes/No 점(가벼운 입구, 미포함)\n• 후속 점(같은 건의 연장 대화)\n• 선생님과의 대화',
   null, null, 80),
  ('rule.3', 'rule',
   '易經:只記本卦', 'I Ching: only the primary hexagram', '易経:本卦のみ', '주역: 본괘만',
   '易經主流占卜 / 梅花 / 方位都會抽到「本卦 + 之卦」,但收藏只記入「本卦」。這樣每次占卜固定 +1 進度,符合直覺。',
   'I Ching main / Plum / Direction readings draw a primary + relating hexagram, but only the primary counts. Each reading reliably gives +1 progress — intuitive.',
   '易経の主流占い / 梅花 / 方位は「本卦 + 之卦」を引きますが、収集は「本卦」のみ。1回ごとに +1 で直感的。',
   '주역 주요 / 매화 / 방위 점은 본괘 + 지괘를 뽑지만, 수집은 본괘만. 매 점마다 +1 진행으로 직관적.',
   null, null, 90),
  ('rule.4', 'rule',
   '塔羅:每張抽到的牌都算', 'Tarot: every drawn card counts', 'タロット:引いたカード全て算入', '타로: 뽑힌 카드 모두 포함',
   '塔羅牌陣抽 N 張就會收 N 張(去重)。同一張牌重複抽到不會重複加進度,但抽次數會累積記錄。',
   'Whatever N cards a tarot spread draws, N cards are recorded (de-duped). Drawing the same card again doesn''t add progress, but obtain count is tracked.',
   'タロットスプレッドで N 枚引けば N 枚記録(重複排除)。同じカードを再度引いても進度は加算されませんが、入手回数は記録されます。',
   '타로 스프레드에서 N장 뽑으면 N장 기록(중복 제거). 같은 카드를 다시 뽑아도 진행은 추가되지 않지만 입수 횟수는 누적됩니다.',
   null, null, 100),
  ('rule.5', 'rule',
   '圖鑑:灰階 → 彩色', 'Encyclopedia: grey → colour', '図鑑:グレー → カラー', '도감: 흑백 → 컬러',
   '在 64 卦圖鑑與 78 張牌意百科裡,你還沒抽到的卡顯示為灰階;一旦抽到,圖會立刻變彩色,並出現金色 ✓ 標記。',
   'In the 64-hexagram and 78-card encyclopedias, cards you haven''t drawn appear in greyscale; once drawn, they turn full colour with a gold ✓ badge.',
   '64卦図鑑と78枚カード百科では、未入手のカードはグレースケール表示。引くと即座にフルカラー + 金色の ✓ マークが付きます。',
   '64괘 도감과 78장 카드 백과에서 미수집 카드는 흑백 표시. 뽑는 순간 풀컬러로 바뀌며 금색 ✓ 표시가 추가됩니다.',
   null, null, 110),

  -- ── 里程碑 section ──
  ('milestones.section_title', 'milestones',
   '里程碑獎勵', 'Milestone Rewards', '達成報酬', '달성 보상',
   null, null, null, null, null, null, 120),
  ('milestones.intro', 'milestones',
   null, null, null, null,
   '達成下列里程碑會自動獲得點數獎勵(只發一次,已領過的會打勾)。獎勵自動入帳,不用手動領。',
   'Hitting any milestone below auto-grants the credits below (one-time per milestone — earned ones show ✓). Rewards arrive instantly, no manual claim.',
   '以下の達成項目で自動的にポイント報酬がもらえます(1回限り、達成済みは ✓ 表示)。即時入金、手動受取不要。',
   '아래 달성 항목에서 자동으로 포인트 보상이 지급됩니다(1회 한정, 달성한 것은 ✓ 표시). 즉시 입금, 수동 수령 불필요.',
   null, null, 130),
  ('milestones.iching_title', 'milestones',
   '🪙 易經 64 卦', '🪙 I Ching 64', '🪙 易経 64卦', '🪙 주역 64괘',
   null, null, null, null, null, null, 140),
  ('milestones.tarot_title', 'milestones',
   '🃏 塔羅 78 張', '🃏 Tarot 78', '🃏 タロット 78枚', '🃏 타로 78장',
   null, null, null, null, null, null, 150),

  -- ── 底部提醒 ──
  ('footer.note', 'footer',
   null, null, null, null,
   '獲得的點數可用於主流占卜 / 衍伸 / 老師對話 / Yes/No / 每日一抽。',
   'Earned credits can be spent on main readings / follow-ups / chat / Yes/No / daily draws.',
   '獲得したポイントは主流占い / フォローアップ / 対話 / Yes/No / 毎日一抽に使えます。',
   '획득한 포인트는 주요 점 / 후속 / 대화 / Yes/No / 매일 점에 사용할 수 있습니다.',
   null, null, 160)
on conflict (id) do nothing;
