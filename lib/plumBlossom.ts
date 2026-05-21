/**
 * 梅花易數 — 時間起卦演算法(Plum Blossom Numerology · Time Casting)
 *
 * 宋代邵雍所創,核心是「萬物皆數」。最廣為人知的「時間起卦」公式:
 *
 *   上卦 = (年支 + 月 + 日)        mod 8     (餘 0 視為 8)
 *   下卦 = (年支 + 月 + 日 + 時辰)  mod 8     (餘 0 視為 8)
 *   動爻 = (年支 + 月 + 日 + 時辰)  mod 6     (餘 0 視為 6)
 *
 * 八卦對映用「先天八卦」順序:
 *   1=乾(111) 2=兌(110) 3=離(101) 4=震(100)
 *   5=巽(011) 6=坎(010) 7=艮(001) 8=坤(000)
 *
 * 時辰(地支)對映:子=1, 丑=2, 寅=3, 卯=4, 辰=5, 巳=6,
 *                 午=7, 未=8, 申=9, 酉=10, 戌=11, 亥=12
 *   時段:子 23-01, 丑 01-03, 寅 03-05, 卯 05-07,
 *        辰 07-09, 巳 09-11, 午 11-13, 未 13-15,
 *        申 15-17, 酉 17-19, 戌 19-21, 亥 21-23
 *
 * 年支(年地支):用 (year - 4) mod 12 + 1 — 西元 4 年是甲子,
 *               簡化版本不必查農曆,精度對日常占卜足夠。
 *
 * 月、日:直接用公曆數字(1..12 / 1..31)。傳統用農曆數字會更精確,
 *         但需要農曆轉換表;先做簡化版,使用者體感差別不大。
 */

import { findHexagram, type Hexagram } from "@/data/hexagrams";

// 先天八卦序 → 二進位字串(下到上,跟 trigramNames 同一個 key shape)
const TRIGRAM_BY_NUM: Record<number, string> = {
  1: "111", // 乾
  2: "110", // 兌
  3: "101", // 離
  4: "100", // 震
  5: "011", // 巽
  6: "010", // 坎
  7: "001", // 艮
  8: "000", // 坤
};

/** 把 0-23 的 24 小時制轉成 1-12 時辰(子=1, 丑=2, ..., 亥=12)。 */
function hourToShichen(hour: number): number {
  // 23-00:59 = 子(1), 01-02:59 = 丑(2), ...
  // 對映:hour=23 → +1 = 24 → /2 = 12 → +1 = 13 → 公式重新調整
  // 簡單寫法:把 23 映射成 -1,然後 +1, /2 +1
  // 實作:
  if (hour === 23 || hour === 0) return 1; // 子
  // 1-2 → 丑(2),3-4 → 寅(3),...,21-22 → 亥(12)
  return Math.floor((hour + 1) / 2) + 1;
}

/** 從西元年得地支(年地支 1..12)。 */
function yearToZhi(year: number): number {
  // 西元 4 年是甲子(年地支 = 子 = 1),所以 (year - 4) mod 12 + 1
  const v = ((year - 4) % 12 + 12) % 12;
  return v + 1;
}

export interface PlumBlossomCast {
  upperNum: number;        // 1..8(先天八卦序)
  lowerNum: number;        // 1..8
  changingLineIdx: number; // 0..5(陣列索引;傳統「動爻」是 1..6,我們存索引)
  yearZhi: number;         // 1..12
  month: number;           // 1..12(公曆)
  day: number;             // 1..31(公曆)
  shichen: number;         // 1..12
}

export interface PlumBlossomResult {
  cast: PlumBlossomCast;
  primaryLines: number[];     // 6 lines, BTT
  changingLines: number[];    // [動爻索引]
  relatingLines: number[];    // 變後的 6 lines
  primaryHex: Hexagram;
  relatingHex: Hexagram;
  upperTrigramCode: string;   // "111" 之類
  lowerTrigramCode: string;
}

/**
 * 用 server-side 當下時間起卦。
 *
 * 注意:server 跟 user 可能在不同時區。為了讓「同一個使用者瞬間連按起卦」
 * 不會卡在同一秒得到同卦(年月日時都一樣 → 算出同卦),
 * 我們允許呼叫端傳入 explicit Date — 客端可以用 user 自己的時間。
 */
export function castPlumBlossom(date: Date = new Date()): PlumBlossomResult {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();

  const yearZhi = yearToZhi(year);
  const shichen = hourToShichen(hour);

  const sumUpper = yearZhi + month + day;
  const sumLower = yearZhi + month + day + shichen;

  let upperNum = sumUpper % 8;
  if (upperNum === 0) upperNum = 8;
  let lowerNum = sumLower % 8;
  if (lowerNum === 0) lowerNum = 8;
  let changingLineNum = sumLower % 6;
  if (changingLineNum === 0) changingLineNum = 6;
  // 傳統動爻 1..6(由下而上),轉成陣列索引 0..5
  const changingLineIdx = changingLineNum - 1;

  const upperCode = TRIGRAM_BY_NUM[upperNum];
  const lowerCode = TRIGRAM_BY_NUM[lowerNum];

  // 組成 6 爻陣列(BTT):lower bits 0..2,upper bits 0..2
  const primaryLines = [
    Number(lowerCode[0]),
    Number(lowerCode[1]),
    Number(lowerCode[2]),
    Number(upperCode[0]),
    Number(upperCode[1]),
    Number(upperCode[2]),
  ];

  // 變爻只有一條(梅花易數定義:取 mod 6 那一爻為動爻)
  const relatingLines = primaryLines.map((line, i) =>
    i === changingLineIdx ? (line === 1 ? 0 : 1) : line
  );

  const primaryHex = findHexagram(primaryLines);
  const relatingHex = findHexagram(relatingLines);
  if (!primaryHex || !relatingHex) {
    throw new Error("Could not resolve plum-blossom hexagram");
  }

  return {
    cast: {
      upperNum,
      lowerNum,
      changingLineIdx,
      yearZhi,
      month,
      day,
      shichen,
    },
    primaryLines,
    changingLines: [changingLineIdx],
    relatingLines,
    primaryHex,
    relatingHex,
    upperTrigramCode: upperCode,
    lowerTrigramCode: lowerCode,
  };
}
