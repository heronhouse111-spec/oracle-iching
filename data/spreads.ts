/**
 * 多牌陣設定 — 取代原本只有 THREE_CARD_POSITIONS 的單一支援
 *
 * 設計重點:
 *   - 每個牌陣定義 N 個 position(每個 position 有 key / labelZh / labelEn / descZh / descEn)
 *   - drawSpread() 是通用洗牌函式,任意牌陣都用同一支
 *   - 既有 THREE_CARD_POSITIONS 仍從 data/tarot.ts 匯出(向後相容),這裡的 SPREADS[0] 是同一份內容
 *   - DB 欄位 tarot_cards: jsonb 不需改,position 改用 string(每個牌陣自己定義 key)
 *
 * 為何分檔:
 *   data/tarot.ts 已經 770 行,塞下 5 個牌陣會更難讀;牌陣是「玩法」,牌庫是「素材」,分開比較清楚。
 */

import { tarotDeck, type DrawnCard } from "@/data/tarot";

export interface SpreadPosition {
  /** 簡短英文 key,寫進 DB 用(避免 i18n 字串污染 schema) */
  key: string;
  labelZh: string;
  labelEn: string;
  /** 給使用者的位置描述(landing page 上會顯示) */
  descZh: string;
  descEn: string;
}

export type SpreadCategory = "general" | "love" | "decision" | "year";

export interface Spread {
  /** URL slug + DB 識別 */
  id: string;
  nameZh: string;
  nameEn: string;
  /** 一句話介紹(landing page hero) */
  taglineZh: string;
  taglineEn: string;
  /** 何時用 / 適合什麼問題(landing page 主文) */
  whenZh: string;
  whenEn: string;
  category: SpreadCategory;
  positions: SpreadPosition[];
  /** 抽幾張等於 positions.length,但獨立欄位避免每次 .length */
  cardCount: number;
}

// ──────────────────────────────────────────
// 1. 三牌:過去 / 現在 / 未來(沿用既有,向後相容)
// ──────────────────────────────────────────
const THREE_CARD: Spread = {
  id: "three-card",
  nameZh: "三牌時間軸",
  nameEn: "Three-Card Timeline",
  taglineZh: "最經典的入門牌陣,看一件事的脈絡走向",
  taglineEn: "The classic — see the arc of any single matter",
  whenZh:
    "適合所有不確定脈絡的問題:這段感情的走向、這份工作的發展、這個專案的進度。三張牌串成「事情的根、現在的關鍵、若不變則的去向」,適合作為日常占卜的起手式。",
  whenEn:
    "Use when you want a quick narrative on any single matter: a relationship trajectory, a job, a project. The three cards weave into 'roots — present pivot — likely direction', great as a daily go-to.",
  category: "general",
  cardCount: 3,
  positions: [
    {
      key: "past",
      labelZh: "過去",
      labelEn: "Past",
      descZh: "造成當下局面的根源或背景",
      descEn: "Roots and background of the current situation",
    },
    {
      key: "present",
      labelZh: "現在",
      labelEn: "Present",
      descZh: "此刻最重要的能量或課題",
      descEn: "The most important energy or lesson now",
    },
    {
      key: "future",
      labelZh: "未來",
      labelEn: "Future",
      descZh: "若現況延續,可能的走向",
      descEn: "Likely trajectory if current course continues",
    },
  ],
};

// ──────────────────────────────────────────
// 2. 二選一:在兩條路徑中做選擇
// ──────────────────────────────────────────
const TWO_OPTIONS: Spread = {
  id: "two-options",
  nameZh: "二選一牌陣",
  nameEn: "Two Options Spread",
  taglineZh: "卡在兩個選擇之間時,看每條路會帶你去哪裡",
  taglineEn: "Stuck between two choices? See where each path leads",
  whenZh:
    "適合「換工作 vs 留下」「選擇 A 公司還是 B 公司」「這段關係要繼續還是放手」這類二元決策。三張牌:現況 + 選 A 後的能量 + 選 B 後的能量,讓你看清楚兩條路的本質而非結果預言。",
  whenEn:
    "Use when stuck between two paths — change job vs stay, company A vs B, continue or end a relationship. Three cards: current ground + energy after choosing A + energy after choosing B. Reveals the nature of each path, not a fortune-told outcome.",
  category: "decision",
  cardCount: 3,
  positions: [
    {
      key: "current",
      labelZh: "現況",
      labelEn: "Current Ground",
      descZh: "你此刻站的位置與心情",
      descEn: "Where you stand and feel right now",
    },
    {
      key: "option-a",
      labelZh: "選擇 A",
      labelEn: "Option A",
      descZh: "選擇 A 路徑後將遇到的能量與課題",
      descEn: "Energies and lessons if you choose path A",
    },
    {
      key: "option-b",
      labelZh: "選擇 B",
      labelEn: "Option B",
      descZh: "選擇 B 路徑後將遇到的能量與課題",
      descEn: "Energies and lessons if you choose path B",
    },
  ],
};

// ──────────────────────────────────────────
// 3. 愛情十字:五張牌深入感情
// ──────────────────────────────────────────
const LOVE_CROSS: Spread = {
  id: "love-cross",
  nameZh: "愛情十字牌陣",
  nameEn: "Love Cross",
  taglineZh: "兩個人之間,五個面向一次看清",
  taglineEn: "Five facets of a relationship in one cross",
  whenZh:
    "適合在意一段關係的細節時用:你怎麼看對方、對方怎麼看你、你們之間的能量、潛在阻礙、未來方向。五張牌構成十字結構,中間是兩人現在的核心能量,四周是各自視角與關係中的力量。",
  whenEn:
    "Use to look deep into a relationship: how you see them, how they see you, the bond between, what blocks it, where it heads. Five cards form a cross — centre is the current core energy, the arms are perspectives and forces.",
  category: "love",
  cardCount: 5,
  positions: [
    {
      key: "you",
      labelZh: "你的視角",
      labelEn: "Your Perspective",
      descZh: "你怎麼看待這段關係或對方",
      descEn: "How you see this relationship or them",
    },
    {
      key: "them",
      labelZh: "對方視角",
      labelEn: "Their Perspective",
      descZh: "對方怎麼看待你或這段關係",
      descEn: "How they see you or the relationship",
    },
    {
      key: "bond",
      labelZh: "兩人之間",
      labelEn: "The Bond",
      descZh: "你們此刻最核心的能量",
      descEn: "The core energy between you right now",
    },
    {
      key: "obstacle",
      labelZh: "阻礙",
      labelEn: "Obstacle",
      descZh: "正在卡住關係的力量或議題",
      descEn: "What's blocking this from flowing",
    },
    {
      key: "trajectory",
      labelZh: "未來方向",
      labelEn: "Trajectory",
      descZh: "若不刻意干預,此關係可能的去向",
      descEn: "Where this likely heads if left as-is",
    },
  ],
};

// ──────────────────────────────────────────
// 4. 凱爾特十字:十張牌做完整人生命題
// ──────────────────────────────────────────
const CELTIC_CROSS: Spread = {
  id: "celtic-cross",
  nameZh: "凱爾特十字",
  nameEn: "Celtic Cross",
  taglineZh: "塔羅最完整的牌陣,十張牌深入一個人生命題",
  taglineEn: "The most complete tarot spread — 10 cards on one matter",
  whenZh:
    "用於重大、複雜、需要全景理解的問題:該不該離職創業、人生階段轉換、長期關係該如何面對。十張牌涵蓋:現況、阻礙、潛意識、過去、可達成的、近未來、自我、外境、希望恐懼、最終結果。建議搭配 Deep Insight 模式使用。",
  whenEn:
    "For big, complex, panoramic questions: should I leave my job, life-stage transitions, long-term relationships. Ten cards cover present, challenge, subconscious, past, achievable, near future, self, environment, hopes/fears, final outcome. Pair with Deep Insight mode.",
  category: "general",
  cardCount: 10,
  positions: [
    {
      key: "present",
      labelZh: "現況",
      labelEn: "Present",
      descZh: "問事者目前的狀態與處境",
      descEn: "Where the querent stands now",
    },
    {
      key: "challenge",
      labelZh: "挑戰",
      labelEn: "Challenge",
      descZh: "正面對的核心挑戰或推動力",
      descEn: "The core challenge or driving force",
    },
    {
      key: "subconscious",
      labelZh: "潛在",
      labelEn: "Subconscious",
      descZh: "潛意識中影響此事的能量",
      descEn: "Subconscious energies shaping this matter",
    },
    {
      key: "past",
      labelZh: "過去",
      labelEn: "Past",
      descZh: "近期的影響與起因",
      descEn: "Recent influences and causes",
    },
    {
      key: "achievable",
      labelZh: "可達成",
      labelEn: "Achievable",
      descZh: "意識上可以達成的目標或想法",
      descEn: "Conscious goals or aspirations within reach",
    },
    {
      key: "near-future",
      labelZh: "近未來",
      labelEn: "Near Future",
      descZh: "幾週內最可能浮現的發展",
      descEn: "Most likely developments in coming weeks",
    },
    {
      key: "self",
      labelZh: "自我",
      labelEn: "Self",
      descZh: "問事者面對此事時的姿態",
      descEn: "How the querent approaches this matter",
    },
    {
      key: "environment",
      labelZh: "外境",
      labelEn: "Environment",
      descZh: "周遭人事物對此事的影響",
      descEn: "How the surroundings shape this matter",
    },
    {
      key: "hopes-fears",
      labelZh: "希望與恐懼",
      labelEn: "Hopes & Fears",
      descZh: "問事者最深的期待與不安",
      descEn: "Deepest hopes and fears at play",
    },
    {
      key: "outcome",
      labelZh: "最終結果",
      labelEn: "Final Outcome",
      descZh: "若上述能量延續,最終的走向",
      descEn: "Final direction if these energies hold",
    },
  ],
};

// ──────────────────────────────────────────
// 5. 年度十二宮:跨度一整年的能量地圖
// ──────────────────────────────────────────
const YEAR_TWELVE: Spread = {
  id: "year-twelve",
  nameZh: "年度十二宮",
  nameEn: "Yearly 12-House",
  taglineZh: "一張十二月份的能量地圖,看清楚整年的節奏",
  taglineEn: "A 12-month energy map for the year ahead",
  whenZh:
    "適合在新的一年、新的生日、人生新階段開始時做。十二張牌對應一月到十二月,可以看出每個月的主題、能量、適合做什麼。建議用 Deep Insight 模式並搭配年度紀錄回頭驗證。",
  whenEn:
    "Use at new year, your birthday, or a new life-chapter. Twelve cards map January through December — themes, energies, suggested focus per month. Pair with Deep Insight and revisit your journal at year-end.",
  category: "year",
  cardCount: 12,
  positions: [
    { key: "month-01", labelZh: "一月", labelEn: "January", descZh: "新年起手,本月的能量與主題", descEn: "Year-start theme & energy" },
    { key: "month-02", labelZh: "二月", labelEn: "February", descZh: "本月的能量與主題", descEn: "Theme & energy this month" },
    { key: "month-03", labelZh: "三月", labelEn: "March", descZh: "本月的能量與主題", descEn: "Theme & energy this month" },
    { key: "month-04", labelZh: "四月", labelEn: "April", descZh: "本月的能量與主題", descEn: "Theme & energy this month" },
    { key: "month-05", labelZh: "五月", labelEn: "May", descZh: "本月的能量與主題", descEn: "Theme & energy this month" },
    { key: "month-06", labelZh: "六月", labelEn: "June", descZh: "本月的能量與主題", descEn: "Theme & energy this month" },
    { key: "month-07", labelZh: "七月", labelEn: "July", descZh: "本月的能量與主題", descEn: "Theme & energy this month" },
    { key: "month-08", labelZh: "八月", labelEn: "August", descZh: "本月的能量與主題", descEn: "Theme & energy this month" },
    { key: "month-09", labelZh: "九月", labelEn: "September", descZh: "本月的能量與主題", descEn: "Theme & energy this month" },
    { key: "month-10", labelZh: "十月", labelEn: "October", descZh: "本月的能量與主題", descEn: "Theme & energy this month" },
    { key: "month-11", labelZh: "十一月", labelEn: "November", descZh: "本月的能量與主題", descEn: "Theme & energy this month" },
    { key: "month-12", labelZh: "十二月", labelEn: "December", descZh: "全年總結,延續到新年的能量", descEn: "Year-end summary, energy carrying into next year" },
  ],
};

export const SPREADS: Spread[] = [
  THREE_CARD,
  TWO_OPTIONS,
  LOVE_CROSS,
  CELTIC_CROSS,
  YEAR_TWELVE,
];

export const DEFAULT_SPREAD_ID = "three-card";

export function getSpread(id: string | null | undefined): Spread {
  if (!id) return SPREADS[0];
  return SPREADS.find((s) => s.id === id) ?? SPREADS[0];
}

export function getSpreadPosition(
  spread: Spread,
  positionKey: string
): SpreadPosition | undefined {
  return spread.positions.find((p) => p.key === positionKey);
}

/**
 * 通用洗牌:Fisher-Yates,只洗前 N 張(N=spread.cardCount)
 * 每張獨立 50/50 正逆位
 */
export function drawSpread(spread: Spread): DrawnCard[] {
  const indices = Array.from({ length: tarotDeck.length }, (_, i) => i);
  for (let i = 0; i < spread.cardCount; i++) {
    const j = i + Math.floor(Math.random() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, spread.cardCount).map((idx) => ({
    card: tarotDeck[idx],
    isReversed: Math.random() < 0.5,
  }));
}

/**
 * 抽單張(給 Yes/No 與 Daily Card 使用)
 * 已知日期種子 → 用 deterministic 抽法,讓「同一天同一人抽到同一張」
 */
export function drawOneCard(seed?: string): DrawnCard {
  if (seed) {
    // 簡易 hash — 不是密碼學等級,但足夠讓同一天同一 seed 拿到同一張
    let h = 5381;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
    }
    const idx = h % tarotDeck.length;
    const isReversed = ((h >>> 16) & 1) === 1;
    return { card: tarotDeck[idx], isReversed };
  }
  const idx = Math.floor(Math.random() * tarotDeck.length);
  return { card: tarotDeck[idx], isReversed: Math.random() < 0.5 };
}
