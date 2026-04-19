// ============================================
// 塔羅牌 Rider-Waite-Smith 78 張完整資料
// ============================================
// 圖檔:luciellaes.itch.io CC0 版 → public/tarot/*.png
//   - Major: 00-TheFool.png ~ 21-TheWorld.png
//   - Minor: {Suit}{01-14}.png, suit ∈ Cups / Pentacles / Swords / Wands
//     01=Ace、02-10=數字、11=Page、12=Knight、13=Queen、14=King
//   - CardBacks.png 為牌背(面朝下時顯示)
//
// 牌義為 Rider-Waite-Smith 傳統詮釋的濃縮版本,餵給 AI 解讀用
// ============================================

export type TarotSuit = "major" | "wands" | "cups" | "swords" | "pentacles";

export interface TarotCard {
  id: string;             // 唯一 slug,e.g. "major-00-fool", "cups-07"
  suit: TarotSuit;
  number: number;         // major: 0-21, minor: 1-14(1=Ace、11=Page、12=Knight、13=Queen、14=King)
  nameZh: string;
  nameEn: string;
  imagePath: string;      // /tarot/xxx.png (public 下的路徑)
  uprightMeaningZh: string;
  uprightMeaningEn: string;
  reversedMeaningZh: string;
  reversedMeaningEn: string;
  keywordsUprightZh: string[];
  keywordsUprightEn: string[];
  keywordsReversedZh: string[];
  keywordsReversedEn: string[];
}

export const CARD_BACK_IMAGE = "/tarot/CardBacks.png";

// 花色中文對照
export const SUIT_NAMES_ZH: Record<TarotSuit, string> = {
  major: "大阿爾克那",
  wands: "權杖",
  cups: "聖杯",
  swords: "寶劍",
  pentacles: "錢幣",
};

export const SUIT_NAMES_EN: Record<TarotSuit, string> = {
  major: "Major Arcana",
  wands: "Wands",
  cups: "Cups",
  swords: "Swords",
  pentacles: "Pentacles",
};

// 宮廷牌數字 → 中/英文
const COURT_ZH = ["侍者", "騎士", "王后", "國王"];
const COURT_EN = ["Page", "Knight", "Queen", "King"];

// ============ Major Arcana (22) ============
const MAJOR: TarotCard[] = [
  {
    id: "major-00-fool",
    suit: "major",
    number: 0,
    nameZh: "愚人",
    nameEn: "The Fool",
    imagePath: "/tarot/00-TheFool.png",
    uprightMeaningZh: "象徵全新的開始、天真與冒險。懷抱信念踏出第一步,對未知保持開放。",
    uprightMeaningEn: "New beginnings, innocence, and a leap of faith. Step forward with open-hearted optimism.",
    reversedMeaningZh: "衝動、魯莽或不願承擔風險。該重新考慮計畫是否周全。",
    reversedMeaningEn: "Recklessness, hesitation, or poor judgment. Reconsider before leaping.",
    keywordsUprightZh: ["新開始", "冒險", "純真", "自由"],
    keywordsUprightEn: ["new beginnings", "adventure", "innocence", "freedom"],
    keywordsReversedZh: ["魯莽", "猶豫", "天真", "冒失"],
    keywordsReversedEn: ["recklessness", "hesitation", "naivety", "foolishness"],
  },
  {
    id: "major-01-magician",
    suit: "major",
    number: 1,
    nameZh: "魔術師",
    nameEn: "The Magician",
    imagePath: "/tarot/01-TheMagician.png",
    uprightMeaningZh: "顯化力量、意志力與行動力。你擁有實現願望所需的一切工具。",
    uprightMeaningEn: "Manifestation, willpower, and resourcefulness. You have all the tools you need.",
    reversedMeaningZh: "操弄、自欺或才能未發揮。注意動機是否純粹。",
    reversedMeaningEn: "Manipulation, deception, or untapped potential. Check your motives.",
    keywordsUprightZh: ["顯化", "意志力", "行動", "技能"],
    keywordsUprightEn: ["manifestation", "willpower", "action", "skill"],
    keywordsReversedZh: ["操縱", "欺騙", "潛能未發揮"],
    keywordsReversedEn: ["manipulation", "deception", "untapped potential"],
  },
  {
    id: "major-02-high-priestess",
    suit: "major",
    number: 2,
    nameZh: "女祭司",
    nameEn: "The High Priestess",
    imagePath: "/tarot/02-TheHighPriestess.png",
    uprightMeaningZh: "直覺、神秘與內在智慧。傾聽潛意識的聲音,答案已在心中。",
    uprightMeaningEn: "Intuition, mystery, and inner wisdom. Listen to your subconscious; the answer is within.",
    reversedMeaningZh: "忽視直覺、祕密浮上檯面或與內在失聯。",
    reversedMeaningEn: "Ignored intuition, secrets revealed, or disconnection from your inner voice.",
    keywordsUprightZh: ["直覺", "神秘", "潛意識", "智慧"],
    keywordsUprightEn: ["intuition", "mystery", "subconscious", "wisdom"],
    keywordsReversedZh: ["隱藏", "祕密", "直覺受阻"],
    keywordsReversedEn: ["hidden", "secrets", "blocked intuition"],
  },
  {
    id: "major-03-empress",
    suit: "major",
    number: 3,
    nameZh: "女皇",
    nameEn: "The Empress",
    imagePath: "/tarot/03-TheEmpress.png",
    uprightMeaningZh: "豐饒、創造力與母性能量。滋養自己與身邊的人,享受感官之美。",
    uprightMeaningEn: "Abundance, creativity, and nurturing energy. Enjoy beauty and care for those around you.",
    reversedMeaningZh: "依賴、停滯或創造力受阻。需要重新連結內在力量。",
    reversedMeaningEn: "Dependence, stagnation, or creative block. Reconnect with your inner source.",
    keywordsUprightZh: ["豐饒", "創造力", "滋養", "美"],
    keywordsUprightEn: ["abundance", "creativity", "nurture", "beauty"],
    keywordsReversedZh: ["依賴", "停滯", "創造力受阻"],
    keywordsReversedEn: ["dependence", "stagnation", "creative block"],
  },
  {
    id: "major-04-emperor",
    suit: "major",
    number: 4,
    nameZh: "皇帝",
    nameEn: "The Emperor",
    imagePath: "/tarot/04-TheEmperor.png",
    uprightMeaningZh: "權威、穩固結構與領導力。以紀律與責任打造基礎。",
    uprightMeaningEn: "Authority, structure, and leadership. Build foundations with discipline.",
    reversedMeaningZh: "專制、控制欲或僵化。過度堅持掌控反成阻礙。",
    reversedMeaningEn: "Tyranny, rigidity, or over-control. Insistence on dominance becomes the obstacle.",
    keywordsUprightZh: ["權威", "結構", "領導", "穩固"],
    keywordsUprightEn: ["authority", "structure", "leadership", "stability"],
    keywordsReversedZh: ["專制", "僵化", "控制"],
    keywordsReversedEn: ["tyranny", "rigidity", "control"],
  },
  {
    id: "major-05-hierophant",
    suit: "major",
    number: 5,
    nameZh: "教皇",
    nameEn: "The Hierophant",
    imagePath: "/tarot/05-TheHierophant.png",
    uprightMeaningZh: "傳統、信念與靈性指引。尋求導師或在既有體制中學習。",
    uprightMeaningEn: "Tradition, belief, and spiritual guidance. Seek mentors or learn within established systems.",
    reversedMeaningZh: "反叛傳統、打破規則或需挑戰既定信念。",
    reversedMeaningEn: "Rebellion against tradition, breaking rules, or challenging inherited beliefs.",
    keywordsUprightZh: ["傳統", "信念", "導師", "體制"],
    keywordsUprightEn: ["tradition", "belief", "mentor", "conformity"],
    keywordsReversedZh: ["反叛", "非主流", "挑戰規則"],
    keywordsReversedEn: ["rebellion", "unconventional", "challenging norms"],
  },
  {
    id: "major-06-lovers",
    suit: "major",
    number: 6,
    nameZh: "戀人",
    nameEn: "The Lovers",
    imagePath: "/tarot/06-TheLovers.png",
    uprightMeaningZh: "愛、和諧與重要的抉擇。依循內心價值做決定。",
    uprightMeaningEn: "Love, harmony, and a meaningful choice. Decide from your core values.",
    reversedMeaningZh: "關係失衡、錯誤選擇或價值觀衝突。",
    reversedMeaningEn: "Imbalance in relationships, misaligned choices, or clashing values.",
    keywordsUprightZh: ["愛", "和諧", "選擇", "結合"],
    keywordsUprightEn: ["love", "harmony", "choice", "union"],
    keywordsReversedZh: ["失衡", "不合", "錯誤選擇"],
    keywordsReversedEn: ["imbalance", "discord", "wrong choice"],
  },
  {
    id: "major-07-chariot",
    suit: "major",
    number: 7,
    nameZh: "戰車",
    nameEn: "The Chariot",
    imagePath: "/tarot/07-TheChariot.png",
    uprightMeaningZh: "意志力、決心與勝利。聚焦目標,衝破阻礙。",
    uprightMeaningEn: "Willpower, determination, and victory. Stay focused and push through obstacles.",
    reversedMeaningZh: "失去方向、自我懷疑或侵略性失控。",
    reversedMeaningEn: "Lack of direction, self-doubt, or unchecked aggression.",
    keywordsUprightZh: ["勝利", "決心", "控制", "意志"],
    keywordsUprightEn: ["victory", "determination", "control", "willpower"],
    keywordsReversedZh: ["失控", "方向不明", "受阻"],
    keywordsReversedEn: ["loss of control", "direction lost", "obstacles"],
  },
  {
    id: "major-08-strength",
    suit: "major",
    number: 8,
    nameZh: "力量",
    nameEn: "Strength",
    imagePath: "/tarot/08-Strength.png",
    uprightMeaningZh: "內在勇氣、耐心與柔性駕馭。以溫柔而非蠻力制伏挑戰。",
    uprightMeaningEn: "Inner courage, patience, and gentle mastery. Overcome challenges with compassion, not force.",
    reversedMeaningZh: "自我懷疑、情緒失控或用暴力解決問題。",
    reversedMeaningEn: "Self-doubt, emotional turmoil, or solving things with force.",
    keywordsUprightZh: ["勇氣", "耐心", "柔韌", "自律"],
    keywordsUprightEn: ["courage", "patience", "gentle power", "self-discipline"],
    keywordsReversedZh: ["自我懷疑", "情緒失控", "軟弱"],
    keywordsReversedEn: ["self-doubt", "emotional turmoil", "weakness"],
  },
  {
    id: "major-09-hermit",
    suit: "major",
    number: 9,
    nameZh: "隱者",
    nameEn: "The Hermit",
    imagePath: "/tarot/09-TheHermit.png",
    uprightMeaningZh: "內省、獨處與尋找真理。退一步靜心,答案在內在浮現。",
    uprightMeaningEn: "Introspection, solitude, and seeking truth. Step back and let answers emerge within.",
    reversedMeaningZh: "孤立、逃避或拒絕內在工作。需重新與他人連結。",
    reversedMeaningEn: "Isolation, avoidance, or refusal of inner work. Time to reconnect.",
    keywordsUprightZh: ["內省", "獨處", "智慧", "指引"],
    keywordsUprightEn: ["introspection", "solitude", "wisdom", "guidance"],
    keywordsReversedZh: ["孤立", "逃避", "疏離"],
    keywordsReversedEn: ["isolation", "avoidance", "withdrawal"],
  },
  {
    id: "major-10-wheel-of-fortune",
    suit: "major",
    number: 10,
    nameZh: "命運之輪",
    nameEn: "Wheel of Fortune",
    imagePath: "/tarot/10-WheelOfFortune.png",
    uprightMeaningZh: "命運輪轉、循環與轉機。接受變化,機會正在到來。",
    uprightMeaningEn: "Fate turning, cycles, and a turning point. Embrace change; opportunity is arriving.",
    reversedMeaningZh: "運勢低迷、抗拒變化或陷入不利循環。",
    reversedMeaningEn: "Bad luck, resistance to change, or stuck in a negative cycle.",
    keywordsUprightZh: ["命運", "轉機", "循環", "幸運"],
    keywordsUprightEn: ["fate", "turning point", "cycle", "luck"],
    keywordsReversedZh: ["厄運", "失控", "受困循環"],
    keywordsReversedEn: ["bad luck", "out of control", "stuck in cycle"],
  },
  {
    id: "major-11-justice",
    suit: "major",
    number: 11,
    nameZh: "正義",
    nameEn: "Justice",
    imagePath: "/tarot/11-Justice.png",
    uprightMeaningZh: "公平、真理與因果。誠實面對事實,做出合乎倫理的決定。",
    uprightMeaningEn: "Fairness, truth, and cause-and-effect. Face facts honestly and decide ethically.",
    reversedMeaningZh: "不公、推卸責任或逃避後果。",
    reversedMeaningEn: "Unfairness, dishonesty, or avoiding accountability.",
    keywordsUprightZh: ["公平", "真理", "責任", "決斷"],
    keywordsUprightEn: ["fairness", "truth", "accountability", "decision"],
    keywordsReversedZh: ["不公", "欺騙", "逃避責任"],
    keywordsReversedEn: ["unfairness", "dishonesty", "avoiding accountability"],
  },
  {
    id: "major-12-hanged-man",
    suit: "major",
    number: 12,
    nameZh: "吊人",
    nameEn: "The Hanged Man",
    imagePath: "/tarot/12-TheHangedMan.png",
    uprightMeaningZh: "暫停、換位思考與犧牲。放下執著才能看見新視角。",
    uprightMeaningEn: "Pause, new perspective, and sacrifice. Let go to see things anew.",
    reversedMeaningZh: "停滯、猶豫不決或無謂的犧牲。",
    reversedMeaningEn: "Stagnation, indecision, or pointless sacrifice.",
    keywordsUprightZh: ["暫停", "換位", "犧牲", "臣服"],
    keywordsUprightEn: ["pause", "perspective", "sacrifice", "surrender"],
    keywordsReversedZh: ["停滯", "猶豫", "頑抗"],
    keywordsReversedEn: ["stagnation", "indecision", "resistance"],
  },
  {
    id: "major-13-death",
    suit: "major",
    number: 13,
    nameZh: "死神",
    nameEn: "Death",
    imagePath: "/tarot/13-Death.png",
    uprightMeaningZh: "結束、轉化與重生。舊的階段落幕,為新生騰出空間。",
    uprightMeaningEn: "Endings, transformation, and rebirth. Close one chapter to make room for the next.",
    reversedMeaningZh: "抗拒改變、執著過去或轉化受阻。",
    reversedMeaningEn: "Resistance to change, clinging to the past, or blocked transformation.",
    keywordsUprightZh: ["結束", "轉化", "重生", "蛻變"],
    keywordsUprightEn: ["ending", "transformation", "rebirth", "metamorphosis"],
    keywordsReversedZh: ["抗拒", "執著", "無法放下"],
    keywordsReversedEn: ["resistance", "clinging", "unable to let go"],
  },
  {
    id: "major-14-temperance",
    suit: "major",
    number: 14,
    nameZh: "節制",
    nameEn: "Temperance",
    imagePath: "/tarot/14-Temperance.png",
    uprightMeaningZh: "平衡、調和與耐心。中庸之道,化對立為和諧。",
    uprightMeaningEn: "Balance, moderation, and patience. Blend opposites into harmony.",
    reversedMeaningZh: "失衡、極端或缺乏耐心。",
    reversedMeaningEn: "Imbalance, extremes, or impatience.",
    keywordsUprightZh: ["平衡", "調和", "耐心", "中庸"],
    keywordsUprightEn: ["balance", "harmony", "patience", "moderation"],
    keywordsReversedZh: ["失衡", "極端", "過度"],
    keywordsReversedEn: ["imbalance", "extremes", "excess"],
  },
  {
    id: "major-15-devil",
    suit: "major",
    number: 15,
    nameZh: "惡魔",
    nameEn: "The Devil",
    imagePath: "/tarot/15-TheDevil.png",
    uprightMeaningZh: "束縛、慾望與物質執著。意識到是自己把自己綁住。",
    uprightMeaningEn: "Bondage, desire, and attachment. Recognize that the chains are self-imposed.",
    reversedMeaningZh: "掙脫枷鎖、覺醒與釋放。勇敢面對陰影面。",
    reversedMeaningEn: "Breaking free, awakening, and release. Face your shadow.",
    keywordsUprightZh: ["束縛", "慾望", "誘惑", "執著"],
    keywordsUprightEn: ["bondage", "desire", "temptation", "attachment"],
    keywordsReversedZh: ["解脫", "覺醒", "釋放"],
    keywordsReversedEn: ["liberation", "awareness", "release"],
  },
  {
    id: "major-16-tower",
    suit: "major",
    number: 16,
    nameZh: "高塔",
    nameEn: "The Tower",
    imagePath: "/tarot/16-TheTower.png",
    uprightMeaningZh: "突發劇變、幻象瓦解與真相顯露。崩解之後才有重建。",
    uprightMeaningEn: "Sudden upheaval, shattered illusions, and revelation. Collapse clears the way for rebuilding.",
    reversedMeaningZh: "避免災難、壓抑恐懼或延遲的變動。",
    reversedMeaningEn: "Avoiding disaster, suppressed fear, or delayed upheaval.",
    keywordsUprightZh: ["劇變", "崩解", "真相", "覺醒"],
    keywordsUprightEn: ["upheaval", "collapse", "revelation", "awakening"],
    keywordsReversedZh: ["逃避", "延遲", "壓抑"],
    keywordsReversedEn: ["avoidance", "delay", "suppression"],
  },
  {
    id: "major-17-star",
    suit: "major",
    number: 17,
    nameZh: "星星",
    nameEn: "The Star",
    imagePath: "/tarot/17-TheStar.png",
    uprightMeaningZh: "希望、療癒與靈感。風雨過後,信念與平靜回歸。",
    uprightMeaningEn: "Hope, healing, and inspiration. After the storm, faith and calm return.",
    reversedMeaningZh: "失去希望、信念動搖或與指引失聯。",
    reversedMeaningEn: "Loss of hope, shaken faith, or disconnection from guidance.",
    keywordsUprightZh: ["希望", "療癒", "靈感", "信念"],
    keywordsUprightEn: ["hope", "healing", "inspiration", "faith"],
    keywordsReversedZh: ["絕望", "失去信念", "迷失"],
    keywordsReversedEn: ["despair", "lost faith", "disconnection"],
  },
  {
    id: "major-18-moon",
    suit: "major",
    number: 18,
    nameZh: "月亮",
    nameEn: "The Moon",
    imagePath: "/tarot/18-TheMoon.png",
    uprightMeaningZh: "幻象、恐懼與潛意識。事情未必如表象,留意直覺。",
    uprightMeaningEn: "Illusion, fear, and subconscious. Things may not be as they seem — trust intuition.",
    reversedMeaningZh: "真相浮現、迷霧散去或釋放恐懼。",
    reversedMeaningEn: "Truth emerging, fog lifting, or releasing fear.",
    keywordsUprightZh: ["幻象", "恐懼", "直覺", "神秘"],
    keywordsUprightEn: ["illusion", "fear", "intuition", "mystery"],
    keywordsReversedZh: ["真相", "澄清", "釋放"],
    keywordsReversedEn: ["truth revealed", "clarity", "release"],
  },
  {
    id: "major-19-sun",
    suit: "major",
    number: 19,
    nameZh: "太陽",
    nameEn: "The Sun",
    imagePath: "/tarot/19-TheSun.png",
    uprightMeaningZh: "喜悅、成功與活力。光明燦爛的時刻,純粹地享受。",
    uprightMeaningEn: "Joy, success, and vitality. A radiant moment — simply enjoy.",
    reversedMeaningZh: "暫時受挫、喜悅被遮蔽或過度樂觀。",
    reversedMeaningEn: "Temporary setback, clouded joy, or overoptimism.",
    keywordsUprightZh: ["喜悅", "成功", "活力", "光明"],
    keywordsUprightEn: ["joy", "success", "vitality", "radiance"],
    keywordsReversedZh: ["受挫", "黯淡", "過度自信"],
    keywordsReversedEn: ["setback", "clouded", "overconfidence"],
  },
  {
    id: "major-20-judgement",
    suit: "major",
    number: 20,
    nameZh: "審判",
    nameEn: "Judgement",
    imagePath: "/tarot/20-Judgement.png",
    uprightMeaningZh: "重生、覺醒與召喚。回顧人生、做出決定性的轉變。",
    uprightMeaningEn: "Rebirth, awakening, and a calling. Review your life and make a decisive shift.",
    reversedMeaningZh: "自我批判過度、拒絕反省或錯失轉機。",
    reversedMeaningEn: "Over-self-criticism, refusing reflection, or missing the call.",
    keywordsUprightZh: ["重生", "覺醒", "反省", "召喚"],
    keywordsUprightEn: ["rebirth", "awakening", "reflection", "calling"],
    keywordsReversedZh: ["自責", "拒絕反省", "錯過"],
    keywordsReversedEn: ["self-criticism", "refusal to reflect", "missed"],
  },
  {
    id: "major-21-world",
    suit: "major",
    number: 21,
    nameZh: "世界",
    nameEn: "The World",
    imagePath: "/tarot/21-TheWorld.png",
    uprightMeaningZh: "圓滿、完成與整合。一個重要循環畫下句點,新的旅程即將開始。",
    uprightMeaningEn: "Completion, fulfillment, and integration. A major cycle closes; a new journey awaits.",
    reversedMeaningZh: "未竟之事、缺乏結案或延遲的圓滿。",
    reversedMeaningEn: "Unfinished business, lack of closure, or delayed fulfillment.",
    keywordsUprightZh: ["圓滿", "完成", "整合", "成就"],
    keywordsUprightEn: ["completion", "fulfillment", "integration", "achievement"],
    keywordsReversedZh: ["未完", "延遲", "不完整"],
    keywordsReversedEn: ["incomplete", "delayed", "lack of closure"],
  },
];

// ============ Minor Arcana 資料 ============
// 四花色的牌義模板(1-10 + 4 宮廷牌)
// 索引 0 = Ace (牌上 01),索引 13 = King (牌上 14)

interface MinorData {
  uprightZh: string;
  uprightEn: string;
  reversedZh: string;
  reversedEn: string;
  keywordsUprightZh: string[];
  keywordsUprightEn: string[];
  keywordsReversedZh: string[];
  keywordsReversedEn: string[];
}

// ── 權杖 Wands(火元素 — 行動、熱情、靈感)
const WANDS: MinorData[] = [
  // Ace
  { uprightZh: "靈感迸發、新機會。一個充滿潛力的起點。", uprightEn: "Burst of inspiration, new opportunity. A potent beginning.",
    reversedZh: "動力不足、機會延遲。", reversedEn: "Lack of motivation, delayed opportunities.",
    keywordsUprightZh: ["靈感", "新機會", "熱情"], keywordsUprightEn: ["inspiration", "opportunity", "passion"],
    keywordsReversedZh: ["動力不足", "延遲"], keywordsReversedEn: ["lack of motivation", "delay"] },
  // 2
  { uprightZh: "計畫、抉擇與發現。站在十字路口展望未來。", uprightEn: "Planning, choice, discovery. Weighing paths at a crossroads.",
    reversedZh: "害怕未知、停留在舒適圈。", reversedEn: "Fear of unknown, playing it safe.",
    keywordsUprightZh: ["計畫", "抉擇", "展望"], keywordsUprightEn: ["planning", "decision", "vision"],
    keywordsReversedZh: ["害怕變動", "原地踏步"], keywordsReversedEn: ["fear of change", "stuck"] },
  // 3
  { uprightZh: "擴展、進展與前瞻。長線佈局開始見效。", uprightEn: "Expansion, progress, foresight. Long-term plans bearing fruit.",
    reversedZh: "進度受阻、視野狹隘。", reversedEn: "Obstacles, delays, short-sightedness.",
    keywordsUprightZh: ["擴展", "前瞻", "進展"], keywordsUprightEn: ["expansion", "foresight", "progress"],
    keywordsReversedZh: ["受阻", "延遲"], keywordsReversedEn: ["blocked", "delay"] },
  // 4
  { uprightZh: "慶祝、和諧、家的歸屬。階段性成果值得慶賀。", uprightEn: "Celebration, harmony, homecoming. A milestone worth celebrating.",
    reversedZh: "家庭或社群關係緊張、慶祝延後。", reversedEn: "Tension at home or community, delayed celebration.",
    keywordsUprightZh: ["慶祝", "和諧", "歸屬"], keywordsUprightEn: ["celebration", "harmony", "belonging"],
    keywordsReversedZh: ["關係緊張", "延遲"], keywordsReversedEn: ["tension", "delay"] },
  // 5
  { uprightZh: "競爭、衝突、意見分歧。良性競爭可帶來成長。", uprightEn: "Competition, conflict, disagreement. Friction can fuel growth.",
    reversedZh: "避免衝突、內在掙扎、尋求化解。", reversedEn: "Avoiding conflict, inner struggle, seeking resolution.",
    keywordsUprightZh: ["競爭", "衝突", "分歧"], keywordsUprightEn: ["competition", "conflict", "disagreement"],
    keywordsReversedZh: ["化解", "內在掙扎"], keywordsReversedEn: ["resolution", "inner struggle"] },
  // 6
  { uprightZh: "勝利、受肯定與公眾認可。努力終於被看見。", uprightEn: "Victory, recognition, public success. Your efforts are finally seen.",
    reversedZh: "成功受質疑、自我懷疑或功高震主。", reversedEn: "Success questioned, self-doubt, or fall from favor.",
    keywordsUprightZh: ["勝利", "肯定", "認可"], keywordsUprightEn: ["victory", "recognition", "acclaim"],
    keywordsReversedZh: ["失寵", "自我懷疑"], keywordsReversedEn: ["fall from grace", "self-doubt"] },
  // 7
  { uprightZh: "堅守立場、挑戰與捍衛。處於守勢但具優勢。", uprightEn: "Standing firm, challenge, defense. Outnumbered but in advantage.",
    reversedZh: "疲於應戰、想放棄或退讓。", reversedEn: "Overwhelmed, tempted to give up or back down.",
    keywordsUprightZh: ["堅守", "捍衛", "挑戰"], keywordsUprightEn: ["standing firm", "defense", "challenge"],
    keywordsReversedZh: ["疲憊", "讓步"], keywordsReversedEn: ["overwhelm", "yielding"] },
  // 8
  { uprightZh: "快速進展、訊息傳遞、移動。事情加速推進。", uprightEn: "Swift progress, messages, movement. Things moving fast.",
    reversedZh: "延遲、溝通受阻、急著做決定。", reversedEn: "Delays, blocked communication, rushed decisions.",
    keywordsUprightZh: ["快速", "推進", "訊息"], keywordsUprightEn: ["swift", "progress", "messages"],
    keywordsReversedZh: ["延遲", "受阻"], keywordsReversedEn: ["delay", "blocked"] },
  // 9
  { uprightZh: "堅韌、警覺、最後一關。累了但還沒結束。", uprightEn: "Resilience, vigilance, the final stretch. Tired but not done yet.",
    reversedZh: "精疲力竭、過度防衛或偏執。", reversedEn: "Exhaustion, over-defensive, paranoia.",
    keywordsUprightZh: ["堅韌", "警覺", "撐住"], keywordsUprightEn: ["resilience", "vigilance", "persistence"],
    keywordsReversedZh: ["耗盡", "偏執"], keywordsReversedEn: ["exhaustion", "paranoia"] },
  // 10
  { uprightZh: "重擔、責任、背負過多。該學會放下或分擔。", uprightEn: "Burden, responsibility, overload. Time to delegate or let go.",
    reversedZh: "放下重擔、學會授權、釋放壓力。", reversedEn: "Letting go, delegating, releasing pressure.",
    keywordsUprightZh: ["重擔", "責任", "壓力"], keywordsUprightEn: ["burden", "responsibility", "pressure"],
    keywordsReversedZh: ["放下", "授權"], keywordsReversedEn: ["release", "delegate"] },
  // Page (11)
  { uprightZh: "探索、熱情、好奇的初學者。充滿可能性的消息。", uprightEn: "Exploration, enthusiasm, the eager beginner. News full of possibility.",
    reversedZh: "想法尚未成熟、缺乏方向、小挫折。", reversedEn: "Half-formed ideas, direction missing, small setbacks.",
    keywordsUprightZh: ["探索", "熱情", "好奇"], keywordsUprightEn: ["exploration", "enthusiasm", "curiosity"],
    keywordsReversedZh: ["不成熟", "迷失"], keywordsReversedEn: ["immature", "unfocused"] },
  // Knight (12)
  { uprightZh: "勇往直前、冒險、強烈行動力。熱情推動你前進。", uprightEn: "Charging forward, adventure, bold action. Passion drives you.",
    reversedZh: "衝動、魯莽、能量分散。", reversedEn: "Impulsive, reckless, scattered energy.",
    keywordsUprightZh: ["行動", "冒險", "熱情"], keywordsUprightEn: ["action", "adventure", "passion"],
    keywordsReversedZh: ["衝動", "分散"], keywordsReversedEn: ["impulsive", "scattered"] },
  // Queen (13)
  { uprightZh: "熱情、自信、有魅力的領導者。溫暖而堅定。", uprightEn: "Warmth, confidence, charismatic leader. Bold yet caring.",
    reversedZh: "善妒、要求過高、情緒反覆。", reversedEn: "Jealous, demanding, moody.",
    keywordsUprightZh: ["熱情", "自信", "魅力"], keywordsUprightEn: ["warmth", "confidence", "charisma"],
    keywordsReversedZh: ["嫉妒", "苛求"], keywordsReversedEn: ["jealousy", "demanding"] },
  // King (14)
  { uprightZh: "願景、領導力、榮譽。以遠見帶領他人。", uprightEn: "Vision, leadership, honor. Leading others with foresight.",
    reversedZh: "獨斷、暴君傾向、衝動決策。", reversedEn: "Authoritarian, tyrannical, impulsive decisions.",
    keywordsUprightZh: ["願景", "領導", "榮譽"], keywordsUprightEn: ["vision", "leadership", "honor"],
    keywordsReversedZh: ["獨斷", "暴君"], keywordsReversedEn: ["authoritarian", "tyrannical"] },
];

// ── 聖杯 Cups(水元素 — 情感、關係、直覺)
const CUPS: MinorData[] = [
  { uprightZh: "新的情感、愛、直覺湧現。心打開了。", uprightEn: "New feelings, love, intuitive opening. The heart awakens.",
    reversedZh: "情感受阻、空虛、壓抑感受。", reversedEn: "Blocked emotion, emptiness, suppressed feelings.",
    keywordsUprightZh: ["新感情", "愛", "直覺"], keywordsUprightEn: ["new love", "emotion", "intuition"],
    keywordsReversedZh: ["阻塞", "空虛"], keywordsReversedEn: ["blocked", "empty"] },
  { uprightZh: "夥伴、吸引力、合一。彼此共鳴的連結。", uprightEn: "Partnership, attraction, unity. A resonant connection.",
    reversedZh: "關係失衡、誤會、斷聯。", reversedEn: "Imbalance, misunderstanding, disconnection.",
    keywordsUprightZh: ["夥伴", "吸引力", "合一"], keywordsUprightEn: ["partnership", "attraction", "union"],
    keywordsReversedZh: ["失衡", "誤會"], keywordsReversedEn: ["imbalance", "misunderstanding"] },
  { uprightZh: "友誼、慶祝、社群。與同路人共享喜悅。", uprightEn: "Friendship, celebration, community. Joy shared with kindred spirits.",
    reversedZh: "過度沉溺、八卦、失和。", reversedEn: "Overindulgence, gossip, fallout.",
    keywordsUprightZh: ["友誼", "慶祝", "社群"], keywordsUprightEn: ["friendship", "celebration", "community"],
    keywordsReversedZh: ["沉溺", "八卦"], keywordsReversedEn: ["overindulgence", "gossip"] },
  { uprightZh: "冷漠、沉思、重新評估。眼前的似乎都不夠。", uprightEn: "Apathy, contemplation, reevaluation. Nothing in front feels enough.",
    reversedZh: "接受新視角、重新投入生活。", reversedEn: "Accepting new perspective, re-engaging with life.",
    keywordsUprightZh: ["冷漠", "沉思", "重新評估"], keywordsUprightEn: ["apathy", "contemplation", "reevaluation"],
    keywordsReversedZh: ["新視角", "重新投入"], keywordsReversedEn: ["new perspective", "re-engagement"] },
  { uprightZh: "失落、哀傷、後悔。注意力都在打翻的杯子上。", uprightEn: "Loss, grief, regret. All eyes on the spilled cups.",
    reversedZh: "接受失去、往前走、發現剩下的禮物。", reversedEn: "Acceptance, moving on, seeing what remains.",
    keywordsUprightZh: ["失落", "哀傷", "後悔"], keywordsUprightEn: ["loss", "grief", "regret"],
    keywordsReversedZh: ["接受", "前行"], keywordsReversedEn: ["acceptance", "moving on"] },
  { uprightZh: "懷舊、童年、純真。過去的美好回來給予力量。", uprightEn: "Nostalgia, childhood, innocence. Past kindness returns as strength.",
    reversedZh: "活在過去、無法放手、不切實際。", reversedEn: "Living in the past, unable to let go, unrealistic.",
    keywordsUprightZh: ["懷舊", "童年", "純真"], keywordsUprightEn: ["nostalgia", "childhood", "innocence"],
    keywordsReversedZh: ["沉溺過去", "逃避"], keywordsReversedEn: ["stuck in past", "escapism"] },
  { uprightZh: "幻想、選擇過多、看清虛實。需要辨識真正想要的。", uprightEn: "Fantasy, many choices, separating truth from illusion. Find what you truly want.",
    reversedZh: "清晰、聚焦、做出務實選擇。", reversedEn: "Clarity, focus, realistic choice.",
    keywordsUprightZh: ["幻想", "選擇", "虛實"], keywordsUprightEn: ["fantasy", "choices", "illusion"],
    keywordsReversedZh: ["清晰", "聚焦"], keywordsReversedEn: ["clarity", "focus"] },
  { uprightZh: "離開、放下、尋找更深的意義。已不再適合。", uprightEn: "Walking away, letting go, seeking deeper meaning. No longer a fit.",
    reversedZh: "害怕改變、原地打轉、留戀。", reversedEn: "Fear of change, going in circles, clinging.",
    keywordsUprightZh: ["離開", "放下", "尋找"], keywordsUprightEn: ["walking away", "letting go", "seeking"],
    keywordsReversedZh: ["害怕改變", "留戀"], keywordsReversedEn: ["fear of change", "clinging"] },
  { uprightZh: "滿足、願望成真、小確幸。心之所向已在手中。", uprightEn: "Contentment, wishes fulfilled, small joys. What you wanted, you have.",
    reversedZh: "表面滿足、貪得無厭、空虛。", reversedEn: "Surface contentment, greed, inner emptiness.",
    keywordsUprightZh: ["滿足", "願望成真"], keywordsUprightEn: ["contentment", "wishes fulfilled"],
    keywordsReversedZh: ["空虛", "貪婪"], keywordsReversedEn: ["emptiness", "greed"] },
  { uprightZh: "和諧、家庭、長久幸福。情感豐足的圓滿。", uprightEn: "Harmony, family, lasting happiness. Emotional fulfillment.",
    reversedZh: "家庭失和、情感斷裂、孤立。", reversedEn: "Family discord, emotional rift, isolation.",
    keywordsUprightZh: ["和諧", "家庭", "幸福"], keywordsUprightEn: ["harmony", "family", "happiness"],
    keywordsReversedZh: ["失和", "斷裂"], keywordsReversedEn: ["discord", "rift"] },
  // Page
  { uprightZh: "創意的火苗、直覺的訊息、情感的新嘗試。", uprightEn: "Creative spark, intuitive message, emotional new venture.",
    reversedZh: "情感不成熟、情緒化、逃避現實。", reversedEn: "Emotional immaturity, moody, escapism.",
    keywordsUprightZh: ["創意", "直覺", "新嘗試"], keywordsUprightEn: ["creativity", "intuition", "new venture"],
    keywordsReversedZh: ["不成熟", "情緒化"], keywordsReversedEn: ["immature", "moody"] },
  // Knight
  { uprightZh: "浪漫、魅力、追尋理想。為情感或理想而行動。", uprightEn: "Romance, charm, pursuing ideals. Acting from the heart.",
    reversedZh: "喜怒無常、失望、過度理想化。", reversedEn: "Moody, disappointment, over-idealization.",
    keywordsUprightZh: ["浪漫", "魅力", "理想"], keywordsUprightEn: ["romance", "charm", "ideal"],
    keywordsReversedZh: ["喜怒無常", "失望"], keywordsReversedEn: ["moody", "disappointment"] },
  // Queen
  { uprightZh: "慈悲、情感安全、深度傾聽。像水一樣包容。", uprightEn: "Compassion, emotional security, deep listening. Embracing like water.",
    reversedZh: "情緒不穩、共依存、情感操縱。", reversedEn: "Emotionally unstable, codependent, emotional manipulation.",
    keywordsUprightZh: ["慈悲", "包容", "傾聽"], keywordsUprightEn: ["compassion", "embrace", "listening"],
    keywordsReversedZh: ["共依存", "操縱"], keywordsReversedEn: ["codependency", "manipulation"] },
  // King
  { uprightZh: "情緒的成熟、外交手腕、平衡。在風浪中保持穩定。", uprightEn: "Emotional maturity, diplomacy, balance. Steady amid the waves.",
    reversedZh: "情緒操縱、壓抑、情感爆發。", reversedEn: "Emotional manipulation, suppression, outbursts.",
    keywordsUprightZh: ["成熟", "外交", "平衡"], keywordsUprightEn: ["maturity", "diplomacy", "balance"],
    keywordsReversedZh: ["操縱", "爆發"], keywordsReversedEn: ["manipulation", "outburst"] },
];

// ── 寶劍 Swords(風元素 — 思想、溝通、衝突)
const SWORDS: MinorData[] = [
  { uprightZh: "清晰、突破、真相。思緒的利刃劈開迷霧。", uprightEn: "Clarity, breakthrough, truth. Cutting through fog with a sharp mind.",
    reversedZh: "混亂、溝通失誤、冷酷。", reversedEn: "Confusion, miscommunication, harshness.",
    keywordsUprightZh: ["清晰", "突破", "真相"], keywordsUprightEn: ["clarity", "breakthrough", "truth"],
    keywordsReversedZh: ["混亂", "誤解"], keywordsReversedEn: ["confusion", "miscommunication"] },
  { uprightZh: "僵持、猶豫、逃避抉擇。閉上眼睛不看不代表問題不存在。", uprightEn: "Stalemate, indecision, avoidance. Closing eyes doesn't remove the choice.",
    reversedZh: "做出決定、真相浮現、鬆動僵局。", reversedEn: "Decision made, truth revealed, breaking the deadlock.",
    keywordsUprightZh: ["僵持", "猶豫", "逃避"], keywordsUprightEn: ["stalemate", "indecision", "avoidance"],
    keywordsReversedZh: ["決定", "真相"], keywordsReversedEn: ["decision", "truth"] },
  { uprightZh: "心碎、悲傷、背叛。痛需要先被看見才能療癒。", uprightEn: "Heartbreak, grief, betrayal. Pain must be acknowledged to heal.",
    reversedZh: "療癒、釋放、寬恕。", reversedEn: "Healing, release, forgiveness.",
    keywordsUprightZh: ["心碎", "悲傷", "背叛"], keywordsUprightEn: ["heartbreak", "grief", "betrayal"],
    keywordsReversedZh: ["療癒", "寬恕"], keywordsReversedEn: ["healing", "forgiveness"] },
  { uprightZh: "休息、沉澱、靜心。暫停才能恢復力量。", uprightEn: "Rest, recovery, meditation. Pause to regain strength.",
    reversedZh: "燃盡、失眠、無法靜心。", reversedEn: "Burnout, restlessness, unable to rest.",
    keywordsUprightZh: ["休息", "沉澱", "冥想"], keywordsUprightEn: ["rest", "recovery", "meditation"],
    keywordsReversedZh: ["燃盡", "不安"], keywordsReversedEn: ["burnout", "restlessness"] },
  { uprightZh: "衝突、勝之不武、空虛的勝利。代價比獎賞大。", uprightEn: "Conflict, hollow win, cost outweighs reward.",
    reversedZh: "和解、修補關係、放下輸贏。", reversedEn: "Reconciliation, mending, letting go of ego.",
    keywordsUprightZh: ["衝突", "空虛的勝利"], keywordsUprightEn: ["conflict", "hollow victory"],
    keywordsReversedZh: ["和解", "修補"], keywordsReversedEn: ["reconciliation", "mending"] },
  { uprightZh: "過渡、遠離、啟程。載著過去的重量前往新岸。", uprightEn: "Transition, moving on, departure. Carrying old weight to a new shore.",
    reversedZh: "無法離開、被過去困住、旅程延遲。", reversedEn: "Unable to move on, stuck in past, delayed journey.",
    keywordsUprightZh: ["過渡", "遠離", "啟程"], keywordsUprightEn: ["transition", "moving on", "departure"],
    keywordsReversedZh: ["困住", "延遲"], keywordsReversedEn: ["stuck", "delayed"] },
  { uprightZh: "策略、欺瞞、祕密行動。留意隱藏的動機。", uprightEn: "Strategy, deception, covert action. Watch for hidden motives.",
    reversedZh: "良心浮現、坦誠、計畫被揭穿。", reversedEn: "Conscience surfacing, honesty, plan exposed.",
    keywordsUprightZh: ["策略", "欺瞞", "祕密"], keywordsUprightEn: ["strategy", "deception", "stealth"],
    keywordsReversedZh: ["坦誠", "揭穿"], keywordsReversedEn: ["honesty", "exposed"] },
  { uprightZh: "自我設限、受困於思維、無力感。看似被綁但其實能走。", uprightEn: "Self-limiting beliefs, trapped in mind, powerlessness. The bindings may be illusion.",
    reversedZh: "解脫、釋放舊信念、重獲自由。", reversedEn: "Liberation, releasing old beliefs, regaining freedom.",
    keywordsUprightZh: ["自我設限", "受困"], keywordsUprightEn: ["self-limiting", "trapped"],
    keywordsReversedZh: ["解脫", "自由"], keywordsReversedEn: ["liberation", "freedom"] },
  { uprightZh: "焦慮、失眠、過度擔憂。深夜的恐懼常比現實誇大。", uprightEn: "Anxiety, insomnia, over-worry. Midnight fears exaggerate.",
    reversedZh: "從焦慮中走出、希望回歸、尋求支持。", reversedEn: "Emerging from anxiety, hope returning, seeking support.",
    keywordsUprightZh: ["焦慮", "擔憂", "惡夢"], keywordsUprightEn: ["anxiety", "worry", "nightmares"],
    keywordsReversedZh: ["恢復", "希望"], keywordsReversedEn: ["recovery", "hope"] },
  { uprightZh: "徹底結束、谷底、痛苦的完結。觸底才能反彈。", uprightEn: "Total ending, rock bottom, painful closure. Only from here can you rise.",
    reversedZh: "緩慢的復原、避免最壞、學到教訓。", reversedEn: "Slow recovery, averting worst, lesson learned.",
    keywordsUprightZh: ["結束", "谷底", "完結"], keywordsUprightEn: ["ending", "rock bottom", "closure"],
    keywordsReversedZh: ["復原", "教訓"], keywordsReversedEn: ["recovery", "lesson"] },
  // Page
  { uprightZh: "好奇、敏銳、警覺。充滿想法的年輕頭腦。", uprightEn: "Curious, sharp-minded, vigilant. A young mind full of ideas.",
    reversedZh: "八卦、急躁、話多不實。", reversedEn: "Gossip, haste, careless words.",
    keywordsUprightZh: ["好奇", "敏銳", "警覺"], keywordsUprightEn: ["curious", "sharp", "vigilant"],
    keywordsReversedZh: ["八卦", "急躁"], keywordsReversedEn: ["gossip", "haste"] },
  // Knight
  { uprightZh: "衝鋒、捍衛信念、迅捷。為真理而戰。", uprightEn: "Charging in, defending beliefs, swift. Fighting for truth.",
    reversedZh: "魯莽、傲慢、好鬥。", reversedEn: "Reckless, arrogant, combative.",
    keywordsUprightZh: ["衝鋒", "捍衛", "迅捷"], keywordsUprightEn: ["charge", "defense", "swift"],
    keywordsReversedZh: ["魯莽", "好鬥"], keywordsReversedEn: ["reckless", "combative"] },
  // Queen
  { uprightZh: "獨立、洞察、直言。用清晰頭腦辨明真偽。", uprightEn: "Independent, perceptive, direct. Cuts through with clarity.",
    reversedZh: "冷漠、尖酸、挑剔。", reversedEn: "Cold, harsh, overly critical.",
    keywordsUprightZh: ["獨立", "洞察", "直言"], keywordsUprightEn: ["independent", "perceptive", "direct"],
    keywordsReversedZh: ["冷漠", "尖酸"], keywordsReversedEn: ["cold", "harsh"] },
  // King
  { uprightZh: "理智權威、倫理、公正判斷。以智慧治理。", uprightEn: "Intellectual authority, ethics, fair judgment. Governs with wisdom.",
    reversedZh: "專橫、冷酷、濫用理性。", reversedEn: "Tyrannical, cold, weaponizing logic.",
    keywordsUprightZh: ["智慧", "倫理", "公正"], keywordsUprightEn: ["wisdom", "ethics", "justice"],
    keywordsReversedZh: ["專橫", "濫用"], keywordsReversedEn: ["tyrannical", "misuse"] },
];

// ── 錢幣 Pentacles(土元素 — 物質、工作、身體)
const PENTACLES: MinorData[] = [
  { uprightZh: "新的物質機會、富足的種子。穩固的新起點。", uprightEn: "New material opportunity, seed of abundance. A solid new start.",
    reversedZh: "錯失機會、財務延遲、短視。", reversedEn: "Missed opportunity, financial delay, short-sightedness.",
    keywordsUprightZh: ["新機會", "富足", "起點"], keywordsUprightEn: ["opportunity", "abundance", "beginning"],
    keywordsReversedZh: ["錯失", "延遲"], keywordsReversedEn: ["missed", "delayed"] },
  { uprightZh: "平衡、多工、適應變化。玩轉優先順序。", uprightEn: "Balance, juggling, adapting to change. Playing with priorities.",
    reversedZh: "超載、失序、無法兼顧。", reversedEn: "Overwhelm, disorder, dropping balls.",
    keywordsUprightZh: ["平衡", "多工", "適應"], keywordsUprightEn: ["balance", "juggling", "adaptability"],
    keywordsReversedZh: ["超載", "失序"], keywordsReversedEn: ["overwhelm", "disorder"] },
  { uprightZh: "合作、工藝、團隊努力。各司其職共同打造。", uprightEn: "Collaboration, craftsmanship, teamwork. Each role builds the whole.",
    reversedZh: "團隊失和、技能不符、各自為政。", reversedEn: "Team discord, skill mismatch, working in silos.",
    keywordsUprightZh: ["合作", "工藝", "團隊"], keywordsUprightEn: ["collaboration", "craft", "teamwork"],
    keywordsReversedZh: ["失和", "各自為政"], keywordsReversedEn: ["discord", "silos"] },
  { uprightZh: "保守、控制、守成。握得太緊反而僵化。", uprightEn: "Conservation, control, clinging. Holding too tight becomes rigidity.",
    reversedZh: "放下控制、慷慨、重新流動。", reversedEn: "Releasing control, generosity, flow returning.",
    keywordsUprightZh: ["保守", "控制", "守成"], keywordsUprightEn: ["conservation", "control", "clinging"],
    keywordsReversedZh: ["放下", "慷慨"], keywordsReversedEn: ["release", "generosity"] },
  { uprightZh: "財務困頓、孤立、缺乏安全感。困境中別忘了還有援手。", uprightEn: "Financial hardship, isolation, insecurity. Help is near, if you look.",
    reversedZh: "走出困境、獲得支持、重建根基。", reversedEn: "Emerging from hardship, receiving help, rebuilding.",
    keywordsUprightZh: ["困頓", "孤立", "不安"], keywordsUprightEn: ["hardship", "isolation", "insecurity"],
    keywordsReversedZh: ["走出", "支持"], keywordsReversedEn: ["emerging", "support"] },
  { uprightZh: "慷慨、給予、流動的資源。施與受都處於健康位置。", uprightEn: "Generosity, giving, flowing resources. Both giving and receiving in balance.",
    reversedZh: "自私、施受失衡、債務糾葛。", reversedEn: "Selfishness, imbalance, debt entanglement.",
    keywordsUprightZh: ["慷慨", "給予", "流動"], keywordsUprightEn: ["generosity", "giving", "flow"],
    keywordsReversedZh: ["自私", "失衡"], keywordsReversedEn: ["selfishness", "imbalance"] },
  { uprightZh: "耐心、長線投資、階段性檢視。成長需要時間。", uprightEn: "Patience, long-term investment, taking stock. Growth takes time.",
    reversedZh: "急於求成、失去耐心、付出沒回報。", reversedEn: "Impatience, losing faith, effort without reward.",
    keywordsUprightZh: ["耐心", "長線", "檢視"], keywordsUprightEn: ["patience", "long-term", "assessment"],
    keywordsReversedZh: ["急躁", "無回報"], keywordsReversedEn: ["impatience", "no reward"] },
  { uprightZh: "勤奮、技藝精進、專注打磨。一再練習以臻完美。", uprightEn: "Diligence, honing craft, focused practice. Refining through repetition.",
    reversedZh: "完美主義、瞎忙、方向錯誤。", reversedEn: "Perfectionism, busywork, misdirected effort.",
    keywordsUprightZh: ["勤奮", "技藝", "專注"], keywordsUprightEn: ["diligence", "craft", "focus"],
    keywordsReversedZh: ["完美主義", "瞎忙"], keywordsReversedEn: ["perfectionism", "busywork"] },
  { uprightZh: "富足、獨立、享受成果。獨自一人也能自在富有。", uprightEn: "Abundance, self-sufficiency, enjoying rewards. Richness in solitude.",
    reversedZh: "財務挫折、工作狂、物質上的孤立。", reversedEn: "Financial setback, workaholism, material isolation.",
    keywordsUprightZh: ["富足", "獨立", "享受"], keywordsUprightEn: ["abundance", "self-sufficient", "enjoyment"],
    keywordsReversedZh: ["挫折", "工作狂"], keywordsReversedEn: ["setback", "workaholism"] },
  { uprightZh: "家族財富、傳承、長期穩定。成果跨世代延續。", uprightEn: "Family wealth, legacy, long-term stability. Fruit crossing generations.",
    reversedZh: "財務損失、家族爭執、傳承斷裂。", reversedEn: "Financial loss, family conflict, broken legacy.",
    keywordsUprightZh: ["家族", "傳承", "穩定"], keywordsUprightEn: ["family", "legacy", "stability"],
    keywordsReversedZh: ["損失", "爭執"], keywordsReversedEn: ["loss", "conflict"] },
  // Page
  { uprightZh: "學習、新嘗試的顯化、專注的年輕學徒。", uprightEn: "Studious, manifesting a new try, focused apprentice.",
    reversedZh: "拖延、缺乏進度、機會未把握。", reversedEn: "Procrastination, lack of progress, missed chances.",
    keywordsUprightZh: ["學習", "顯化", "專注"], keywordsUprightEn: ["studious", "manifest", "focus"],
    keywordsReversedZh: ["拖延", "無進度"], keywordsReversedEn: ["procrastination", "no progress"] },
  // Knight
  { uprightZh: "可靠、規律、慢工出細活。踏實地一步步推進。", uprightEn: "Reliable, routine, patient craftsmanship. Steady step by step.",
    reversedZh: "頑固、無聊、停滯。", reversedEn: "Stubborn, boring, stagnant.",
    keywordsUprightZh: ["可靠", "規律", "踏實"], keywordsUprightEn: ["reliable", "routine", "steady"],
    keywordsReversedZh: ["頑固", "停滯"], keywordsReversedEn: ["stubborn", "stagnant"] },
  // Queen
  { uprightZh: "滋養、務實、財務穩固。物質與情感兼顧。", uprightEn: "Nurturing, practical, financially secure. Caring for both material and heart.",
    reversedZh: "忽視自我、共依存、工作與生活失衡。", reversedEn: "Self-neglect, codependency, work-life imbalance.",
    keywordsUprightZh: ["滋養", "務實", "穩固"], keywordsUprightEn: ["nurturing", "practical", "secure"],
    keywordsReversedZh: ["忽視自我", "失衡"], keywordsReversedEn: ["self-neglect", "imbalance"] },
  // King
  { uprightZh: "富足、權威、事業巔峰。以穩健智慧守護成就。", uprightEn: "Abundance, authority, career pinnacle. Guarding achievements with steady wisdom.",
    reversedZh: "貪婪、物質至上、腐敗。", reversedEn: "Greed, materialism, corruption.",
    keywordsUprightZh: ["富足", "權威", "巔峰"], keywordsUprightEn: ["abundance", "authority", "pinnacle"],
    keywordsReversedZh: ["貪婪", "腐敗"], keywordsReversedEn: ["greed", "corruption"] },
];

// 小牌名字生成
function minorName(suit: "wands" | "cups" | "swords" | "pentacles", num: number): { zh: string; en: string } {
  const suitZh = SUIT_NAMES_ZH[suit];
  const suitEn = SUIT_NAMES_EN[suit];
  if (num === 1) return { zh: `${suitZh}一`, en: `Ace of ${suitEn}` };
  if (num >= 2 && num <= 10) return { zh: `${suitZh}${num}`, en: `${num} of ${suitEn}` };
  // 11..14 → 宮廷
  const idx = num - 11;
  return { zh: `${suitZh}${COURT_ZH[idx]}`, en: `${COURT_EN[idx]} of ${suitEn}` };
}

function buildMinor(
  suit: "wands" | "cups" | "swords" | "pentacles",
  data: MinorData[],
  imageSuit: string
): TarotCard[] {
  return data.map((d, i) => {
    const num = i + 1;
    const names = minorName(suit, num);
    return {
      id: `${suit}-${String(num).padStart(2, "0")}`,
      suit,
      number: num,
      nameZh: names.zh,
      nameEn: names.en,
      imagePath: `/tarot/${imageSuit}${String(num).padStart(2, "0")}.png`,
      uprightMeaningZh: d.uprightZh,
      uprightMeaningEn: d.uprightEn,
      reversedMeaningZh: d.reversedZh,
      reversedMeaningEn: d.reversedEn,
      keywordsUprightZh: d.keywordsUprightZh,
      keywordsUprightEn: d.keywordsUprightEn,
      keywordsReversedZh: d.keywordsReversedZh,
      keywordsReversedEn: d.keywordsReversedEn,
    };
  });
}

// ============ 完整 78 張牌組 ============
export const tarotDeck: TarotCard[] = [
  ...MAJOR,
  ...buildMinor("wands", WANDS, "Wands"),
  ...buildMinor("cups", CUPS, "Cups"),
  ...buildMinor("swords", SWORDS, "Swords"),
  ...buildMinor("pentacles", PENTACLES, "Pentacles"),
];

// ============ Helper: 抽牌 ============
// 從整副牌隨機抽三張(不重複),每張 50% 機率逆位
export interface DrawnCard {
  card: TarotCard;
  isReversed: boolean;
}

export function drawThreeCards(): DrawnCard[] {
  // Fisher-Yates shuffle,只洗前 3 張
  const indices = Array.from({ length: tarotDeck.length }, (_, i) => i);
  for (let i = 0; i < 3; i++) {
    const j = i + Math.floor(Math.random() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, 3).map((idx) => ({
    card: tarotDeck[idx],
    isReversed: Math.random() < 0.5,
  }));
}

export function getCardById(id: string): TarotCard | undefined {
  return tarotDeck.find((c) => c.id === id);
}

// ============ 三張牌陣位置(過去-現在-未來)============
export const THREE_CARD_POSITIONS = [
  { key: "past", labelZh: "過去", labelEn: "Past", descZh: "造成當下局面的根源或背景", descEn: "Roots and background of the current situation" },
  { key: "present", labelZh: "現在", labelEn: "Present", descZh: "此刻最重要的能量或課題", descEn: "The most important energy or lesson now" },
  { key: "future", labelZh: "未來", labelEn: "Future", descZh: "若現況延續,可能的走向", descEn: "Likely trajectory if current course continues" },
] as const;
