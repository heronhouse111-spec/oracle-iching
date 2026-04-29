/**
 * 集中定價設定 —— 點數加購包 + 訂閱方案
 *
 * 多幣別支援(2026-04-22):
 *   - price: { TWD, USD } 每個方案同時提供兩種幣別
 *   - UI 根據 useCurrency() hook 選擇顯示
 *   - 付款路由:TWD → 綠界(階段 2 接)、USD → placeholder
 *
 * USD 定價策略不是直接換匯,而是參考 App Store / Play Store 慣用 .99 結尾,
 * 以「當地購買力」定價。手續費差(綠界 2-3% vs. 國際金流 3-5%)由 USD 略高吸收。
 */

export type Currency = "TWD" | "USD";

export interface Price {
  TWD: number;
  /** 可為小數(美元常見 .99 結尾),前端格式化時處理 */
  USD: number;
}

export type CreditPackId = "pack_200" | "pack_500" | "pack_1200";

export interface CreditPack {
  id: CreditPackId;
  credits: number;
  bonusCredits: number; // 附贈,不列入「花錢買」那段,UI 上秀「+NN 贈」
  price: Price;
  /** 標示是否為熱門選項(UI 會加外框特效) */
  highlighted?: boolean;
}

/**
 * 點數加購包(暫訂三階,之後可加 pack_3000 之類)
 *
 * TWD 基準:
 *   pack_200   :  NT$ 60,無贈
 *   pack_500   :  NT$ 120,贈 50 (主推)
 *   pack_1200  :  NT$ 240,贈 200
 *
 * USD 對價:
 *   pack_200   :  $1.99
 *   pack_500   :  $3.99 (主推)
 *   pack_1200  :  $7.99
 */
export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "pack_200",
    credits: 200,
    bonusCredits: 0,
    price: { TWD: 60, USD: 1.99 },
  },
  {
    id: "pack_500",
    credits: 500,
    bonusCredits: 50,
    price: { TWD: 120, USD: 3.99 },
    highlighted: true,
  },
  {
    id: "pack_1200",
    credits: 1200,
    bonusCredits: 200,
    price: { TWD: 240, USD: 7.99 },
  },
];

export type SubscriptionPlanId = "monthly" | "yearly" | "lifetime";

/**
 * 對應 Supabase schema profiles.subscription_plan enum。
 * 動這裡的 id 就要動 SQL!
 */
export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  price: Price;
  /** 用來計算月單價顯示 —— 月=1、年=12、終身按 36 月攤 */
  amortizeMonths: number;
  /** 每期補點 —— lifetime 月補 */
  creditsPerPeriod: number;
  /** UI 顯示是否為推薦(主推那欄加外框 / badge) */
  highlighted?: boolean;
}

/**
 * 定價基準:
 *   月訂閱 NT$ 150 / $4.99,每月補 600 點
 *   年訂閱 NT$ 1,440 / $49.99(折合 NT$ 120 / $4.17 / 月,年省 20%),每月補 600 點
 *
 * 註:SubscriptionPlanId 型別仍保留 "lifetime" 以維持 Supabase schema
 * 相容性,但 UI 不再提供該方案。
 */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "monthly",
    price: { TWD: 150, USD: 4.99 },
    amortizeMonths: 1,
    creditsPerPeriod: 600,
  },
  {
    id: "yearly",
    price: { TWD: 1440, USD: 49.99 },
    amortizeMonths: 12,
    creditsPerPeriod: 600,
    highlighted: true,
  },
];

/** 訂閱戶共通權益清單 —— UI 上兩個方案共享,只差期數。
 *  4 語系統一順序排好,view 端用 SUBSCRIPTION_BENEFITS[locale] 取對應陣列。 */
export const SUBSCRIPTION_BENEFITS_ZH: string[] = [
  "每月補 600 點",
  "完整占卜紀錄與衍伸占卜歷史",
  "塔羅、易經切換不受限",
  "詳細爻辭分析(訂閱戶專屬)",
  "分享圖無浮水印輸出",
  "選購開運物品 7 折優惠",
];

export const SUBSCRIPTION_BENEFITS_EN: string[] = [
  "600 credits refilled monthly",
  "Full divination history & follow-up threads",
  "Unlimited Tarot / I Ching switching",
  "Detailed yao analysis (subscribers only)",
  "Watermark-free share images",
  "30% off on lucky charm purchases",
];

export const SUBSCRIPTION_BENEFITS_JA: string[] = [
  "毎月 600 ポイント補充",
  "占い履歴とフォローアップ占いの全記録",
  "タロット / 易経の切り替え無制限",
  "爻辞の詳細分析(サブスク会員限定)",
  "透かしなしの共有画像",
  "開運グッズ購入 30% オフ",
];

export const SUBSCRIPTION_BENEFITS_KO: string[] = [
  "매월 600 포인트 충전",
  "점 기록과 후속 점 전체 보관",
  "타로 / 주역 무제한 전환",
  "효사 상세 분석(구독자 전용)",
  "워터마크 없는 공유 이미지",
  "행운 아이템 구매 30% 할인",
];

/** 統一語系入口 — 給 view import 用 */
export const SUBSCRIPTION_BENEFITS_BY_LOCALE: Record<
  "zh" | "en" | "ja" | "ko",
  string[]
> = {
  zh: SUBSCRIPTION_BENEFITS_ZH,
  en: SUBSCRIPTION_BENEFITS_EN,
  ja: SUBSCRIPTION_BENEFITS_JA,
  ko: SUBSCRIPTION_BENEFITS_KO,
};

/** Helper:取特定幣別的金額 */
export function priceOf(price: Price, currency: Currency): number {
  return price[currency];
}

/**
 * Helper:依幣別格式化金額。
 *   TWD → NT$120 (無小數)
 *   USD → $3.99 (固定兩位小數)
 */
export function formatPrice(amount: number, currency: Currency): string {
  if (currency === "TWD") {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  // USD
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** 便利函式:直接傳 Price + Currency 取格式化字串 */
export function formatPriceOf(price: Price, currency: Currency): string {
  return formatPrice(priceOf(price, currency), currency);
}

/**
 * @deprecated 保留舊名給漸進遷移,新 code 請用 formatPrice(amount, "TWD")。
 */
export function formatTwd(n: number): string {
  return formatPrice(n, "TWD");
}
