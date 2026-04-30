"use client";

/**
 * MethodsView — 易經卜卦方式介紹的 client view。
 *
 * 跟 hexagrams 系列頁同一套 server-shell + client-view pattern,讓切語系時
 * useLanguage() React state 變動就直接 re-render,不必 router.refresh()。
 */

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";

interface Method {
  id: string;
  /** 顯示在卡片左上的小編號(中) */
  numberZh: string;
  /** 顯示在卡片左上的小編號(英) */
  numberEn: string;
  /** 名稱:中 / 英 / 日 / 韓 */
  nameZh: string;
  nameEn: string;
  nameJa?: string;
  nameKo?: string;
  /** 一句話 tagline */
  taglineZh: string;
  taglineEn: string;
  taglineJa?: string;
  taglineKo?: string;
  /** 詳細說明 */
  bodyZh: string;
  bodyEn: string;
  bodyJa?: string;
  bodyKo?: string;
  /** 主要難度:simple / classical / instant / advanced */
  tier: "simple" | "classical" | "instant" | "advanced";
  /** 若有獨立詳細介紹頁,放路徑;否則 undefined */
  detailHref?: string;
}

const METHODS: Method[] = [
  {
    id: "three-coin",
    numberZh: "1",
    numberEn: "1",
    nameZh: "三錢法",
    nameEn: "Three-Coin Method",
    nameJa: "三銭法",
    nameKo: "삼전법",
    tier: "simple",
    taglineZh: "現代最常用的卜卦法,六次擲錢成卦",
    taglineEn: "The most popular modern method — six tosses form a hexagram",
    taglineJa: "現代で最も使われる方法 — 6回投げて卦を作る",
    taglineKo: "현대에서 가장 흔히 쓰는 방법 — 여섯 번 던져 괘를 만듭니다",
    bodyZh:
      "準備三枚相同的銅錢(或硬幣),正面為陽(3 點),反面為陰(2 點)。連續擲六次,自下而上得六爻成卦。每次三枚錢的點數總和落在 6 / 7 / 8 / 9:6 是老陰(變)、7 是少陽、8 是少陰、9 是老陽(變)。老陰、老陽即為「變爻」,會由「本卦」變化出「之卦」,代表事件的發展方向。儀式感與精準度的平衡點,本 app 主流程預設用此法。",
    bodyEn:
      "Prepare three identical coins. Heads = yang (3 points), tails = yin (2 points). Toss six times; the bottom toss is line 1, the top toss is line 6. The sum of each toss falls on 6/7/8/9: 6 is Old Yin (changing), 7 is Young Yang, 8 is Young Yin, 9 is Old Yang (changing). Old Yin and Old Yang are 'changing lines', transforming the primary hexagram into a relating hexagram, which reveals the direction of change. A balance of ritual feel and precision — this app's main flow uses this method by default.",
    bodyJa:
      "同じ硬貨を3枚用意。表が陽(3点)、裏が陰(2点)。6回投げ、下から順に六爻を作ります。3枚の合計が6/7/8/9のいずれかになり、6は老陰(変)、7は少陽、8は少陰、9は老陽(変)。老陰・老陽は「変爻」となり、本卦から之卦を生み、変化の方向を示します。儀式性と精密さのバランスが良く、本アプリのメインフローはこの方法を採用しています。",
    bodyKo:
      "동일한 동전 세 개를 준비합니다. 앞면이 양(3점), 뒷면이 음(2점). 여섯 번 던져 아래에서 위로 여섯 효를 만듭니다. 세 동전의 합이 6/7/8/9 중 하나가 되며, 6은 노음(변), 7은 소양, 8은 소음, 9는 노양(변)입니다. 노음과 노양은 '변효'가 되어 본괘에서 지괘를 만들고 변화의 방향을 보여줍니다. 의식성과 정밀성의 균형이 좋아, 본 앱의 메인 플로우가 기본으로 사용하는 방법입니다.",
  },
  {
    id: "plum-blossom",
    numberZh: "2",
    numberEn: "2",
    nameZh: "梅花易數",
    nameEn: "Plum Blossom Numerology",
    nameJa: "梅花易数",
    nameKo: "매화역수",
    tier: "instant",
    taglineZh: "宋代邵雍創,用時間或數字直接起卦",
    taglineEn: "Founded by Shao Yong; cast a hexagram from time or numbers",
    taglineJa: "宋代の邵雍が創始 — 時刻や数字から直接卦を立てる",
    taglineKo: "송대 소옹이 창안 — 시간이나 숫자로 바로 괘를 세웁니다",
    bodyZh:
      "宋代邵雍所創,核心是「萬物皆數」。最知名是「時間起卦」:用問事當下的年月日時數字,經模 8 / 模 6 算出上卦、下卦與動爻。也可用任意三個數字(出生日期、隨機數、聲音次數等)起卦。優勢是「不需要工具」,看到突發狀況立刻能起卦,適合即時應對。缺點是依賴運算技巧,需要記住起卦公式。本 app 沒做時間起卦的入口,但你可以把算出來的卦號直接到 64 卦介紹頁查。",
    bodyEn:
      "Created by Shao Yong in the Song dynasty; core idea: 'all things are numbers'. The most famous is 'time-based casting': use the date-time of the question, applying mod-8 and mod-6 arithmetic to derive upper trigram, lower trigram, and changing line. You can also use any three numbers (birthday, random, sound counts). The advantage: no tools needed — you can cast for sudden situations immediately. The downside: requires memorizing the formulas. We haven't built a time-casting entry point, but you can look up the resulting hexagram on the 64-Hexagram encyclopedia.",
    bodyJa:
      "宋代の邵雍が創始した方法で、「万物は数」を中心思想とします。最も有名なのは「時間起卦」:質問時の年月日時を使い、8で割った余り・6で割った余りで上卦、下卦、動爻を導出します。任意の3つの数字(誕生日、ランダム、音の回数など)でも可能。利点は「道具不要」 — 急な場面で即座に立卦できます。欠点は計算方法を覚える必要があること。本アプリには時間起卦の入口はありませんが、得られた卦番号を64卦解説ページで調べられます。",
    bodyKo:
      "송대 소옹이 창안한 방법으로, '만물은 수' 사상을 핵심으로 합니다. 가장 유명한 것은 '시간 기괘': 질문 당시의 연월일시 숫자를 모듈로 8 / 모듈로 6으로 계산해 상괘·하괘·동효를 도출합니다. 임의의 세 숫자(생일·랜덤·소리 횟수 등)도 사용 가능합니다. 장점은 '도구 불필요' — 갑작스런 상황에서 즉시 점칠 수 있습니다. 단점은 공식을 외워야 한다는 점. 본 앱에는 시간 기괘 입구가 없지만, 도출된 괘 번호를 64괘 백과에서 찾아볼 수 있습니다.",
  },
  {
    id: "instant-draw",
    numberZh: "3",
    numberEn: "3",
    nameZh: "抽卦速答法",
    nameEn: "Instant Draw",
    nameJa: "即引き法",
    nameKo: "즉석 뽑기",
    tier: "instant",
    taglineZh: "本 app 的 Yes / No 速答,直接抽 64 卦其一",
    taglineEn: "What our Yes/No Quick Answer uses — pull one of the 64 directly",
    taglineJa: "本アプリの Yes/No 速答が使う方法 — 64卦から1つを直接引く",
    taglineKo: "본 앱의 Yes/No 속답이 쓰는 방법 — 64괘 중 하나를 바로 뽑기",
    bodyZh:
      "現代簡化版:不擲銅錢、不算變爻,直接從 64 卦中抽一個,以該卦的吉凶傾向作答。儀式感最低、決策時間最短,適合日常生活中「想快速看一眼方向」的小事。本 app 的「Yes / No 一卦速答」與「每日一卦」就是用這種方式 — 後者用「使用者 ID + 今天日期」當亂數種子,確保同一個人同一天看到同一卦,維持每日訊息的儀式感。",
    bodyEn:
      "A modern simplification: no coin tossing, no changing lines — pull one of the 64 hexagrams directly and use its auspicious/inauspicious tendency as the answer. Lowest ritual, fastest decision — good for everyday 'quick look at the direction' questions. Our app's 'Yes/No Quick Answer' and 'Daily Hexagram' use this approach — the latter uses 'user ID + today's date' as the random seed, ensuring the same person sees the same hexagram all day, preserving the ritual feel of the daily message.",
    bodyJa:
      "現代の簡略版:銭を投げず、変爻も計算せず、64卦から1つを直接引き、その卦の吉凶傾向で回答します。儀式性が最も低く、決断時間が最短で、日常の「ちょっと方向性を見たい」小事に向いています。本アプリの「Yes/No 速答」と「毎日の卦」がこの方式 — 後者は「ユーザID + 今日の日付」を乱数シードにして、同一人物が同日に同じ卦を見るようにし、日々のメッセージの儀式感を保ちます。",
    bodyKo:
      "현대의 단순화 버전: 동전을 던지지 않고 변효도 계산하지 않으며, 64괘에서 하나를 바로 뽑아 그 괘의 길흉 경향으로 답합니다. 의식성이 가장 낮고 결정 시간이 가장 짧아 일상의 '방향만 잠깐 보고 싶은' 소소한 일에 적합합니다. 본 앱의 'Yes/No 속답'과 '오늘의 괘'가 이 방식 — 후자는 '사용자 ID + 오늘 날짜'를 난수 씨드로 사용해 같은 사람이 같은 날에 같은 괘를 보도록 하여 매일 메시지의 의식성을 유지합니다.",
  },
  {
    id: "direction-hexagram",
    numberZh: "4",
    numberEn: "4",
    nameZh: "方位卦象合參",
    nameEn: "Direction × Hexagram Combined",
    nameJa: "方位×卦象 合参",
    nameKo: "방위·괘상 합참",
    tier: "advanced",
    taglineZh: "先卜方位定「事之所在」,再卜卦象明「事之走向」",
    taglineEn:
      "First divine the direction (where the matter lies); then the hexagram (how it unfolds)",
    taglineJa: "先に方位で「事の在処」を定め、卦象で「事の行方」を見る",
    taglineKo: "먼저 방위로 '일의 자리'를 정하고, 괘상으로 '일의 흐름'을 봅니다",
    bodyZh:
      "結合後天八卦方位與六十四卦的兩段式占法。第一步用羅盤式轉動取得後天八卦其一,定位「事之所在 / 應於誰」;第二步用三錢法擲六次取得完整六十四卦,讀「事情如何演變」。最後合參:方位告訴你在哪裡、向哪個方向、應於什麼人,卦象告訴你事情的本質與走勢。例如方位卜得巽(東南、商業、長女),卦象卜得水山蹇(阻難之卦),合參即「商業合作對象柔和,但事情本身有險阻,宜暫緩」。比單卦更立體,適合人事與環境交織的複雜問題。",
    bodyEn:
      "A two-stage method combining the Later-Heaven (King Wen) directions with the 64 hexagrams. Step 1: spin a compass to obtain one of the eight directions, locating where the matter lies and who is involved. Step 2: toss three coins six times to derive a full hexagram, revealing how the matter unfolds. Read both together: the direction tells you 'where and who'; the hexagram tells you 'how and where to'. For example, drawing Xun (southeast, commerce, eldest daughter) for the direction and Jian (Obstruction) for the hexagram suggests: a soft commercial partner, but the matter itself has serious blocks — slow down. Richer than a single-hexagram reading, suited to questions where people and environment interweave.",
    bodyJa:
      "後天八卦(文王八卦)の方位と六十四卦を組み合わせた二段階の占い。第一段は羅盤式の回転で八卦の一つを得て「事の在処 / 誰に応じるか」を定め、第二段は三銭法で六回投げ六十四卦を得て「事の行方」を読む。最後に両者を合わせて読む — 方位は「どこで、誰に」を、卦象は「本質と推移」を示す。例えば方位で巽(東南・商取引・長女)、卦象で水山蹇(阻難の卦)が出た場合、「柔和な商取引相手だが事自体は険阻あり、暫時控えるべし」と解する。単卦より立体的で、人事と環境が絡む複雑な問いに向く。",
    bodyKo:
      "후천팔괘(문왕팔괘) 방위와 64괘를 결합한 두 단계 점법입니다. 1단계는 나침반식으로 돌려 팔괘 중 하나를 얻어 '일의 자리 / 누구에게 해당하는가'를 정합니다. 2단계는 삼전법으로 여섯 번 던져 64괘를 얻어 '일의 흐름'을 읽습니다. 마지막으로 양자를 합쳐 봅니다 — 방위는 '어디서, 누구'를 알려주고 괘상은 '본질과 추이'를 알려줍니다. 예를 들어 방위로 손(남동·상업·장녀), 괘상으로 수산건(阻難의 괘)이 나오면 '부드러운 거래 상대지만 일 자체에 험조가 있으니 잠시 보류'로 해석합니다. 단괘보다 입체적이고, 사람과 환경이 얽힌 복잡한 질문에 적합합니다.",
    detailHref: "/iching/methods/direction-hexagram",
  },
];

const TIER_LABELS = {
  simple: { zh: "易上手", en: "Easy", ja: "簡単", ko: "쉬움" },
  classical: { zh: "古法", en: "Classical", ja: "古典", ko: "고전" },
  instant: { zh: "即時", en: "Instant", ja: "即時", ko: "즉시" },
  advanced: { zh: "進階", en: "Advanced", ja: "上級", ko: "심화" },
};

const TIER_COLORS = {
  simple: "rgba(74,222,128,0.15)",
  classical: "rgba(212,168,85,0.18)",
  instant: "rgba(139,92,246,0.18)",
  advanced: "rgba(99,179,237,0.18)",
};

const TIER_TEXT_COLORS = {
  simple: "#86efac",
  classical: "#fde68a",
  instant: "#c4b5fd",
  advanced: "#93c5fd",
};

export default function MethodsView() {
  const { t, locale } = useLanguage();

  const pickName = (m: Method) => {
    if (locale === "ja") return m.nameJa ?? m.nameEn;
    if (locale === "ko") return m.nameKo ?? m.nameEn;
    if (locale === "en") return m.nameEn;
    return m.nameZh;
  };
  const pickTagline = (m: Method) => {
    if (locale === "ja") return m.taglineJa ?? m.taglineEn;
    if (locale === "ko") return m.taglineKo ?? m.taglineEn;
    if (locale === "en") return m.taglineEn;
    return m.taglineZh;
  };
  const pickBody = (m: Method) => {
    if (locale === "ja") return m.bodyJa ?? m.bodyEn;
    if (locale === "ko") return m.bodyKo ?? m.bodyEn;
    if (locale === "en") return m.bodyEn;
    return m.bodyZh;
  };
  const pickTierLabel = (tier: Method["tier"]) => {
    const l = TIER_LABELS[tier];
    if (locale === "ja") return l.ja;
    if (locale === "ko") return l.ko;
    if (locale === "en") return l.en;
    return l.zh;
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <h1
          className="text-gold-gradient"
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
        >
          {t(
            "卜卦方式介紹",
            "I Ching Divination Methods",
            "卜卦の方法",
            "주역 점치는 법"
          )}
        </h1>
        <p style={{ color: "#c0c0d0", fontSize: 14, marginTop: 8 }}>
          {t(
            "從三錢全卦到方位卦象合參,四種主流方法整理",
            "From three-coin full hexagram to direction × hexagram combined — four mainstream methods",
            "三銭全卦から方位×卦象合参まで、4つの主要な方法",
            "삼전 전괘부터 방위·괘상 합참까지, 네 가지 주류 방법"
          )}
        </p>
        <p
          style={{
            color: "rgba(192,192,208,0.7)",
            fontSize: 13,
            marginTop: 12,
            lineHeight: 1.7,
            maxWidth: 560,
            margin: "12px auto 0",
          }}
        >
          {t(
            "易經卜卦的核心是「讓隨機事件對映出當下心境」 — 不論用銅錢、時間、直接抽卦,還是合參方位,目的都是讓你停下來、把問題想清楚。下面四種方法各有適合的情境,選一個你願意實踐的就好。",
            "The core of I Ching divination is letting a random event mirror your current state of mind. Whether you use coins, time, direct draw, or combine direction with hexagram — the goal is to slow down and articulate the question. Each method below fits a different situation; pick one you'll actually use.",
            "易経の核心は「ランダムな事象を今の心境に映す」こと。銅銭・時間・即引き・方位合参のいずれを使っても、目的は立ち止まって問いを明確にすること。それぞれの方法に合った場面があります。実践したくなる一つを選んでください。",
            "주역 점의 핵심은 '무작위 사건을 지금의 심경에 비추는 것'입니다. 동전·시간·즉석 뽑기·방위 합참 어느 것을 사용하든, 목적은 멈춰서 질문을 명확히 하는 것입니다. 아래 네 가지 방법은 각기 다른 상황에 맞습니다. 실천할 만한 하나를 고르세요."
          )}
        </p>
      </header>

      {/* Methods grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 32 }}>
        {METHODS.map((m) => (
          <article
            key={m.id}
            style={{
              background: "rgba(13,13,43,0.55)",
              border: "1px solid rgba(212,168,85,0.22)",
              borderRadius: 14,
              padding: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(212,168,85,0.15)",
                  color: "#d4a855",
                  fontSize: 16,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Noto Serif TC', serif",
                  flexShrink: 0,
                }}
              >
                {m.numberZh}
              </span>
              <h2
                style={{
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 22,
                  color: "#d4a855",
                  margin: 0,
                  flex: "1 1 auto",
                  minWidth: 0,
                }}
              >
                {pickName(m)}
              </h2>
              <span
                style={{
                  background: TIER_COLORS[m.tier],
                  color: TIER_TEXT_COLORS[m.tier],
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 100,
                  whiteSpace: "nowrap",
                }}
              >
                {pickTierLabel(m.tier)}
              </span>
            </div>
            <p
              style={{
                color: "#e8e8f0",
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.7,
                marginBottom: 8,
              }}
            >
              {pickTagline(m)}
            </p>
            <p
              style={{
                color: "rgba(192,192,208,0.85)",
                fontSize: 14,
                lineHeight: 1.85,
                margin: 0,
              }}
            >
              {pickBody(m)}
            </p>
            {m.detailHref && (
              <div style={{ marginTop: 14 }}>
                <Link
                  href={m.detailHref}
                  style={{
                    display: "inline-block",
                    color: "#d4a855",
                    fontSize: 13,
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  {t(
                    "看詳細介紹 →",
                    "Read full details →",
                    "詳細紹介を見る →",
                    "자세히 보기 →"
                  )}
                </Link>
              </div>
            )}
          </article>
        ))}
      </div>

      {/* CTA */}
      <section
        style={{
          background: "linear-gradient(135deg, rgba(212,168,85,0.12), rgba(139,92,246,0.08))",
          border: "1px solid rgba(212,168,85,0.4)",
          borderRadius: 14,
          padding: 24,
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        <h3
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 20,
            color: "#d4a855",
            marginBottom: 10,
          }}
        >
          {t(
            "想實際試試?",
            "Want to try it?",
            "実際に試してみる?",
            "직접 해 볼까요?"
          )}
        </h3>
        <p style={{ color: "#c0c0d0", fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
          {t(
            "本 app 主流程預設用「三錢法」(自動或手動)。想要更輕量,可以用「Yes/No 一卦速答」或「每日一卦」。",
            "This app's main flow uses the Three-Coin Method by default (auto or manual). For something lighter, try Yes/No Quick Answer or Daily Hexagram.",
            "本アプリのメインフローは「三銭法」(自動 / 手動)を採用。より気軽に試したいなら「Yes/No 一卦速答」や「毎日の卦」を。",
            "본 앱의 메인 플로우는 기본으로 '삼전법'(자동 또는 수동)을 사용합니다. 가볍게 시도하려면 'Yes/No 한 괘 속답'이나 '오늘의 괘'를 사용하세요."
          )}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/"
            style={{
              padding: "10px 24px",
              background: "linear-gradient(135deg, #d4a855, #f0d78c)",
              color: "#0a0a1a",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ✦ {t("開始易經占卜", "Start I Ching Reading", "易経占いを始める", "주역 점 시작")}
          </Link>
          <Link
            href="/iching/yes-no"
            style={{
              padding: "10px 24px",
              background: "transparent",
              color: "#d4a855",
              border: "1px solid #d4a855",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            {t("Yes/No 速答", "Yes/No Quick", "Yes/No 速答", "Yes/No 속답")}
          </Link>
          <Link
            href="/iching/daily"
            style={{
              padding: "10px 24px",
              background: "transparent",
              color: "#d4a855",
              border: "1px solid #d4a855",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            {t("每日一卦", "Daily Hexagram", "毎日の卦", "오늘의 괘")}
          </Link>
        </div>
      </section>

      {/* Link to encyclopedia */}
      <section
        style={{
          textAlign: "center",
          padding: "20px 16px",
          background: "rgba(13,13,43,0.4)",
          borderRadius: 12,
          border: "1px solid rgba(212,168,85,0.18)",
        }}
      >
        <p style={{ color: "rgba(192,192,208,0.75)", fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>
          {t(
            "想看 64 卦每一卦的卦辭與白話翻譯?",
            "Want to read each of the 64 hexagrams with their classical and modern translations?",
            "64卦それぞれの卦辞と現代訳を読みたい?",
            "64괘 각각의 괘사와 현대 번역을 읽고 싶나요?"
          )}
        </p>
        <Link
          href="/iching/hexagrams"
          style={{
            color: "#d4a855",
            fontSize: 14,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {t(
            "64 卦完整介紹 →",
            "Visit the 64 Hexagrams Encyclopedia →",
            "64卦 完全解説 →",
            "64괘 백과 보기 →"
          )}
        </Link>
      </section>
    </div>
  );
}
