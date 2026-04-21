/**
 * 集中定價設定 —— 點數加購包 + 訂閱方案
 *
 * 未來接金流時,只要在這個檔案加 stripePriceId / ecpayItemCode 之類的欄位,
 * 不用動前端頁面。Phase C 目前只有前端 UI,按鈕會顯示「金流準備中」。
 *
 * 幣別:新台幣(TWD),前端顯示 NT$。
 */

export type CreditPackId = "pack_200" | "pack_500" | "pack_1200";

export interface CreditPack {
  id: CreditPackId;
  credits: number;
  bonusCredits: number; // 附贈,不列入「花錢買」那段,UI 上秀「+NN 贈」
  priceTwd: number;
  /** 標示是否為熱門選項(UI 會加外框特效) */
  highlighted?: boolean;
}

/**
 * 點數加購包(暫訂三階,之後可加 pack_3000 之類)
 * 2026-04-21:價格全面減半 → 微調 ×1.2。
 *
 * pack_200   :  NT$ 60,無贈
 * pack_500   :  NT$ 120,贈 50 (主推)
 * pack_1200  :  NT$ 240,贈 200
 */
export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_200", credits: 200, bonusCredits: 0, priceTwd: 60 },
  {
    id: "pack_500",
    credits: 500,
    bonusCredits: 50,
    priceTwd: 120,
    highlighted: true,
  },
  { id: "pack_1200", credits: 1200, bonusCredits: 200, priceTwd: 240 },
];

export type SubscriptionPlanId = "monthly" | "yearly" | "lifetime";

/**
 * 對應 Supabase schema profiles.subscription_plan enum。
 * 動這裡的 id 就要動 SQL!
 */
export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  priceTwd: number;
  /** 用來計算月單價顯示 —— 月=1、年=12、終身按 36 月攤 */
  amortizeMonths: number;
  /** 每期補點 —— lifetime 月補 */
  creditsPerPeriod: number;
  /** UI 顯示是否為推薦(主推那欄加外框 / badge) */
  highlighted?: boolean;
}

/**
 * 定價基準(2026-04-21 全面減半,移除終身方案):
 *  - 月訂閱 NT$ 150,每月補 600 點
 *  - 年訂閱 NT$ 1,440(= 120/月,省 20%),每月補 600 點
 *
 * 註:SubscriptionPlanId 型別仍保留 "lifetime" 以維持 Supabase schema
 * 相容性,但 UI 不再提供該方案。
 */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "monthly",
    priceTwd: 150,
    amortizeMonths: 1,
    creditsPerPeriod: 600,
  },
  {
    id: "yearly",
    priceTwd: 1440,
    amortizeMonths: 12,
    creditsPerPeriod: 600,
    highlighted: true,
  },
];

/** 訂閱戶共通權益清單 —— UI 上兩個方案共享,只差期數 */
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

/** Helper:TWD 千分位格式化 */
export function formatTwd(n: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(n);
}
