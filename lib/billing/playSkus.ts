/**
 * Play Billing SKU 對照表
 *
 * 為什麼分開放這:
 *   - Play Store SKU IDs 是 Google 後台手動建的「字串標識」(e.g. orc.credits.pack200),
 *     跟我們程式裡的 internal id (pack_200 / monthly) 不是同一個東西
 *   - 兩端都會引用這個檔:
 *     * 前端(購買時):pack_id → SKU ID,呼叫 Digital Goods API
 *     * 後端(驗證時):SKU ID → 該補幾點 / 是哪個訂閱方案
 *
 * 改動規則:
 *   - 改 Play Console SKU ID 後,這裡同步改字串
 *   - 動到價格不要動這裡,動 lib/pricing.ts(Play Console 是另一邊)
 *   - 新增 SKU 兩個對照表都要加
 */

import type { CreditPackId, SubscriptionPlanId } from "@/lib/pricing";

// ---------- Credit packs ----------

/** 點數方案 SKU IDs(對應 Play Console In-app Products) */
export const CREDIT_PACK_SKUS: Record<CreditPackId, string> = {
  pack_200: "orc.credits.pack200",
  pack_500: "orc.credits.pack500",
  pack_1200: "orc.credits.pack1200",
};

/** 反向對照:SKU ID → 內部 pack id */
export const SKU_TO_CREDIT_PACK: Record<string, CreditPackId> = Object.fromEntries(
  Object.entries(CREDIT_PACK_SKUS).map(([packId, sku]) => [sku, packId as CreditPackId])
);

/**
 * SKU → 補多少點(含贈點)
 *
 * ⚠️ 這份金額**必須**跟 lib/pricing.ts 的 CREDIT_PACKS 一致,
 *   不然 Play Billing 跟 ECPay 的補點數字會對不上。
 *   修改時記得兩邊一起改。
 */
export const SKU_CREDITS_GRANTED: Record<string, number> = {
  "orc.credits.pack200": 200,    // 200 + 0 bonus
  "orc.credits.pack500": 550,    // 500 + 50 bonus
  "orc.credits.pack1200": 1400,  // 1200 + 200 bonus
};

// ---------- Subscriptions ----------

/**
 * 訂閱方案 SKU IDs(對應 Play Console Subscriptions)
 *
 * 注意:
 *   - Play Subscription 一個 product ID 底下可以有多個 base plan,
 *     我們約定 base plan ID = `${planId}-auto`(monthly-auto / yearly-auto)
 *   - lifetime 不再販售(pricing.ts UI 也已移除),所以這裡留空字串,
 *     呼叫端遇到 lifetime 不該觸發購買
 */
export const SUBSCRIPTION_SKUS: Record<SubscriptionPlanId, string> = {
  monthly: "orc.subscription.monthly",
  yearly: "orc.subscription.yearly",
  lifetime: "", // 不再販售,UI 不應呼叫到這個
};

/** 反向對照:SKU ID → 內部 plan id */
export const SKU_TO_SUBSCRIPTION_PLAN: Record<string, SubscriptionPlanId> = {
  "orc.subscription.monthly": "monthly",
  "orc.subscription.yearly": "yearly",
};

/** 是否為訂閱類 SKU(後端依此分流呼叫不同 Google API) */
export function isSubscriptionSku(sku: string): boolean {
  return sku in SKU_TO_SUBSCRIPTION_PLAN;
}

/** 是否為點數包 SKU */
export function isCreditPackSku(sku: string): boolean {
  return sku in SKU_TO_CREDIT_PACK;
}

/** 全部 SKU 字串(getDigitalGoodsService.getDetails 一次拉所有價格用) */
export const ALL_PLAY_SKUS: string[] = [
  ...Object.values(CREDIT_PACK_SKUS),
  ...Object.values(SUBSCRIPTION_SKUS).filter(Boolean),
];

/** Play Store 上架 package name(後端驗證時要傳給 Google API) */
export const PLAY_PACKAGE_NAME = "me.heronhouse.oracle";
