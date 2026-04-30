"use client";

/**
 * 梅花易數 · 時間起卦 — 詳細介紹頁的 client view。
 *
 * 內容五大段:
 *   1. 歷史與緣起(邵雍與「觀梅占」)
 *   2. 起卦公式(逐步說明 mod 8 / mod 6)
 *   3. 先天八卦序對應表(1-8 與三爻 code)
 *   4. 動爻與之卦的解讀方式
 *   5. 心法提醒
 *
 * 結尾 CTA 按鈕直接導到 /iching/plum 開始卜卦 — 此頁是這個占法的唯一入口。
 *
 * 切語系時 useLanguage() 會直接 re-render,免 round-trip。
 */

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { trigramNames } from "@/data/hexagrams";
import {
  PLUM_TRIGRAM_CODES,
  PLUM_TRIGRAM_NAMES_ZH,
} from "@/lib/iching/plum";

interface MultilingualText {
  zh: string;
  en: string;
  ja: string;
  ko: string;
}

const HISTORY: MultilingualText = {
  zh: "梅花易數相傳為北宋大儒邵雍(字堯夫,諡康節,1011–1077)所創。邵雍精於象數之學,其代表作《皇極經世書》以數推天地之變。傳世故事「觀梅占」記載:邵雍見二雀爭枝,墜地而折,以此起卦,推得明日有少女折花墜傷。其核心理念為「萬物皆數」 — 一切現象皆可化為數,而數可成卦。占法的優勢在於「不需要工具」 — 看到突發狀況、心生疑念、聽到聲響、隨手抓得一物,皆可即時起卦。",
  en: "Plum Blossom Numerology is traditionally attributed to Shao Yong (1011–1077), the great Song-dynasty scholar known by his courtesy name Yaofu and posthumous title Kangjie. Master of the school of 'images and numbers' (象數), Shao Yong's magnum opus, the Huangji Jingshi, derives cosmic change from number itself. The famous 'Observing Plum' anecdote tells how he saw two sparrows fighting for a branch, then watched them fall and break the limb — from this he cast a hexagram and foresaw a girl injuring herself the next day. The core idea: 'all things are numbers'. The advantage of this method is that no tools are required — a sudden event, a passing thought, a sound, an object grabbed at hand can all become a cast.",
  ja: "梅花易数は北宋の大儒・邵雍(字は堯夫、諡は康節、1011–1077)の創始と伝わる。邵雍は象数の学に精通し、代表作『皇極経世書』は数によって天地の変を推した。「観梅占」の故事はこう伝える:邵雍、二雀が枝を争い、墜ちて枝が折れるを見て立卦し、翌日に少女が花を折って傷つくと推した。核心は「万物は数」 — 一切の現象は数に化し、数は卦と成る。利点は「道具不要」 — 突発の事、心の疑念、聞こえた音、手に取った物、いずれも即座に立卦できる。",
  ko: "매화역수는 북송의 대유학자 소옹(자는 요부, 시호는 강절, 1011–1077)이 창안한 것으로 전해집니다. 소옹은 상수학에 정통하여, 대표작 《황극경세서》는 수로써 천지의 변화를 추리합니다. '관매점' 일화에 따르면 소옹은 참새 두 마리가 가지를 다투다 떨어져 가지가 부러지는 것을 보고 점을 쳐, 이튿날 소녀가 꽃을 꺾다 다칠 것을 예견했습니다. 핵심 사상은 '만물은 수' — 모든 현상은 수로 화하고, 수는 괘로 이루어집니다. 장점은 '도구가 필요 없음' — 갑작스런 사건, 마음에 떠오른 의문, 들려온 소리, 손에 잡힌 물건, 어느 것이든 즉시 점칠 수 있습니다.",
};

interface FormulaStep {
  title: MultilingualText;
  formula: string;
  body: MultilingualText;
}

const FORMULA_STEPS: FormulaStep[] = [
  {
    title: {
      zh: "第一步 · 算上卦",
      en: "Step 1 · Compute the Upper Trigram",
      ja: "第一段 · 上卦を算す",
      ko: "1단계 · 상괘를 셈하다",
    },
    formula: "(年 + 月 + 日 + 時) mod 8 = 上卦",
    body: {
      zh: "把當下的年、月、日、時加總,除以 8 取餘數,即為上卦在先天八卦序中的編號(1=乾、2=兌、3=離、4=震、5=巽、6=坎、7=艮、8=坤)。整除時取 8(坤)。",
      en: "Sum the current year, month, day, and hour; the remainder mod 8 is the index of the upper trigram in the Earlier-Heaven sequence (1=Qian, 2=Dui, 3=Li, 4=Zhen, 5=Xun, 6=Kan, 7=Gen, 8=Kun). When divisible, take 8 (Kun).",
      ja: "現在の年・月・日・時を合計し、8で割った余りが上卦の先天八卦序番号(1=乾、2=兌、3=離、4=震、5=巽、6=坎、7=艮、8=坤)。割り切れる時は8(坤)とする。",
      ko: "현재의 연·월·일·시를 더한 뒤 8로 나눈 나머지가 상괘의 선천팔괘 순서 번호입니다(1=건, 2=태, 3=리, 4=진, 5=손, 6=감, 7=간, 8=곤). 나누어떨어질 때는 8(곤)을 취합니다.",
    },
  },
  {
    title: {
      zh: "第二步 · 算下卦",
      en: "Step 2 · Compute the Lower Trigram",
      ja: "第二段 · 下卦を算す",
      ko: "2단계 · 하괘를 셈하다",
    },
    formula: "(年 + 月 + 日 + 時 + 分) mod 8 = 下卦",
    body: {
      zh: "把第一步的總和再加上「分」,除以 8 取餘數,即為下卦的編號。同小時不同分鐘會落入不同的卦,以保證每一刻都是獨一無二的天問。(註:邵雍原法只用到「時」、不到「分」,本 app 為現代簡化版,加入「分」以利同小時內仍可變卦。)",
      en: "Add the minute to step 1's sum; the remainder mod 8 is the lower trigram. Different minutes within the same hour fall to different hexagrams, ensuring each moment is a unique question to heaven. (Note: Shao Yong's original formula used the 2-hour timeblock alone; we add minutes as a modern adaptation.)",
      ja: "第一段の合計に「分」を加え、8で割った余りが下卦の番号。同一時間内でも分が違えば別の卦となり、每瞬が独自の天問となる。(註:邵雍原法は時辰までで分は用いない。本実装は現代版として分を加えた。)",
      ko: "1단계 합계에 '분'을 더한 뒤 8로 나눈 나머지가 하괘의 번호. 같은 시간이라도 분이 다르면 다른 괘가 되어, 매 순간이 고유한 하늘에 대한 물음이 됩니다. (참고: 소옹 원법은 시진까지만 쓰고 분은 쓰지 않습니다. 본 구현은 현대판으로 분을 추가했습니다.)",
    },
  },
  {
    title: {
      zh: "第三步 · 算動爻",
      en: "Step 3 · Compute the Changing Line",
      ja: "第三段 · 動爻を算す",
      ko: "3단계 · 동효를 셈하다",
    },
    formula: "(年 + 月 + 日 + 時 + 分) mod 6 = 動爻位",
    body: {
      zh: "用同樣的總和(含分),除以 6 取餘數,即為動爻位置(1-6,自下而上)。動爻揭示「事如何變」 — 將本卦中該爻翻轉(陽變陰、陰變陽)即得「之卦」,代表事情演變後的狀態。整除時取 6(最上爻動)。",
      en: "Using the same total (with minutes), remainder mod 6 is the changing line position (1-6, bottom to top). The changing line reveals 'how the matter shifts' — flipping that line in the primary hexagram (yang↔yin) gives the relating hexagram, the state after change. When divisible, take 6 (top line changes).",
      ja: "同じ合計(分を含む)を6で割った余りが動爻の位置(1-6、下から上)。動爻は「事の変じ方」を示す — 本卦のその爻を翻せば(陽↔陰)、之卦を得て、変化後の状態を表す。割り切れる時は6(上爻動)。",
      ko: "동일한 합계(분 포함)를 6으로 나눈 나머지가 동효의 위치(1-6, 아래에서 위로). 동효는 '일이 어떻게 변하는가'를 알려주며, 본괘의 그 효를 뒤집으면(양↔음) 지괘를 얻습니다 — 변화 후의 상태입니다. 나누어떨어질 때는 6(상효동)을 취합니다.",
    },
  },
];

const READING_NOTES: { title: MultilingualText; body: MultilingualText }[] = [
  {
    title: {
      zh: "本卦 · 事之本相",
      en: "Primary Hexagram · The Essence",
      ja: "本卦 · 事の本相",
      ko: "본괘 · 일의 본질",
    },
    body: {
      zh: "本卦是當下這個問題的整體面貌與基調 — 是順是逆、是動是靜、是聚是散。先看本卦的卦名與卦辭,定下大方向。",
      en: "The primary hexagram is the overall face and tone of the matter at this moment — favorable or adverse, active or still, gathering or dispersing. Read its name and judgment first to set the broad direction.",
      ja: "本卦は今この問いの全体像と基調 — 順か逆か、動か静か、聚か散か。まず卦名と卦辞を読み、大方向を定める。",
      ko: "본괘는 지금 이 물음의 전체 모습과 기조입니다 — 순한가 거스르는가, 움직이는가 고요한가, 모이는가 흩어지는가. 먼저 괘명과 괘사를 읽어 큰 방향을 정합니다.",
    },
  },
  {
    title: {
      zh: "動爻 · 當下關鍵",
      en: "Changing Line · The Pivot Now",
      ja: "動爻 · 当下の要",
      ko: "동효 · 지금의 핵심",
    },
    body: {
      zh: "動爻的爻辭是當下最關鍵的提示 — 它告訴你「現在這一刻,該怎麼下手」。比卦辭更具體、更貼近行動。",
      en: "The changing line's text is the sharpest cue for the present — it tells you what to do at this moment. More concrete and action-oriented than the overall judgment.",
      ja: "動爻の爻辞は今この瞬間で最も重要な示唆 — 「今、何を為すべきか」を語る。卦辞より具体的で行動寄り。",
      ko: "동효의 효사는 지금 이 순간 가장 중요한 힌트 — '지금 무엇을 해야 하는가'를 알려줍니다. 괘사보다 구체적이고 행동 지향적입니다.",
    },
  },
  {
    title: {
      zh: "之卦 · 事之走向",
      en: "Relating Hexagram · The Direction",
      ja: "之卦 · 事の行方",
      ko: "지괘 · 일의 흐름",
    },
    body: {
      zh: "之卦是事情演變後的狀態 — 從本卦走到之卦這條路徑,即為事的整體運動方向。本卦吉而之卦更吉,主越走越好;本卦吉而之卦凶,主先順後逆,需提防。",
      en: "The relating hexagram is the state after change — the path from primary to relating is the overall motion of the matter. Primary auspicious + relating more auspicious means improvement; primary auspicious + relating challenging means the path turns adverse — be vigilant.",
      ja: "之卦は事の変じた後の状態 — 本卦から之卦への経路こそが事の運動方向。本卦吉で之卦更に吉なら好転、本卦吉で之卦凶なら順から逆へ、警戒すべし。",
      ko: "지괘는 변한 후의 상태 — 본괘에서 지괘로 가는 경로가 일의 전체 운동 방향. 본괘가 길하고 지괘가 더 길하면 점점 좋아지며, 본괘가 길하나 지괘가 흉하면 순에서 역으로 흘러가니 경계해야 합니다.",
    },
  },
];

const MIND_NOTES: MultilingualText[] = [
  {
    zh: "梅花占重「機」 — 動念之時即是天問之時。心中起問,即按按鈕,不要遲疑試三遍。",
    en: "Plum Blossom hinges on the 'moment' (機) — when the thought arises, it is the moment to ask heaven. As soon as the question forms in your mind, press the button. Do not hesitate or try three times.",
    ja: "梅花占は「機」を重んじる — 念が動く其の時こそ天問の時。心中で問いが立てば、すぐにボタンを押せ。躊躇して三度試すべからず。",
    ko: "매화점은 '기(機)'를 중시합니다 — 생각이 움직이는 그 순간이 곧 하늘에 묻는 때입니다. 마음에 물음이 떠오르면 바로 버튼을 누르세요. 망설이며 세 번 시도하지 마십시오.",
  },
  {
    zh: "同一事不宜反覆占問 — 「初筮告,再三瀆,瀆則不告」(〈蒙〉卦卦辭)。第一次的卦,即是答案。",
    en: "Do not divine the same matter repeatedly — 'The first cast tells; further casts profane it, and the profaned does not speak' (the judgment of Meng). The first cast is the answer.",
    ja: "同一事を繰り返し占うべからず — 「初筮告ぐ、再三瀆す、瀆さば告げず」(〈蒙〉卦卦辞)。最初の卦こそが答え。",
    ko: "같은 일을 반복해 점치지 마세요 — '처음 점은 알리지만 거듭하면 모독이 되어 알리지 않는다'(〈몽〉괘 괘사). 첫 점이 곧 답입니다.",
  },
  {
    zh: "卦象示「機」非「定」。吉卦仍需努力,凶卦可警惕避禍 — 占卜的本意是修身進德,而非預測命運。",
    en: "The hexagram shows the 'opportunity' (機), not the 'fixed'. An auspicious cast still demands effort; an inauspicious one warns to avoid harm — the true purpose of divination is to refine character, not foretell fate.",
    ja: "卦は「機」を示し「定」ならず。吉卦も努力を要し、凶卦は禍を避ける警め — 占卜の本意は修身進徳にして、運命予知にあらず。",
    ko: "괘는 '기(機)'를 보일 뿐 '정해진 것'이 아닙니다. 길괘도 노력이 필요하며, 흉괘는 화를 피하라는 경계 — 점복의 본뜻은 수신진덕에 있지 운명 예측에 있지 않습니다.",
  },
];

export default function PlumBlossomMethodView() {
  const { t } = useLanguage();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px" }}>
      <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
        <Link
          href="/iching/methods"
          style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}
        >
          ← {t(
            "卜卦方式介紹",
            "I Ching Methods",
            "卜卦の方法",
            "주역 점치는 법"
          )}
        </Link>
      </nav>

      <header style={{ textAlign: "center", marginBottom: 36 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: 3,
            color: "rgba(212,168,85,0.7)",
            marginBottom: 6,
          }}
        >
          {t(
            "即時 · 萬物皆數",
            "INSTANT · ALL THINGS ARE NUMBERS",
            "即時 · 万物は数",
            "즉시 · 만물은 수"
          )}
        </p>
        <h1
          className="text-gold-gradient"
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 32,
            fontWeight: 700,
            margin: 0,
          }}
        >
          {t(
            "梅花易數 · 時間起卦",
            "Plum Blossom Numerology · Time Casting",
            "梅花易数 · 時間起卦",
            "매화역수 · 시간 기괘"
          )}
        </h1>
        <p
          style={{
            color: "#c0c0d0",
            fontSize: 14,
            marginTop: 10,
            lineHeight: 1.7,
            maxWidth: 600,
            margin: "10px auto 0",
          }}
        >
          {t(
            "宋代邵雍創。以當下年月日時分為數,經 mod 8 / mod 6 推得本卦、動爻與之卦 — 不需要銅錢、不需要羅盤,動念即可起卦。",
            "Founded by Shao Yong in the Song dynasty. Using the year, month, day, hour, and minute of the moment as numbers, applying mod-8 and mod-6 to derive the primary hexagram, changing line, and relating hexagram — no coins, no compass, just the rising of the thought itself.",
            "宋代の邵雍が創始。現在の年月日時分を数とし、mod 8 / mod 6 で本卦・動爻・之卦を導く — 銅銭も羅盤も要らず、念を動かす其の時に立卦できる。",
            "송대 소옹이 창안. 현재의 연월일시분을 수로 삼아 mod 8 / mod 6 으로 본괘·동효·지괘를 도출 — 동전도 나침반도 필요 없고, 생각이 움직이는 그 순간 점칠 수 있습니다."
          )}
        </p>
      </header>

      {/* 1. 歷史與緣起 */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 22,
            color: "#d4a855",
            marginBottom: 16,
            borderLeft: "3px solid #d4a855",
            paddingLeft: 12,
          }}
        >
          {t(
            "歷史 · 邵雍與觀梅占",
            "History · Shao Yong and the Plum",
            "歴史 · 邵雍と観梅占",
            "역사 · 소옹과 관매점"
          )}
        </h2>
        <article
          style={{
            background: "rgba(13,13,43,0.55)",
            border: "1px solid rgba(212,168,85,0.22)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.95, margin: 0 }}>
            {t(HISTORY.zh, HISTORY.en, HISTORY.ja, HISTORY.ko)}
          </p>
        </article>
      </section>

      {/* 2. 起卦公式 */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 22,
            color: "#d4a855",
            marginBottom: 16,
            borderLeft: "3px solid #d4a855",
            paddingLeft: 12,
          }}
        >
          {t("起卦公式", "The Formula", "起卦の公式", "기괘 공식")}
        </h2>
        <p
          style={{
            color: "rgba(192,192,208,0.7)",
            fontSize: 13,
            marginBottom: 18,
            marginLeft: 14,
            lineHeight: 1.7,
          }}
        >
          {t(
            "本 app 採「現代簡化版」:用公曆原始數字 + 24 小時制 + 真實分鐘。邵雍原法用農曆地支年(子=1...亥=12)且只到時辰。",
            "We use a 'modern simplified' variant: raw Gregorian numbers + 24-hour clock + real minutes. Shao Yong's original used the lunar calendar with 12-branch year numbering (Zi=1...Hai=12) and the 2-hour timeblock.",
            "本アプリは「現代簡略版」を採用:公暦の素の数値 + 24時間制 + 実分。邵雍原法は農暦+地支年(子=1...亥=12)で時辰まで。",
            "본 앱은 '현대 간략판'을 사용: 공력 원래 숫자 + 24시간제 + 실제 분. 소옹 원법은 음력 + 지지년(자=1...해=12)이며 시진까지."
          )}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {FORMULA_STEPS.map((s, i) => (
            <article
              key={i}
              style={{
                background: "rgba(13,13,43,0.55)",
                border: "1px solid rgba(212,168,85,0.22)",
                borderRadius: 12,
                padding: 18,
              }}
            >
              <h3
                style={{
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 17,
                  color: "#fde68a",
                  margin: "0 0 8px",
                }}
              >
                {t(s.title.zh, s.title.en, s.title.ja, s.title.ko)}
              </h3>
              <div
                style={{
                  background: "rgba(212,168,85,0.08)",
                  border: "1px solid rgba(212,168,85,0.2)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontFamily: "monospace",
                  fontSize: 14,
                  color: "#fde68a",
                  marginBottom: 10,
                }}
              >
                {s.formula}
              </div>
              <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.85, margin: 0 }}>
                {t(s.body.zh, s.body.en, s.body.ja, s.body.ko)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* 3. 先天八卦序 */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 22,
            color: "#d4a855",
            marginBottom: 8,
            borderLeft: "3px solid #d4a855",
            paddingLeft: 12,
          }}
        >
          {t(
            "先天八卦序對應",
            "The Earlier-Heaven Trigram Sequence",
            "先天八卦序の対応",
            "선천팔괘 순서 대응"
          )}
        </h2>
        <p
          style={{
            color: "rgba(192,192,208,0.7)",
            fontSize: 13,
            marginBottom: 18,
            marginLeft: 14,
            lineHeight: 1.7,
          }}
        >
          {t(
            "梅花易數採用先天八卦的數序(伏羲八卦),與後天八卦(文王八卦,用於方位卦象合參)不同。下表是 mod 8 結果對應的卦象。",
            "Plum Blossom uses the Earlier-Heaven (Fuxi) sequence, distinct from the Later-Heaven (King Wen) directional sequence used in Direction × Hexagram. The table shows the trigram for each mod-8 result.",
            "梅花易数は先天八卦(伏羲八卦)の序を採用し、方位×卦象で用いる後天八卦(文王八卦)とは異なる。下表は mod 8 の結果と卦象の対応。",
            "매화역수는 선천팔괘(복희팔괘) 순서를 사용하며, 방위·괘상에서 쓰는 후천팔괘(문왕팔괘)와 다릅니다. 아래 표는 mod 8 결과에 해당하는 괘상입니다."
          )}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          {PLUM_TRIGRAM_CODES.map((code, i) => {
            const tg = trigramNames[code];
            const num = i + 1;
            const zhName = PLUM_TRIGRAM_NAMES_ZH[i];
            const tgName = t(tg.zh, tg.en, tg.ja, tg.ko);
            const matters = t(tg.mattersZh, tg.mattersEn, tg.mattersJa, tg.mattersKo);
            return (
              <div
                key={code}
                style={{
                  background: "rgba(13,13,43,0.5)",
                  border: "1px solid rgba(212,168,85,0.18)",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      color: "rgba(212,168,85,0.7)",
                      fontSize: 12,
                    }}
                  >
                    {num}.
                  </span>
                  <span style={{ fontSize: 22, color: "#d4a855", lineHeight: 1 }}>
                    {tg.symbol}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Noto Serif TC', serif",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#fde68a",
                    }}
                  >
                    {t(zhName, tg.en.split(" ")[0], zhName, zhName)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(192,192,208,0.6)", marginBottom: 4 }}>
                  {tgName}
                </div>
                <p
                  style={{
                    color: "rgba(192,192,208,0.85)",
                    fontSize: 11.5,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {matters}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. 動爻與之卦 */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 22,
            color: "#d4a855",
            marginBottom: 16,
            borderLeft: "3px solid #d4a855",
            paddingLeft: 12,
          }}
        >
          {t(
            "本卦 · 動爻 · 之卦",
            "Primary · Changing Line · Relating",
            "本卦 · 動爻 · 之卦",
            "본괘 · 동효 · 지괘"
          )}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {READING_NOTES.map((n, i) => (
            <article
              key={i}
              style={{
                background: "rgba(13,13,43,0.5)",
                border: "1px solid rgba(212,168,85,0.18)",
                borderRadius: 10,
                padding: 16,
              }}
            >
              <h3
                style={{
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 16,
                  color: "#fde68a",
                  margin: "0 0 6px",
                }}
              >
                {t(n.title.zh, n.title.en, n.title.ja, n.title.ko)}
              </h3>
              <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.85, margin: 0 }}>
                {t(n.body.zh, n.body.en, n.body.ja, n.body.ko)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* 5. 心法提醒 */}
      <section style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 22,
            color: "#d4a855",
            marginBottom: 16,
            borderLeft: "3px solid #d4a855",
            paddingLeft: 12,
          }}
        >
          {t("心法提醒", "Mind Notes", "心法", "마음가짐")}
        </h2>
        <div
          style={{
            background: "rgba(13,13,43,0.55)",
            border: "1px solid rgba(212,168,85,0.22)",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <ul
            style={{
              margin: 0,
              padding: "0 0 0 20px",
              color: "#e8e8f0",
              fontSize: 14,
              lineHeight: 2,
            }}
          >
            {MIND_NOTES.map((note, i) => (
              <li key={i}>{t(note.zh, note.en, note.ja, note.ko)}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background:
            "linear-gradient(135deg, rgba(212,168,85,0.14), rgba(139,92,246,0.10))",
          border: "1px solid rgba(212,168,85,0.4)",
          borderRadius: 14,
          padding: 28,
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        <h3
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 22,
            color: "#d4a855",
            marginBottom: 10,
          }}
        >
          {t(
            "心中已有問題?",
            "Have a question in mind?",
            "心に問いはあるか?",
            "마음에 물음이 있나요?"
          )}
        </h3>
        <p
          style={{
            color: "#c0c0d0",
            fontSize: 13.5,
            marginBottom: 18,
            lineHeight: 1.75,
            maxWidth: 480,
            margin: "0 auto 18px",
          }}
        >
          {t(
            "梅花占重「機」 — 動念之時即是天問之時。按下按鈕的那一刻,即是答案開始的那一刻。",
            "Plum Blossom hinges on the moment — when the thought arises, the answer is already here. The moment you press the button is the moment the answer begins.",
            "梅花占は「機」を重んじる — 念が動く此の時こそ天問の時。ボタンを押す其の一瞬が答えの始まる時。",
            "매화점은 '기(機)'를 중시합니다 — 생각이 움직이는 그 순간이 답의 때. 버튼을 누르는 그 순간이 답이 시작되는 때입니다."
          )}
        </p>
        <Link
          href="/iching/plum"
          style={{
            display: "inline-block",
            padding: "14px 36px",
            background: "linear-gradient(135deg, #d4a855, #f0d78c)",
            color: "#0a0a1a",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 15,
            boxShadow: "0 4px 20px rgba(212,168,85,0.25)",
          }}
        >
          ✦ {t(
            "開始時間起卦",
            "Begin · Cast at This Moment",
            "時間起卦を始める",
            "시간 기괘 시작"
          )}
        </Link>
        <p
          style={{
            fontSize: 11,
            color: "rgba(212,168,85,0.6)",
            marginTop: 12,
          }}
        >
          {t(
            "登入會員每次扣 5 點(訪客可體驗,但不存記錄、無扣點)",
            "5 credits per cast for logged-in members (guests preview only — no record, no charge)",
            "ログイン会員は1回 5 ポイント(ゲストは記録なし・課金なしで体験可)",
            "로그인 회원은 1회 5 포인트(게스트는 기록·차감 없이 체험 가능)"
          )}
        </p>
      </section>
    </div>
  );
}
