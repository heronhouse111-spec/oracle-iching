/**
 * Apple In-App Purchase client-side helper(只在 iOS Capacitor 殼內有意義)
 *
 * 跟 playBilling.ts 對照:
 *   playBilling.ts(TWA) ──── 用 Web 標準 API (Digital Goods + PaymentRequest),
 *                            Chrome 在 TWA 內自動橋接到 Android Play Billing。
 *   appleIap.ts(iOS) ────── iOS WKWebView 沒有對應 Web API,**必須**透過
 *                            Capacitor plugin 橋接到原生 StoreKit。
 *                            選用 @capgo/native-purchases(維護活躍、有 TS 型別)。
 *
 * 流程:
 *   1. NativePurchases.getProducts({ productIdentifiers: [...] }) 拿產品資訊
 *   2. NativePurchases.purchaseProduct({ productIdentifier }) 觸發 Apple 系統購買彈窗
 *   3. 拿到 transaction.receipt(base64 encoded App Store receipt)
 *   4. 打後端 /api/billing/apple/verify-purchase 用 App Store Server API 驗證
 *   5. 驗證通過後端補點,前端回 ok=true
 *
 * 為什麼後端要再驗一次:
 *   client 收到的 receipt 是 base64 字串,可以被偽造。
 *   後端拿同一個 receipt 打 Apple Server API(production / sandbox 兩個 endpoint),
 *   Apple 回傳「這 transaction 確實存在 + 對應的 product / quantity」才算數。
 *
 * 安裝步驟(本檔 import 之前要先做):
 *   ```
 *   cd ios-capacitor-app   # 或 oracle-iching 根目錄,看 Capacitor 怎麼設
 *   npm install @capgo/native-purchases
 *   npx cap sync ios
 *   ```
 *
 * 兼容性:
 *   - 一般網頁 / PWA → @capgo/native-purchases 的 NativePurchases 物件不存在
 *     → isAppleIapAvailable() 回 false → 所有 fn 安全回 null / 空陣列
 *   - Capacitor iOS 殼 → 完整可用
 *   - 模擬器:能跑購買流程但無法真扣款,需要在 App Store Connect 設定 sandbox tester 帳號
 *     才能完整測試
 *
 * 參考:
 *   https://github.com/Cap-go/native-purchases
 *   https://developer.apple.com/documentation/storekit/
 */

import {
  ALL_APPLE_PRODUCT_IDS,
  APPLE_CREDIT_PACK_PRODUCT_IDS,
  APPLE_SUBSCRIPTION_PRODUCT_IDS,
} from "./appleProducts";
import { isIos } from "./platform";
import type { CreditPackId, SubscriptionPlanId } from "@/lib/pricing";

// ---------- 型別(刻意跟 playBilling.ts 的 PlaySkuDetails 對齊,讓 UI 兩邊共用) ----------

export interface AppleProductDetails {
  /** Apple product identifier (e.g. "me.heronhouse.tarogram.credits.pack200") */
  productId: string;
  /** 顯示名稱(由 App Store Connect 後台 localization 提供) */
  title: string;
  /** 描述(同上) */
  description: string;
  /** 已格式化的價格字串,由 App Store 在地化 e.g. "NT$60" / "$1.99" */
  priceFormatted: string;
  /** 數值金額(以 micros 為單位,跟 playBilling 對齊) */
  priceMicros: number;
  /** ISO 4217 e.g. "TWD" / "USD" */
  currencyCode: string;
}

export type ApplePurchaseResult =
  | {
      ok: true;
      productId: string;
      /** App Store transaction receipt(base64 encoded);後端用這個打 Apple Server API 驗證 */
      receipt: string;
      transactionId: string;
    }
  | {
      ok: false;
      error: string;
      code?: "user_canceled" | "verify_failed" | "no_receipt" | "api_unavailable";
    };

// ---------- @capgo/native-purchases 介面(局部宣告,不需安裝 npm 就能編譯) ----------
// 真正執行時 import 用動態 import,確保非 iOS 環境下 bundler 不會 fail

interface NativePurchasesPlugin {
  getProducts(opts: {
    productIdentifiers: string[];
  }): Promise<{
    products: Array<{
      identifier: string;
      title?: string;
      description?: string;
      price?: number;
      priceString?: string;
      currencyCode?: string;
    }>;
  }>;
  purchaseProduct(opts: { productIdentifier: string }): Promise<{
    transactionId: string;
    productIdentifier: string;
    /** base64 encoded receipt */
    receipt?: string;
  }>;
  restorePurchases?(): Promise<{
    transactions: Array<{
      transactionId: string;
      productIdentifier: string;
      receipt?: string;
    }>;
  }>;
}

// ---------- 偵測 ----------

let cachedPlugin: NativePurchasesPlugin | null = null;
let pluginLoadAttempted = false;

/** 是否處於支援 Apple IAP 的環境(iOS Capacitor + plugin 已裝) */
export function isAppleIapAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (!isIos()) return false;
  // 嚴格判斷要等 plugin 動態載入完才知道,這裡先用 platform check 當快速 fast-path。
  // 真正執行 purchaseProduct 前會再 try-load plugin,失敗時 graceful degrade。
  return true;
}

async function loadPlugin(): Promise<NativePurchasesPlugin | null> {
  if (cachedPlugin) return cachedPlugin;
  if (pluginLoadAttempted) return null;
  pluginLoadAttempted = true;

  if (!isIos()) return null;

  try {
    // 用 string 變數繞 bundler 靜態分析,讓 web build 不會嘗試 resolve 這個 module
    const moduleName = "@capgo/native-purchases";
    const mod = (await import(/* webpackIgnore: true */ moduleName)) as {
      NativePurchases: NativePurchasesPlugin;
    };
    cachedPlugin = mod.NativePurchases;
    return cachedPlugin;
  } catch (e) {
    console.warn("[appleIap] failed to load @capgo/native-purchases:", e);
    return null;
  }
}

// ---------- 取 Product 詳細(主要給 UI 顯示在地化價格用) ----------

/**
 * 拉所有定義在 appleProducts.ts 的 Product 詳細資料(價格、名稱)。
 * 在非 iOS 環境會回 [],UI 應該 fallback 到 lib/pricing.ts 的硬編碼價格。
 *
 * 對照 playBilling.ts 的 fetchAllSkuDetails() — 故意取同樣的形狀。
 */
export async function fetchAllProductDetails(): Promise<AppleProductDetails[]> {
  const plugin = await loadPlugin();
  if (!plugin) return [];

  try {
    const result = await plugin.getProducts({
      productIdentifiers: ALL_APPLE_PRODUCT_IDS,
    });
    return result.products.map(toAppleProductDetails);
  } catch (e) {
    console.warn("[appleIap] getProducts failed:", e);
    return [];
  }
}

/** 同上,但只拉特定 Product IDs */
export async function fetchProductDetails(
  productIds: string[]
): Promise<AppleProductDetails[]> {
  const plugin = await loadPlugin();
  if (!plugin) return [];

  try {
    const result = await plugin.getProducts({ productIdentifiers: productIds });
    return result.products.map(toAppleProductDetails);
  } catch (e) {
    console.warn("[appleIap] getProducts failed:", e);
    return [];
  }
}

function toAppleProductDetails(p: {
  identifier: string;
  title?: string;
  description?: string;
  price?: number;
  priceString?: string;
  currencyCode?: string;
}): AppleProductDetails {
  const numeric = p.price ?? 0;
  const currency = p.currencyCode ?? "USD";

  let priceFormatted = p.priceString ?? "";
  if (!priceFormatted) {
    try {
      priceFormatted = new Intl.NumberFormat(navigator.language, {
        style: "currency",
        currency,
        minimumFractionDigits: currency === "TWD" || currency === "JPY" ? 0 : 2,
      }).format(numeric);
    } catch {
      priceFormatted = `${currency} ${numeric}`;
    }
  }

  return {
    productId: p.identifier,
    title: p.title ?? p.identifier,
    description: p.description ?? "",
    priceFormatted,
    priceMicros: Math.round(numeric * 1_000_000),
    currencyCode: currency,
  };
}

// ---------- 觸發購買 ----------

/**
 * 觸發 Apple IAP 購買流程(顯示 Apple 系統內建付款 UI)。
 * 流程結束後:
 *   - 成功:打 /api/billing/apple/verify-purchase 讓後端驗證,驗證通過才回 ok=true
 *   - 失敗 / 用戶取消:回 ok=false 帶 error code
 *
 * 對照 playBilling.ts 的 purchaseSku() — 故意取同樣的回傳形狀,
 * 讓 UI 層可以這樣寫:
 *   ```ts
 *   const result = platform === "ios" ? await purchaseProduct(...) : await purchaseSku(...);
 *   if (result.ok) showToast("購買成功");
 *   ```
 */
export async function purchaseProduct(
  productId: string
): Promise<ApplePurchaseResult> {
  const plugin = await loadPlugin();
  if (!plugin) {
    return {
      ok: false,
      error: "Apple IAP not available in this environment",
      code: "api_unavailable",
    };
  }

  let transaction: {
    transactionId: string;
    productIdentifier: string;
    receipt?: string;
  };

  try {
    transaction = await plugin.purchaseProduct({ productIdentifier: productId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // @capgo/native-purchases 在用戶取消會 throw,訊息常含 "cancel"
    if (msg.toLowerCase().includes("cancel")) {
      return {
        ok: false,
        error: "purchase canceled by user",
        code: "user_canceled",
      };
    }
    return { ok: false, error: msg };
  }

  if (!transaction.receipt) {
    return {
      ok: false,
      error: "no receipt in transaction",
      code: "no_receipt",
    };
  }

  // ---------- 後端驗證 ----------
  try {
    const verifyRes = await fetch("/api/billing/apple/verify-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        receipt: transaction.receipt,
        transactionId: transaction.transactionId,
      }),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      return {
        ok: false,
        error: err.error ?? `verify HTTP ${verifyRes.status}`,
        code: "verify_failed",
      };
    }

    return {
      ok: true,
      productId,
      receipt: transaction.receipt,
      transactionId: transaction.transactionId,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      code: "verify_failed",
    };
  }
}

// ---------- 便利包裝 ----------

export function getCreditPackProductId(packId: CreditPackId): string {
  return APPLE_CREDIT_PACK_PRODUCT_IDS[packId];
}

export function getSubscriptionProductId(planId: SubscriptionPlanId): string {
  return APPLE_SUBSCRIPTION_PRODUCT_IDS[planId];
}

/** 對應 pack_id 直接觸發購買 */
export function purchaseCreditPack(packId: CreditPackId): Promise<ApplePurchaseResult> {
  return purchaseProduct(APPLE_CREDIT_PACK_PRODUCT_IDS[packId]);
}

/** 對應 plan_id 直接觸發購買 */
export function purchaseSubscription(
  planId: SubscriptionPlanId
): Promise<ApplePurchaseResult> {
  const productId = APPLE_SUBSCRIPTION_PRODUCT_IDS[planId];
  if (!productId) {
    return Promise.resolve({
      ok: false,
      error: `subscription ${planId} 不販售或未配置 Product ID`,
    });
  }
  return purchaseProduct(productId);
}

// ---------- 恢復購買(訂閱專用,Apple 規定訂閱類 App 必須提供「Restore Purchases」按鈕) ----------

/**
 * 在新裝置或重灌後恢復已購買的訂閱(Apple Guideline 3.1.1 強制要求按鈕)。
 *
 * 流程:
 *   1. 呼叫 native StoreKit restorePurchases
 *   2. 拿到 transactions 列表
 *   3. 對每張 transaction 都打 /api/billing/apple/verify-purchase 重驗
 *
 * 點數包(consumable)Apple 不會恢復(設計如此 — consumable 用完就用完了);
 * 只有 subscription 跟 non-consumable 會回傳。
 */
export async function restorePurchases(): Promise<{
  ok: boolean;
  restored: number;
  error?: string;
}> {
  const plugin = await loadPlugin();
  if (!plugin?.restorePurchases) {
    return { ok: false, restored: 0, error: "restore API not available" };
  }

  try {
    const result = await plugin.restorePurchases();
    let restored = 0;
    for (const tx of result.transactions) {
      if (!tx.receipt) continue;
      try {
        const res = await fetch("/api/billing/apple/verify-purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: tx.productIdentifier,
            receipt: tx.receipt,
            transactionId: tx.transactionId,
            isRestore: true,
          }),
        });
        if (res.ok) restored += 1;
      } catch {
        // 個別 tx 失敗就跳過,不中斷整個 restore
      }
    }
    return { ok: true, restored };
  } catch (e) {
    return {
      ok: false,
      restored: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
