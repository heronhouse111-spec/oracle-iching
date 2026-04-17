/**
 * I Ching Divination Engine — Three-Coin Method (三枚銅錢法)
 *
 * Each throw: heads=3, tails=2. Sum of 3 coins:
 *   6 = old yin (changing yin → yang)
 *   7 = young yang (stable)
 *   8 = young yin (stable)
 *   9 = old yang (changing yang → yin)
 */

export interface CoinThrow {
  coins: [number, number, number];
  sum: number;
  lineType: "old_yin" | "young_yang" | "young_yin" | "old_yang";
  lineValue: 0 | 1;
  isChanging: boolean;
}

export interface DivinationResult {
  throws: CoinThrow[];
  primaryLines: number[];
  changingLines: number[];
  relatingLines: number[] | null;
}

function throwCoins(): CoinThrow {
  const coins: [number, number, number] = [
    Math.random() < 0.5 ? 2 : 3,
    Math.random() < 0.5 ? 2 : 3,
    Math.random() < 0.5 ? 2 : 3,
  ];
  const sum = coins[0] + coins[1] + coins[2];

  let lineType: CoinThrow["lineType"];
  let lineValue: 0 | 1;
  let isChanging: boolean;

  switch (sum) {
    case 6: lineType = "old_yin"; lineValue = 0; isChanging = true; break;
    case 7: lineType = "young_yang"; lineValue = 1; isChanging = false; break;
    case 8: lineType = "young_yin"; lineValue = 0; isChanging = false; break;
    case 9: lineType = "old_yang"; lineValue = 1; isChanging = true; break;
    default: throw new Error(`Invalid coin sum: ${sum}`);
  }

  return { coins, sum, lineType, lineValue, isChanging };
}

export function performDivination(): DivinationResult {
  const throws: CoinThrow[] = [];
  for (let i = 0; i < 6; i++) {
    throws.push(throwCoins());
  }

  const primaryLines = throws.map((t) => t.lineValue);
  const changingLines = throws
    .map((t, i) => (t.isChanging ? i : -1))
    .filter((i) => i !== -1);

  let relatingLines: number[] | null = null;
  if (changingLines.length > 0) {
    relatingLines = primaryLines.map((line, i) =>
      changingLines.includes(i) ? (line === 1 ? 0 : 1) : line
    );
  }

  return { throws, primaryLines, changingLines, relatingLines };
}

export interface QuestionCategory {
  id: string;
  nameZh: string;
  nameEn: string;
  icon: string;
  promptHintZh: string;
  promptHintEn: string;
}

export const questionCategories: QuestionCategory[] = [
  { id: "love", nameZh: "感情", nameEn: "Love", icon: "💕",
    promptHintZh: "關於感情、婚姻、人際關係方面", promptHintEn: "regarding love and relationships" },
  { id: "career", nameZh: "事業", nameEn: "Career", icon: "💼",
    promptHintZh: "關於工作、事業發展方面", promptHintEn: "regarding career and work" },
  { id: "wealth", nameZh: "財運", nameEn: "Wealth", icon: "💰",
    promptHintZh: "關於財運、投資方面", promptHintEn: "regarding wealth and finance" },
  { id: "health", nameZh: "健康", nameEn: "Health", icon: "🌿",
    promptHintZh: "關於身體健康方面", promptHintEn: "regarding health and wellness" },
  { id: "study", nameZh: "學業", nameEn: "Study", icon: "📚",
    promptHintZh: "關於學業、考試方面", promptHintEn: "regarding study and education" },
  { id: "general", nameZh: "綜合", nameEn: "General", icon: "🔮",
    promptHintZh: "關於一般性疑問", promptHintEn: "regarding a general question" },
];
