/**
 * Apple In-App Purchase Product IDs(App Store Connect 後台對照表)
 *
 * 設計概念跟 playSkus.ts 一樣:
 *   - 內部 id (pack_200 / monthly) ↔ Apple Product ID (me.heronhouse.tarogram.credits.pack200)
 *   - 兩端都會引用:
 *     * 前端(購買時):pack_id → Product ID,呼叫 native StoreKit
 *     * 後端(驗證時):Product ID → 該補幾點 / 是哪個訂閱方案
 *
 * Apple Product ID 命名規則:
 *   - 最長 255 字元,實務上 < 50
 *   - 允許 alphanumeric + dot + dash + underscore
 *   - 慣例使用 Bundle ID 為 prefix(雖然非強制),易於辨識
 *   - 一旦在 App Store Connect 後台「Submitted」過,**永久保留**不能再用
 *     (跟 Play Console 一樣的雷)
 *
 * 與 Play SKU 的關鍵差異:
 *   - Apple 一個 Product ID 對應一個產品(不像 Play subscription 一個 product
 *     底下可以多個 base plan,Apple 是一個 product = 一個方案)
 *   - 訂閱(auto-renewable)跟一次性購買(non-consumable / consumable)在 App Store
 *     Connect 後台是不同的「Type」,但前端 API 呼叫長一樣
 *   - 點數包請設成 **Consumable**(每次都能買、每次都能用完)
 *
 * 改動規則:
 *   - 改 App Store Connect Product ID 後,這裡同步改字串
 *   - 動到價格不要動這裡,動 App Store Connect(以 Apple 公告價格為準)
 *   - 新增 Product 兩個對照表都要加
 *
 * ⚠️ Reader App 模式 vs 完整 IAP:
 *   如果 Tarogram iOS 第一版走「Reader App 模式」(App 內完全不販售,使用者
 *   要充值請至網頁版),這個檔案會閒置但保留,以便未來轉成完整 IAP 時不用重做。
 *   實際是否啟用 IAP 由 components/NativePurchaseNotice.tsx 跟 /account/credits
 *   頁面內的 platform 判斷決定。
 */

import type { CreditPackId, SubscriptionPlanId } from "@/lib/pricing";

// ---------- Credit packs ----------

/**
 * 點數方案 Product IDs(對應 App Store Connect In-App Purchases)
 *
 * Apple 後台需登錄為 Type: **Consumable**(消耗型 — 買完點數立刻歸戶,不能恢復)
 *
 * ⚠️ 跟 Play SKU 命名不同的理由:Apple 慣例用 reverse-DNS,Play 慣例用 dot-snake。
 *   兩邊保持各自慣例,反正中間 mapping 都在這兩個檔。
 */
export const APPLE_CREDIT_PACK_PRODUCT_IDS: Record<CreditPackId, string> = {
  pack_100_starter: "me.heronhouse.tarogram.credits.pack100starter",
  pack_200: "me.heronhouse.tarogram.credits.pack200",
  pack_500: "me.heronhouse.tarogram.credits.pack500",
  pack_1200: "me.heronhouse.tarogram.credits.pack1200",
};

/** 反向對照:Product ID → 內部 pack id */
export const APPLE_PRODUCT_TO_CREDIT_PACK: Record<string, CreditPackId> = Object.fromEntries(
  Object.entries(APPLE_CREDIT_PACK_PRODUCT_IDS).map(([packId, pid]) => [
    pid,
    packId as CreditPackId,
  ])
);

/**
 * Product ID → 補多少點(含贈點)
 *
 * ⚠️ 這份金額**必須**跟 lib/pricing.ts 的 CREDIT_PACKS 一致,
 *   不然 Apple IAP 跟 Play Billing / ECPay 的補點數字會對不上。
 *   修改時三邊一起改。
 */
export const APPLE_PRODUCT_CREDITS_GRANTED: Record<string, number> = {
  "me.heronhouse.tarogram.credits.pack100starter": 130, // 100 + 30 bonus(firstTimeOnly)
  "me.heronhouse.tarogram.credits.pack200": 200,        // 200 + 0(不同於 Play 的 pack200v2,Apple 沒踩過誤刪雷)
  "me.heronhouse.tarogram.credits.pack500": 550,        // 500 + 50 bonus
  "me.heronhouse.tarogram.credits.pack1200": 1400,      // 1200 + 200 bonus
};

// ---------- Subscriptions ----------

/**
 * 訂閱方案 Product IDs(對應 App Store Connect Subscription Groups)
 *
 * Apple 後台需建立 **Subscription Group**(訂閱群組,讓不同訂閱方案互斥升降級),
 * 然後在群組內加 monthly / yearly 兩個 Auto-Renewable Subscription product。
 *
 * lifetime 不再販售(同 playSkus 處理)。
 */
export const APPLE_SUBSCRIPTION_PRODUCT_IDS: Record<SubscriptionPlanId, string> = {
  monthly: "me.heronhouse.tarogram.subscription.monthly",
  yearly: "me.heronhouse.tarogram.subscription.yearly",
  lifetime: "", // 不再販售,UI 不應呼叫到這個
};

/** 反向對照:Product ID → 內部 plan id */
export const APPLE_PRODUCT_TO_SUBSCRIPTION_PLAN: Record<string, SubscriptionPlanId> = {
  "me.heronhouse.tarogram.subscription.monthly": "monthly",
  "me.heronhouse.tarogram.subscription.yearly": "yearly",
};

/** 是否為訂閱類 Product(後端依此分流呼叫不同 App Store Server API) */
export function isAppleSubscriptionProduct(productId: string): boolean {
  return productId in APPLE_PRODUCT_TO_SUBSCRIPTION_PLAN;
}

/** 是否為點數包 Product */
export function isAppleCreditPackProduct(productId: string): boolean {
  return productId in APPLE_PRODUCT_TO_CREDIT_PACK;
}

/** 全部 Product IDs(購買前 batch 拉 product details 用) */
export const ALL_APPLE_PRODUCT_IDS: string[] = [
  ...Object.values(APPLE_CREDIT_PACK_PRODUCT_IDS),
  ...Object.values(APPLE_SUBSCRIPTION_PRODUCT_IDS).filter(Boolean),
];

/** App Store Bundle ID(後端 receipt 驗證時要對) */
export const APPLE_BUNDLE_ID = "me.heronhouse.tarogram";
