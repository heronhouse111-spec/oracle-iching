/**
 * 梅花易數 · 時間起卦
 *
 * 邵雍創,核心是「萬物皆數」。本實作採「現代簡化版」:
 *   - 公曆原始數字(年/月/日/時/分),不轉農曆地支
 *   - 24 小時制(時 0-23、分 0-59),保留分以利同一個小時內仍可變卦
 *
 * 公式(與正統邵雍法略有差異 — 正統用農曆 + 地支年,且只到時辰):
 *   sumUpper = 年 + 月 + 日 + 時
 *   sumLower = sumUpper + 分
 *   上卦序號 = sumUpper mod 8     (1..8;整除時取 8)
 *   下卦序號 = sumLower mod 8     (1..8)
 *   動爻    = sumLower mod 6     (1..6,自下而上)
 *
 * 八卦序採先天八卦(梅花易數標準):
 *   1 乾 2 兌 3 離 4 震 5 巽 6 坎 7 艮 8 坤
 *
 * 之卦由本卦動爻位翻轉得出。本卦 / 之卦皆透過既有的 findHexagram 反查。
 */

import { findHexagram, type Hexagram } from "@/data/hexagrams";

/**
 * 先天八卦 1..8 對應的 3-bit code,bottom-to-top 編碼
 * (與 data/hexagrams.ts 的 trigramNames key 一致)。
 */
export const PLUM_TRIGRAM_CODES: readonly string[] = [
  "111", // 1 乾 ☰
  "110", // 2 兌 ☱
  "101", // 3 離 ☲
  "100", // 4 震 ☳
  "011", // 5 巽 ☴
  "010", // 6 坎 ☵
  "001", // 7 艮 ☶
  "000", // 8 坤 ☷
];

/** 1..8 對應的中文名,純展示用,跨語系仍走 trigramNames。 */
export const PLUM_TRIGRAM_NAMES_ZH: readonly string[] = [
  "乾",
  "兌",
  "離",
  "震",
  "巽",
  "坎",
  "艮",
  "坤",
];

/**
 * 1-indexed mod:整除時回 m 而非 0,讓八卦 / 六爻編號從 1 起算。
 */
function modWrap(n: number, m: number): number {
  const r = n % m;
  return r === 0 ? m : r;
}

export interface PlumNumbers {
  /** 公曆年(原始數字) */
  year: number;
  /** 公曆月 1-12 */
  month: number;
  /** 公曆日 1-31 */
  day: number;
  /** 24 小時制 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
}

export interface PlumDerivation {
  numbers: PlumNumbers;
  /** 年+月+日+時 */
  sumUpper: number;
  /** sumUpper + 分 */
  sumLower: number;
  /** 上卦序號 1-8 */
  upperIndex: number;
  /** 下卦序號 1-8 */
  lowerIndex: number;
  /** 動爻位 1-6,自下而上 */
  changingLine: number;
  /** 上卦 3-bit code */
  upperCode: string;
  /** 下卦 3-bit code */
  lowerCode: string;
  /** 本卦六爻 bottom→top,長度 6,值 0|1 */
  primaryLines: number[];
  /** 之卦六爻(將 changingLine - 1 位翻轉),長度 6 */
  transformedLines: number[];
  /** 本卦完整資料(經 findHexagram 反查) */
  primaryHex: Hexagram;
  /** 之卦完整資料 */
  transformedHex: Hexagram;
}

/**
 * 從一個 Date 物件計算梅花易數時間起卦結果。
 */
export function derivePlumFromDate(date: Date): PlumDerivation {
  const numbers: PlumNumbers = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
  return derivePlum(numbers);
}

/**
 * 從原始數字計算 — 抽出來方便寫單元測試,給定固定輸入驗證輸出。
 */
export function derivePlum(numbers: PlumNumbers): PlumDerivation {
  const { year, month, day, hour, minute } = numbers;

  const sumUpper = year + month + day + hour;
  const sumLower = sumUpper + minute;

  const upperIndex = modWrap(sumUpper, 8);
  const lowerIndex = modWrap(sumLower, 8);
  const changingLine = modWrap(sumLower, 6);

  const upperCode = PLUM_TRIGRAM_CODES[upperIndex - 1];
  const lowerCode = PLUM_TRIGRAM_CODES[lowerIndex - 1];

  // bottom→top:lower 在前,upper 在後
  const primaryLines = (lowerCode + upperCode).split("").map((c) => Number(c));

  const transformedLines = [...primaryLines];
  const flipIdx = changingLine - 1;
  transformedLines[flipIdx] = transformedLines[flipIdx] === 1 ? 0 : 1;

  const primaryHex = findHexagram(primaryLines);
  const transformedHex = findHexagram(transformedLines);

  if (!primaryHex || !transformedHex) {
    // 不該發生 — primaryLines 是 6 個 0/1,findHexagram 必能反查。
    throw new Error(
      `[plum] could not resolve hexagram for lines ${JSON.stringify(primaryLines)}`
    );
  }

  return {
    numbers,
    sumUpper,
    sumLower,
    upperIndex,
    lowerIndex,
    changingLine,
    upperCode,
    lowerCode,
    primaryLines,
    transformedLines,
    primaryHex,
    transformedHex,
  };
}
