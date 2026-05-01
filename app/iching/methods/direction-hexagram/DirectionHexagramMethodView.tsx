"use client";

/**
 * 方位卦象合參占卜 — 詳細介紹頁的 client view。
 *
 * 內容五大段:
 *   1. 占卜流程(4 步驟)
 *   2. 八方位的象徵意義(後天八卦,8 卦資料來自 trigramNames)
 *   3. 六十四卦的解讀原則(4 層次 + 吉凶分類)
 *   4. 合參示例(3 例)
 *   5. 占卜的心法提醒
 *
 * 切語系時 useLanguage() 會直接 re-render,免 round-trip。
 */

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { trigramNames } from "@/data/hexagrams";

interface MultilingualText {
  zh: string;
  en: string;
  ja: string;
  ko: string;
}

const STEPS: { title: MultilingualText; body: MultilingualText }[] = [
  {
    title: {
      zh: "第一步 · 靜心設問",
      en: "Step 1 · Settle and Frame the Question",
      ja: "第一段 · 静心して問いを定める",
      ko: "1단계 · 마음을 가다듬고 질문을 다듬기",
    },
    body: {
      zh: "焚香或靜坐片刻,將所問之事在心中明確化。問題宜具體 — 例如「此次合作能否順利」勝過「我最近運勢如何」。問得越清楚,卦象回的訊息也越清楚。",
      en: "Burn incense or sit quietly for a moment; bring the matter into focus in your mind. Make the question concrete — \"Will this collaboration go smoothly?\" beats \"How is my luck lately?\" The clearer the asking, the clearer the hexagram's reply.",
      ja: "香を焚くか、しばし静坐して、問いたい事を心の中で明確にする。質問は具体的に — 「今回の協業は順調に進むか」のほうが「最近の運勢はどうか」より良い。問いが明瞭であるほど、卦の応答も明瞭になる。",
      ko: "향을 사르거나 잠시 정좌하여, 묻고자 하는 일을 마음속에 분명히 하세요. 질문은 구체적이어야 합니다 — '이번 협업이 순조로울 것인가'가 '요즘 내 운세가 어떨까'보다 낫습니다. 질문이 분명할수록 괘의 답도 분명합니다.",
    },
  },
  {
    title: {
      zh: "第二步 · 先卜方位",
      en: "Step 2 · Divine the Direction First",
      ja: "第二段 · まず方位を占う",
      ko: "2단계 · 먼저 방위를 점치다",
    },
    body: {
      zh: "用羅盤式轉動的方式卜得後天八卦其中之一,定位「事情應在哪個方向、應於什麼樣的人」。八方位各對應一卦:乾=西北、坎=正北、艮=東北、震=正東、巽=東南、離=正南、坤=西南、兌=正西。",
      en: "Spin a compass to obtain one of the eight directions of the Later-Heaven (King Wen) sequence. This locates where the matter lies and what kind of person it concerns. The eight directions: Qian = NW, Kan = N, Gen = NE, Zhen = E, Xun = SE, Li = S, Kun = SW, Dui = W.",
      ja: "羅盤式に回転させて後天八卦(文王八卦)の一つを得て、「事がどの方向にあるか、どういう人に関わるか」を定める。八方位:乾=北西、坎=北、艮=北東、震=東、巽=南東、離=南、坤=南西、兌=西。",
      ko: "나침반식으로 돌려 후천팔괘(문왕팔괘) 중 하나를 얻어, '일이 어느 방향에 있는지, 어떤 사람과 관련 있는지'를 정합니다. 팔방위: 건=북서, 감=북, 간=북동, 진=동, 손=남동, 리=남, 곤=남서, 태=서.",
    },
  },
  {
    title: {
      zh: "第三步 · 再卜六十四卦",
      en: "Step 3 · Then Cast the Full Hexagram",
      ja: "第三段 · 続いて六十四卦を立てる",
      ko: "3단계 · 이어서 64괘를 세우다",
    },
    body: {
      zh: "重新靜心,用三枚銅錢擲六次,自下而上得六爻組成一個完整的六十四卦。此卦代表事情的本質、發展與結果。若有變爻(老陰、老陽),則由本卦變化出之卦,看事情的走向。",
      en: "Settle again. Toss three coins six times — bottom toss is line 1, top toss is line 6 — to compose a full hexagram. This hexagram reveals the essence, unfolding, and outcome of the matter. If old yin or old yang appear (changing lines), the primary hexagram transforms into a relating hexagram, showing the direction of change.",
      ja: "再び心を静め、三枚の銅貨を六回投げ、下から順に六爻を作って一つの六十四卦を構成する。この卦が事の本質・展開・結果を表す。老陰・老陽(変爻)があれば、本卦が之卦に変化して、事の行方を示す。",
      ko: "다시 마음을 가라앉히고, 동전 세 개를 여섯 번 던져 아래에서 위로 여섯 효를 만들어 하나의 64괘를 이룹니다. 이 괘가 일의 본질·전개·결과를 나타냅니다. 노음·노양(변효)이 있으면 본괘가 지괘로 변하여 일의 흐름을 보여줍니다.",
    },
  },
  {
    title: {
      zh: "第四步 · 合參方位與卦象",
      en: "Step 4 · Read the Direction and Hexagram Together",
      ja: "第四段 · 方位と卦象を合わせ参ずる",
      ko: "4단계 · 방위와 괘상을 합쳐 보다",
    },
    body: {
      zh: "將方位的象義與卦象的吉凶結合解讀。方位告訴你「在哪裡、向哪個方向、應於誰」,卦象告訴你「事情如何演變」。兩者合參,得出比單卦更立體的判斷。",
      en: "Read the symbolism of the direction together with the auspice and movement of the hexagram. The direction tells you 'where, in which direction, and who is concerned'; the hexagram tells you 'how the matter unfolds'. Read both together for a richer reading than a single hexagram alone.",
      ja: "方位の象意と卦象の吉凶を組み合わせて読む。方位は「どこで、どの方向に、誰に応じるか」を、卦象は「事がどう展開するか」を語る。両者を合わせ参ずれば、単卦より立体的な判断が得られる。",
      ko: "방위의 상의와 괘상의 길흉을 결합하여 읽습니다. 방위는 '어디서, 어느 방향으로, 누구에게'를 알려주고, 괘상은 '일이 어떻게 전개되는지'를 알려줍니다. 양자를 합쳐 보면 단괘보다 입체적인 판단이 나옵니다.",
    },
  },
];

const FOUR_LAYERS: { title: MultilingualText; body: MultilingualText }[] = [
  {
    title: {
      zh: "一看 · 卦名與卦義",
      en: "1. Hexagram Name and Meaning",
      ja: "一見 · 卦名と卦義",
      ko: "첫째 · 괘명과 괘의",
    },
    body: {
      zh: "每卦皆有總體基調 — 〈乾〉主剛健創始、〈坤〉主柔順承載、〈屯〉主初生艱難、〈蒙〉主啟蒙待教、〈訟〉主爭訟不和、〈泰〉主通達、〈否〉主閉塞。先掌握卦的整體氣氛。",
      en: "Each hexagram has an overall tone — Qian = creative vigor, Kun = receptive yielding, Zhun = difficulty at beginning, Meng = youthful folly awaiting guidance, Song = conflict and discord, Tai = peace, Pi = stagnation. Grasp the overall atmosphere first.",
      ja: "各卦には総合的な基調がある — 乾=剛健の創始、坤=柔順の承載、屯=初生の艱難、蒙=啓蒙を待つ、訟=争訟不和、泰=通達、否=閉塞。まず卦全体の気を捉える。",
      ko: "각 괘에는 전반적 기조가 있습니다 — 건=강건한 창시, 곤=유순한 받아들임, 둔=시작의 험난, 몽=계몽을 기다림, 송=쟁송과 불화, 태=통달, 비=막힘. 먼저 괘의 전체 기운을 파악하세요.",
    },
  },
  {
    title: {
      zh: "二看 · 上下卦關係",
      en: "2. Upper / Lower Trigram Relationship",
      ja: "二見 · 上下卦の関係",
      ko: "둘째 · 상괘·하괘의 관계",
    },
    body: {
      zh: "上下卦相生則順、相剋則逆。例如下離(火)上坎(水)為〈既濟〉,水火相濟而成;下坎上離為〈未濟〉,水火不交而事未成。",
      en: "When the trigrams generate each other (五行相生), the matter flows; when they restrain each other (相剋), it pushes back. For example, lower Li (fire) + upper Kan (water) = Ji-Ji (After Completion), water and fire balance each other; lower Kan + upper Li = Wei-Ji (Before Completion), water and fire fail to meet, the matter remains unfinished.",
      ja: "上下卦が相生なら順、相剋なら逆。例えば下離(火)上坎(水)が〈既済〉— 水火相済して成る;下坎上離が〈未済〉— 水火交わらず事未だ成らず。",
      ko: "상하괘가 상생하면 순조롭고 상극하면 거스릅니다. 예: 하리(불)+상감(물) = 기제(이미 이룸), 수화가 서로 받쳐 이뤄짐; 하감+상리 = 미제(아직 이루지 못함), 수화가 만나지 못해 일이 미완성.",
    },
  },
  {
    title: {
      zh: "三看 · 卦辭",
      en: "3. The Judgment (卦辭)",
      ja: "三見 · 卦辞",
      ko: "셋째 · 괘사",
    },
    body: {
      zh: "卦辭是該卦的總斷語,言簡意賅。如〈乾〉曰「元亨利貞」主大吉通達,〈坤〉曰「元亨,利牝馬之貞」主柔順之吉,〈否〉曰「不利君子貞」主不宜固守。",
      en: "The judgment (guaci) is the hexagram's overall verdict, concise and dense. Qian: 'Sublime success, furthering through perseverance' — great auspicious flow. Kun: 'Sublime success, furthering through the perseverance of a mare' — yielding good fortune. Pi: 'Not favorable for the gentleman's perseverance' — do not stand fast.",
      ja: "卦辞は卦の総断語で、簡にして要を得る。〈乾〉曰く「元亨利貞」— 大吉通達を主る;〈坤〉曰く「元亨、利牝馬之貞」— 柔順の吉を主る;〈否〉曰く「不利君子貞」— 固執すべからず。",
      ko: "괘사는 그 괘의 총평으로 간결하고 핵심적입니다. 〈건〉 '원형이정' — 대길통달; 〈곤〉 '원형, 이빈마지정' — 유순의 길; 〈비〉 '불리군자정' — 고집을 마라.",
    },
  },
  {
    title: {
      zh: "四看 · 動爻",
      en: "4. The Changing Lines (動爻)",
      ja: "四見 · 動爻",
      ko: "넷째 · 동효",
    },
    body: {
      zh: "若卜卦時有變爻,則動爻的爻辭是當下最關鍵的提示,並需參考「之卦」(變化後的卦)以見事情走向。",
      en: "If changing lines appear, their line statements are the most pointed message for the present moment. Also consult the 'relating hexagram' (the hexagram that emerges when the changing lines flip) to see where the matter is heading.",
      ja: "変爻があれば、動爻の爻辞こそが現時点で最も重要な示唆。さらに之卦(変化後の卦)を参照し、事の行方を見るべし。",
      ko: "변효가 있으면 그 효사야말로 지금 이 순간 가장 중요한 메시지입니다. 또한 지괘(변화한 후의 괘)를 참고하여 일의 흐름을 봅니다.",
    },
  },
];

interface CombinedExample {
  question: MultilingualText;
  direction: MultilingualText;
  hexagram: MultilingualText;
  reading: MultilingualText;
}

const EXAMPLES: CombinedExample[] = [
  {
    question: {
      zh: "問「此次商業合作是否可成」",
      en: "Q: \"Will this business collaboration succeed?\"",
      ja: "問「今回の商業協業は成立するか」",
      ko: "물음: '이번 사업 협력이 성사될 것인가'",
    },
    direction: {
      zh: "卜得「巽」（東南方）→ 事應在商業文書、合約傳遞之事，與性質柔順之合作對象有關。",
      en: "Direction: Xun (SE) → matter concerns commerce, documents, contracts; the partner is mild and yielding in nature.",
      ja: "方位:巽(南東)→ 事は商取引・文書・契約に係り、相手は柔順な性質。",
      ko: "방위: 손(남동) → 일이 상거래·문서·계약에 관련되며, 상대는 유순한 성품.",
    },
    hexagram: {
      zh: "卦象卜得「水山蹇」→ 蹇為阻難之卦，前有險（坎）後有止（艮），主事情有重大阻礙。",
      en: "Hexagram: Shui Shan Jian (Obstruction) → a hexagram of blockage; danger ahead (Kan) and stopping behind (Gen). The matter faces a major obstacle.",
      ja: "卦象:水山蹇 → 蹇は阻難の卦、前に険(坎)あり後に止(艮)あり、事に重大な阻害あり。",
      ko: "괘상: 수산건 → 건은 험난의 괘, 앞에 험(감), 뒤에 멈춤(간) — 일에 중대한 장애.",
    },
    reading: {
      zh: "合參:合作對象本身性質柔和（巽），但事情的本質有險阻（蹇），宜暫緩或重新審視合約條件，不宜強行推進。",
      en: "Combined reading: the partner is gentle (Xun), but the matter itself has serious blocks (Jian) — slow down or revisit the terms; do not push forward by force.",
      ja: "合参:相手は柔和(巽)だが、事自体に険阻あり(蹇)— 暫時控えるか、契約条件を再検討すべし。強引に進めるべきではない。",
      ko: "합참: 상대는 부드러우나(손), 일 자체에 험조가 있음(건) — 잠시 보류하거나 계약 조건을 재검토하라. 강행해서는 안 된다.",
    },
  },
  {
    question: {
      zh: "問「家中長輩健康」",
      en: "Q: \"How is the health of an elderly family member?\"",
      ja: "問「家中の長老の健康」",
      ko: "물음: '집안 어른의 건강'",
    },
    direction: {
      zh: "卜得「乾」（西北方）→ 直接應在父親或家中男性長輩身上。",
      en: "Direction: Qian (NW) → directly points to the father or a male elder in the family.",
      ja: "方位:乾(北西)→ 父親または家中の男性長老に直接応じる。",
      ko: "방위: 건(북서) → 아버지 또는 집안의 남성 어른에게 직접 해당.",
    },
    hexagram: {
      zh: "卦象卜得「地天泰」→ 泰為通達之卦，天地交而萬物通。",
      en: "Hexagram: Di Tian Tai (Peace) → a hexagram of harmonious flow; heaven and earth meet, all things connect.",
      ja: "卦象:地天泰 → 泰は通達の卦、天地交わりて万物通ず。",
      ko: "괘상: 지천태 → 태는 통달의 괘, 천지가 사귀어 만물이 통함.",
    },
    reading: {
      zh: "合參:方位明確指向長輩本人，卦象主通泰，主健康無虞或近期將有好轉。",
      en: "Combined reading: the direction points squarely at the elder; the hexagram signals harmonious flow — health is fine, or improvement is near.",
      ja: "合参:方位は長老本人を明確に指し、卦象は通泰を主る — 健康に憂いなし、または近く好転する。",
      ko: "합참: 방위는 어른 본인을 분명히 가리키고, 괘상은 통태를 주관함 — 건강에 우려 없거나 곧 호전될 것.",
    },
  },
  {
    question: {
      zh: "問「失物可否尋回」",
      en: "Q: \"Can a lost item be recovered?\"",
      ja: "問「失せ物は取り戻せるか」",
      ko: "물음: '잃어버린 물건을 되찾을 수 있는가'",
    },
    direction: {
      zh: "卜得「坎」（正北方）→ 物在北方，且位置隱蔽、近水或暗處。",
      en: "Direction: Kan (N) → the item is to the north, in a hidden spot, near water or in a dark place.",
      ja: "方位:坎(北)→ 物は北方にあり、隠れた場所、水の近く、または暗い所。",
      ko: "방위: 감(북) → 물건은 북방에 있고, 숨은 곳·물 근처·어두운 곳.",
    },
    hexagram: {
      zh: "卦象卜得「山水蒙」→ 蒙主蒙昧未明，但下卦坎水呼應方位。",
      en: "Hexagram: Shan Shui Meng (Youthful Folly) → meaning is obscure for now; the lower trigram Kan (water) echoes the direction.",
      ja: "卦象:山水蒙 → 蒙は蒙昧未明を主るが、下卦の坎水が方位と呼応。",
      ko: "괘상: 산수몽 → 몽은 몽매미명을 주관하나, 하괘 감수가 방위와 호응.",
    },
    reading: {
      zh: "合參:物品在北方隱蔽處（如水管附近、暗櫃、北邊房間），目前一時難尋（蒙），需耐心搜尋方可得。",
      en: "Combined reading: the item is in a hidden spot to the north (near plumbing, in a dark cabinet, in the north room). Hard to locate right now (Meng) — patient searching will recover it.",
      ja: "合参:物は北方の隠れた場所(水回りの近く、暗い棚、北側の部屋)にある。今すぐは見つけにくい(蒙)— 根気強く探せば取り戻せる。",
      ko: "합참: 물건은 북쪽의 숨은 곳(수도관 근처·어두운 수납·북쪽 방)에 있음. 지금은 찾기 어려움(몽) — 인내심으로 찾으면 되찾을 수 있다.",
    },
  },
];

const MIND_NOTES: MultilingualText[] = [
  {
    zh: "占卜貴在誠與靜，心浮氣躁則卦不準。",
    en: "Divination requires sincerity and stillness — a restless mind muddles the answer.",
    ja: "占卜は誠と静を貴ぶ。心浮き気が騒げば卦は当たらない。",
    ko: "점은 성실함과 고요함을 귀히 여깁니다 — 마음이 들떠 있으면 괘가 어긋납니다.",
  },
  {
    zh: "同一事不宜反覆占問 — 「初筮告，再三瀆，瀆則不告」（〈蒙〉卦卦辭）。",
    en: "Do not divine the same matter repeatedly — 'The first cast tells; further casts profane it, and the profaned does not speak' (Meng's judgment).",
    ja: "同一事を繰り返し占うべからず — 「初筮告ぐ、再三瀆す、瀆さば告げず」(〈蒙〉卦卦辞)。",
    ko: "같은 일을 반복해 점치지 마세요 — '처음 점은 알리지만, 거듭하면 모독이 되어 알리지 않는다'(〈몽〉괘의 괘사).",
  },
  {
    zh: "卦象所示為「當下機緣」，非絕對命定。吉卦仍需努力，凶卦可以警惕避禍。",
    en: "What the hexagram shows is the present opportunity, not absolute fate. An auspicious cast still demands effort; an inauspicious one warns you to avoid danger.",
    ja: "卦が示すは「当下の機縁」であり絶対の宿命にあらず。吉卦も努力を要し、凶卦は警めを与えて禍を避ける。",
    ko: "괘가 보이는 것은 '지금의 기연'이지 절대적 운명이 아닙니다. 길괘도 노력이 필요하고, 흉괘는 경계하여 화를 피하라는 뜻입니다.",
  },
  {
    zh: "《易》之為書，「明於憂患與故」，本意在於趨吉避凶、修身進德，而非預知禍福以求僥倖。",
    en: "The I Ching, in its words, 'illuminates worries and their causes' — its purpose is to seek good and avoid harm, to refine character, not to foresee fortune for wishful gain.",
    ja: "《易》という書は「憂患と故に明るし」— 趨吉避凶、修身進徳が本意であり、禍福を予知して僥倖を求めるためではない。",
    ko: "《역》은 '근심과 그 까닭에 밝다' — 본뜻은 길을 좇고 흉을 피하며 몸과 덕을 닦는 데 있지, 화복을 미리 알아 요행을 바라는 데 있지 않습니다.",
  },
];

export default function DirectionHexagramMethodView() {
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
            "進階 · 方位 × 卦象",
            "ADVANCED · DIRECTION × HEXAGRAM",
            "上級 · 方位 × 卦象",
            "심화 · 방위 × 괘상"
          )}
        </p>
        <h1
          className="text-gold-gradient"
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
        >
          {t(
            "方位卦象合參占卜",
            "Direction × Hexagram Combined Divination",
            "方位卦象 合参占卜",
            "방위·괘상 합참 점법"
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
            "結合先天八卦方位與六十四卦卦義 — 先以方位定「事之所在」，再以卦象明「事之吉凶變化」。",
            "Combines the Later-Heaven directions with the 64 hexagrams — first locate where the matter lies, then read how it unfolds.",
            "後天八卦の方位と六十四卦の卦義を組み合わせる — 先に方位で「事の在処」を定め、後に卦象で「事の吉凶と変化」を明らかにする。",
            "후천팔괘 방위와 64괘 괘의를 결합 — 먼저 방위로 '일의 자리'를 정하고, 이후 괘상으로 '일의 길흉과 변화'를 밝힙니다."
          )}
        </p>
      </header>

      {/* 占卜流程 */}
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
          {t("占卜流程", "The Divination Process", "占卜の流れ", "점법의 절차")}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {STEPS.map((s, i) => (
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
              <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.85, margin: 0 }}>
                {t(s.body.zh, s.body.en, s.body.ja, s.body.ko)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* 八方位的象徵意義 — 用 trigramNames 已有資料 */}
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
            "第一部分 · 八方位的象徵意義",
            "Part 1 · Symbolism of the Eight Directions",
            "第一部 · 八方位の象徴意義",
            "1부 · 팔방위의 상징"
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
            "採用後天八卦方位（文王八卦），這是占卜實務上最常用的方位系統。",
            "Uses the Later-Heaven (King Wen) directions — the system most commonly used in divinatory practice.",
            "後天八卦(文王八卦)の方位を採用 — 占卜実務で最も用いられる方位系。",
            "후천팔괘(문왕팔괘) 방위 사용 — 점복 실무에서 가장 흔히 쓰는 방위 체계."
          )}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {Object.entries(trigramNames).map(([code, tg]) => {
            const tgName = t(tg.zh, tg.en, tg.ja, tg.ko);
            const direction = t(
              tg.directionZh,
              tg.directionEn,
              tg.directionJa,
              tg.directionKo
            );
            const people = t(tg.peopleZh, tg.peopleEn, tg.peopleJa, tg.peopleKo);
            const matters = t(tg.mattersZh, tg.mattersEn, tg.mattersJa, tg.mattersKo);
            const advice = t(tg.adviceZh, tg.adviceEn, tg.adviceJa, tg.adviceKo);
            return (
              <article
                key={code}
                style={{
                  background: "rgba(13,13,43,0.5)",
                  border: "1px solid rgba(212,168,85,0.18)",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 22, color: "#d4a855", lineHeight: 1 }}>
                    {tg.symbol}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Noto Serif TC', serif",
                      fontWeight: 700,
                      fontSize: 16,
                      color: "#fde68a",
                    }}
                  >
                    {tgName}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(212,168,85,0.85)",
                      background: "rgba(212,168,85,0.12)",
                      padding: "1px 8px",
                      borderRadius: 100,
                    }}
                  >
                    {direction}
                  </span>
                </div>
                <p
                  style={{
                    color: "#c0c0d0",
                    fontSize: 12.5,
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  <strong style={{ color: "rgba(212,168,85,0.9)" }}>
                    {t("人事", "People", "人事", "인사")}
                  </strong>
                  ：{people}
                  <br />
                  <strong style={{ color: "rgba(212,168,85,0.9)" }}>
                    {t("事理", "Matters", "事理", "사리")}
                  </strong>
                  ：{matters}
                  <br />
                  <strong style={{ color: "rgba(212,168,85,0.9)" }}>
                    {t("提示", "Advice", "助言", "조언")}
                  </strong>
                  ：<span style={{ color: "#e8e8f0" }}>{advice}</span>
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* 六十四卦的解讀原則 */}
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
            "第二部分 · 六十四卦的解讀原則",
            "Part 2 · Reading the 64 Hexagrams",
            "第二部 · 六十四卦の解読原則",
            "2부 · 64괘 해독 원칙"
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
            "六十四卦由八卦兩兩相疊而成。上卦為外、為遠、為將來、為他人；下卦為內、為近、為現在、為自己。",
            "The 64 hexagrams arise from pairing the 8 trigrams. The upper trigram is outer / far / future / others; the lower is inner / near / present / self.",
            "六十四卦は八卦を二つずつ重ねて成る。上卦は外・遠・将来・他人、下卦は内・近・現在・自分。",
            "64괘는 8괘를 두 개씩 겹쳐 만들어집니다. 상괘는 외·원·미래·타인, 하괘는 내·근·현재·자기."
          )}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
          {FOUR_LAYERS.map((layer, i) => (
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
                {t(layer.title.zh, layer.title.en, layer.title.ja, layer.title.ko)}
              </h3>
              <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.85, margin: 0 }}>
                {t(layer.body.zh, layer.body.en, layer.body.ja, layer.body.ko)}
              </p>
            </article>
          ))}
        </div>

        {/* 吉凶大略分類 */}
        <article
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
              margin: "0 0 10px",
            }}
          >
            {t(
              "吉凶大略分類",
              "General Auspice Classification",
              "吉凶の概略分類",
              "길흉의 대략적 분류"
            )}
          </h3>
          <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.85, margin: "0 0 10px" }}>
            <strong style={{ color: "#86efac" }}>
              {t("大吉之卦", "Auspicious", "大吉の卦", "대길의 괘")}
            </strong>
            ：{t(
              "乾、坤、泰、大有、謙、豫、隨、臨、觀、無妄、大畜、頤、咸、恆、晉、家人、損、益、夬、姤、萃、升、井、革、鼎、漸、豐、巽、兌、渙、節、中孚、既濟。",
              "Qian, Kun, Tai, Da You, Qian (humility), Yu, Sui, Lin, Guan, Wu Wang, Da Xu, Yi, Xian, Heng, Jin, Jia Ren, Sun, Yi (increase), Guai, Gou, Cui, Sheng, Jing, Ge, Ding, Jian, Feng, Xun, Dui, Huan, Jie, Zhong Fu, Ji Ji.",
              "乾・坤・泰・大有・謙・豫・随・臨・観・无妄・大畜・頤・咸・恒・晋・家人・損・益・夬・姤・萃・升・井・革・鼎・漸・豊・巽・兌・渙・節・中孚・既済。",
              "건·곤·태·대유·겸·예·수·임·관·무망·대축·이·함·항·진·가인·손·익·쾌·구·췌·승·정·혁·정(鼎)·점·풍·손(巽)·태(兌)·환·절·중부·기제."
            )}
          </p>
          <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.85, margin: "0 0 10px" }}>
            <strong style={{ color: "#fca5a5" }}>
              {t(
                "艱難或凶險之卦",
                "Challenging or Inauspicious",
                "艱難または凶険の卦",
                "험난 또는 흉험의 괘"
              )}
            </strong>
            ：{t(
              "屯、蒙、需、訟、師、比（視情況）、否、剝、復（先剝後復）、坎、離（虛明）、遯、大壯（過剛）、明夷、睽、蹇、解、困、震、艮、歸妹、旅、小過、未濟。",
              "Zhun, Meng, Xu, Song, Shi, Bi (depends), Pi, Bo, Fu (after stripping), Kan, Li (illusory brightness), Dun, Da Zhuang (over-strength), Ming Yi, Kui, Jian, Jie, Kun (困), Zhen, Gen, Gui Mei, Lü, Xiao Guo, Wei Ji.",
              "屯・蒙・需・訟・師・比(状況による)・否・剥・復(剥の後の復)・坎・離(虚明)・遯・大壮(過剛)・明夷・睽・蹇・解・困・震・艮・帰妹・旅・小過・未済。",
              "둔·몽·수·송·사·비(상황에 따라)·비(否)·박·복(박 후의 복)·감·리(허명)·둔(遯)·대장(과강)·명이·규·건(蹇)·해·곤·진·간·귀매·여·소과·미제."
            )}
          </p>
          <p style={{ color: "rgba(192,192,208,0.85)", fontSize: 13, lineHeight: 1.85, margin: 0 }}>
            {t(
              "實際解卦時不可僅憑吉凶判斷，需結合所問之事與動爻綜合判讀。例如〈否〉卦對問「是否該停損」反而是好兆頭，因其示意「閉塞當止」。",
              "When actually reading, don't rely on the auspice tag alone — combine it with the question and changing lines. For example, drawing Pi (Stagnation) for 'should I cut my losses?' is actually a favorable sign, since it signals 'block the channel, stop'.",
              "実際の解読では吉凶のみで判断せず、問いと動爻を合わせて読む。例えば〈否〉卦で「損切りすべきか」を問えば、却って良き兆し — 「閉塞すれば止まれ」を示すため。",
              "실제 해독 시 길흉만으로 판단하지 말고, 묻는 일과 동효를 종합해 읽으세요. 예: '손절해야 하는가'에 대해 〈비〉(否)괘가 나오면 오히려 좋은 징조 — '막힐 때는 멈추라'는 뜻이므로."
            )}
          </p>
        </article>
      </section>

      {/* 三個合參示例 */}
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
            "第三部分 · 方位與卦象合參示例",
            "Part 3 · Combined Reading Examples",
            "第三部 · 方位と卦象の合参例",
            "3부 · 방위와 괘상 합참 예시"
          )}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {EXAMPLES.map((ex, i) => (
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
                  fontSize: 16,
                  color: "#fde68a",
                  margin: "0 0 12px",
                }}
              >
                {t(
                  `例 ${i + 1}：${ex.question.zh}`,
                  `Example ${i + 1}: ${ex.question.en}`,
                  `例 ${i + 1}：${ex.question.ja}`,
                  `예 ${i + 1}: ${ex.question.ko}`
                )}
              </h3>
              <ul
                style={{
                  margin: 0,
                  padding: "0 0 0 18px",
                  color: "#e8e8f0",
                  fontSize: 14,
                  lineHeight: 1.85,
                }}
              >
                <li>
                  <strong style={{ color: "rgba(212,168,85,0.9)" }}>
                    {t("方位", "Direction", "方位", "방위")}
                  </strong>
                  ：{t(ex.direction.zh, ex.direction.en, ex.direction.ja, ex.direction.ko)}
                </li>
                <li>
                  <strong style={{ color: "rgba(212,168,85,0.9)" }}>
                    {t("卦象", "Hexagram", "卦象", "괘상")}
                  </strong>
                  ：{t(ex.hexagram.zh, ex.hexagram.en, ex.hexagram.ja, ex.hexagram.ko)}
                </li>
                <li>
                  <strong style={{ color: "#86efac" }}>
                    {t("合參", "Combined", "合参", "합참")}
                  </strong>
                  ：{t(ex.reading.zh, ex.reading.en, ex.reading.ja, ex.reading.ko)}
                </li>
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* 心法提醒 */}
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
          {t(
            "占卜的心法提醒",
            "Mind Notes for the Diviner",
            "占卜の心法",
            "점복의 마음가짐"
          )}
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
          background: "linear-gradient(135deg, rgba(212,168,85,0.12), rgba(99,179,237,0.10))",
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
            "準備好了？開始一次方位卦象合參",
            "Ready? Begin a Direction × Hexagram reading",
            "準備はよろしいか?方位卦象の合参を始める",
            "준비 됐나요? 방위·괘상 합참을 시작합니다"
          )}
        </h3>
        {/* 直連 /iching/direction-hexagram 已不能用 — 那頁要前置 sessionStorage 的 q+cat
            才會 render。改成從統一入口 /categories?type=iching 走完整流程進來。 */}
        <Link
          href="/categories?type=iching"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            background: "linear-gradient(135deg, #d4a855, #f0d78c)",
            color: "#0a0a1a",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          ✦ {t("開始占卜", "Start a Reading", "占いを始める", "점 시작")}
        </Link>
      </section>
    </div>
  );
}
