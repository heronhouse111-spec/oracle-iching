/**
 * 統一入口 —— 依當前 platform 分流到 Play Billing / Apple IAP / Web checkout。
 *
 * 為什麼要這層:
 *   UI 元件不應該知道「現在是 ios 還是 twa 還是 web」。
 *   元件呼叫 purchaseCreditPack(packId),這層幫他選對的 native API,
 *   web 環境就 fallback 到 lib/payments 的 currency-based router。
 *
 * 對比之前架構:
 *   之前 /account/credits 頁面內可能有 if (isPlayBillingAvailable()) {...} else {...},
 *   多了 iOS 之後條件會爆炸。改成這層 dispatcher 後 UI 只剩:
 *     ```ts
 *     const result = await purchaseCreditPack({ packId, currency, userId, ... });
 *     ```
 *
 * 回傳形狀統一(看下方 `UnifiedPurchaseResult`),UI 不需要知道底下是哪家。
 */

import { getPlatform } from "./platform";
import * as playBilling from "./playBilling";
import * as appleIap from "./appleIap";
import { pickProvider } from "@/lib/payments";
import type { Currency, CreditPackId, SubscriptionPlanId } from "@/lib/pricing";
import type { CheckoutResult } from "@/lib/payments";

// Re-export 給上層方便 import
export { getPlatform, isNativeWrapper, isIos, isTwa, isWeb } from "./platform";

// ---------- 統一回傳形狀 ----------

export type UnifiedPurchaseResult =
  | {
      /** Native IAP 完成,後端已經補點/開訂閱 */
      status: "ok_native";
      platform: "twa" | "ios";
    }
  | {
      /** Web checkout,要把使用者導到外部結帳 URL */
      status: "redirect_web";
      checkoutUrl: string;
      orderId?: string;
    }
  | {
      /** Web checkout 還沒整合好 */
      status: "coming_soon";
      reason: "ecpay_pending" | "international_pending";
    }
  | {
      status: "user_canceled";
      platform: "twa" | "ios";
    }
  | {
      status: "error";
      message: string;
      /** 來源 platform,給 telemetry 用 */
      platform: "twa" | "ios" | "web";
    };

interface PurchaseCreditPackOpts {
  packId: CreditPackId;
  currency: Currency;
  /** 只有 web 路徑需要(打進 ECPay / Stripe checkout request);native 路徑會從 cookie 自動帶 */
  userId?: string;
  /** Web 結帳後跳轉的成功頁 */
  successUrl?: string;
  /** Web 結帳後跳轉的取消頁 */
  cancelUrl?: string;
}

interface PurchaseSubscriptionOpts {
  planId: SubscriptionPlanId;
  currency: Currency;
  userId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

// ---------- 點數包 ----------

export async function purchaseCreditPack(
  opts: PurchaseCreditPackOpts
): Promise<UnifiedPurchaseResult> {
  const platform = getPlatform();

  if (platform === "twa") {
    const result = await playBilling.purchaseCreditPack(opts.packId);
    return mapPlayResult(result, "twa");
  }

  if (platform === "ios") {
    const result = await appleIap.purchaseCreditPack(opts.packId);
    return mapAppleResult(result, "ios");
  }

  // Web checkout 路徑
  return webCheckout({
    item: { kind: "credit_pack", id: opts.packId },
    currency: opts.currency,
    userId: opts.userId,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
  });
}

// ---------- 訂閱 ----------

export async function purchaseSubscription(
  opts: PurchaseSubscriptionOpts
): Promise<UnifiedPurchaseResult> {
  const platform = getPlatform();

  if (platform === "twa") {
    const result = await playBilling.purchaseSubscription(opts.planId);
    return mapPlayResult(result, "twa");
  }

  if (platform === "ios") {
    const result = await appleIap.purchaseSubscription(opts.planId);
    return mapAppleResult(result, "ios");
  }

  return webCheckout({
    item: { kind: "subscription", id: opts.planId },
    currency: opts.currency,
    userId: opts.userId,
    successUrl: opts.successUrl,
    cancelUrl: opts.cancelUrl,
  });
}

// ---------- Restore (Apple-only,但 UI 可以無腦呼叫,非 iOS 自動 no-op) ----------

export async function restoreNativePurchases(): Promise<{
  ok: boolean;
  restored: number;
  error?: string;
}> {
  const platform = getPlatform();
  if (platform !== "ios") {
    return { ok: true, restored: 0 };
  }
  return appleIap.restorePurchases();
}

// ---------- 內部:轉接器 ----------

function mapPlayResult(
  result: playBilling.PurchaseResult,
  platform: "twa"
): UnifiedPurchaseResult {
  if (result.ok) {
    return { status: "ok_native", platform };
  }
  if (result.code === "user_canceled") {
    return { status: "user_canceled", platform };
  }
  return { status: "error", message: result.error, platform };
}

function mapAppleResult(
  result: appleIap.ApplePurchaseResult,
  platform: "ios"
): UnifiedPurchaseResult {
  if (result.ok) {
    return { status: "ok_native", platform };
  }
  if (result.code === "user_canceled") {
    return { status: "user_canceled", platform };
  }
  return { status: "error", message: result.error, platform };
}

async function webCheckout(opts: {
  item: { kind: "credit_pack"; id: CreditPackId } | { kind: "subscription"; id: SubscriptionPlanId };
  currency: Currency;
  userId?: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<UnifiedPurchaseResult> {
  if (!opts.userId) {
    return {
      status: "error",
      message: "userId required for web checkout",
      platform: "web",
    };
  }

  const provider = pickProvider(opts.currency);
  const result: CheckoutResult = await provider.createCheckout({
    userId: opts.userId,
    item: opts.item,
    currency: opts.currency,
    successUrl: opts.successUrl ?? "/account/credits?status=success",
    cancelUrl: opts.cancelUrl ?? "/account/credits?status=cancel",
  });

  if (result.status === "ready") {
    return {
      status: "redirect_web",
      checkoutUrl: result.checkoutUrl,
      orderId: result.orderId,
    };
  }
  if (result.status === "coming_soon") {
    return { status: "coming_soon", reason: result.reason };
  }
  return { status: "error", message: result.message, platform: "web" };
}
