/**
 * Play Billing client-side helper(只在 TWA 殼內有意義)
 *
 * 概念:
 *   1. Play Billing 在 TWA 是透過 *web standard* 兩支 API 串接:
 *        - Digital Goods API     (window.getDigitalGoodsService)
 *            → 拿 SKU 詳細資料(價格 / 名稱 / 描述)
 *        - PaymentRequest API    (window.PaymentRequest)
 *            → 觸發購買 UI、拿到 purchaseToken
 *      兩支都是 TWA 內 Chrome 自動橋接到 Android Play Billing,Web 端 code 看起來像普通 web payment。
 *   2. 拿到 purchaseToken 後 *必須* 打後端 /api/billing/play/verify-purchase,
 *      讓伺服器跟 Google Play Developer API 驗證再補點。client 端的 token 不可信。
 *
 * 兼容性:
 *   - 一般網頁瀏覽器 → getDigitalGoodsService 不存在 → 全部 fn 回 null
 *   - PWA (?source=pwa) → 同上
 *   - TWA (?source=twa) → 完整可用
 *
 * 為什麼不用 npm 套件:
 *   Digital Goods API 是 Web 標準,不需要 lib;Bubblewrap 端用 trusted_web_activity 直接掛到 Play Billing。
 *
 * 參考:
 *   https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing
 */

import {
  ALL_PLAY_SKUS,
  CREDIT_PACK_SKUS,
  SUBSCRIPTION_SKUS,
} from "./playSkus";
import type { CreditPackId, SubscriptionPlanId } from "@/lib/pricing";

// ---------- 型別 ----------

export interface PlaySkuDetails {
  sku: string;
  title: string;
  description: string;
  /** 已格式化的價格字串(由 Play Store 在地化) e.g. "NT$60" / "$1.99" */
  priceFormatted: string;
  /** 數值金額(以 micros 為單位,例:NT$60 → 60_000_000) */
  priceMicros: number;
  /** ISO 4217 e.g. "TWD" / "USD" */
  currencyCode: string;
}

export type PurchaseResult =
  | { ok: true; sku: string; purchaseToken: string }
  | { ok: false; error: string; code?: "user_canceled" | "verify_failed" | "no_token" | "api_unavailable" };

// ---------- 偵測 ----------

interface DigitalGoodsService {
  getDetails(skus: string[]): Promise<RawSkuDetail[]>;
  listPurchases?(): Promise<RawPurchase[]>;
}

interface RawSkuDetail {
  itemId: string;
  title: string;
  description: string;
  price: { value: string; currency: string };
  type?: string; // 'product' or 'subscription'
}

interface RawPurchase {
  itemId: string;
  purchaseToken: string;
}

interface ChromePaymentResponse extends PaymentResponse {
  details: {
    purchaseToken?: string;
  };
}

declare global {
  interface Window {
    getDigitalGoodsService?: (
      paymentMethod: string
    ) => Promise<DigitalGoodsService>;
  }
}

const PLAY_BILLING_URL = "https://play.google.com/billing";

/** 是否處於支援 Play Billing 的環境(TWA + Chrome 內建橋接) */
export function isPlayBillingAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.getDigitalGoodsService === "function" &&
    "PaymentRequest" in window
  );
}

/** 取 service instance(會 cache) */
let cachedService: DigitalGoodsService | null = null;

async function getService(): Promise<DigitalGoodsService | null> {
  if (cachedService) return cachedService;
  if (!isPlayBillingAvailable()) return null;
  try {
    cachedService = await window.getDigitalGoodsService!(PLAY_BILLING_URL);
    return cachedService;
  } catch (e) {
    console.warn("[playBilling] getDigitalGoodsService failed:", e);
    return null;
  }
}

// ---------- 取 SKU 詳細(主要給 UI 顯示在地化價格用) ----------

/**
 * 拉所有定義在 playSkus.ts 的 SKU 詳細資料(價格、名稱)。
 * 在非 TWA 環境會回 [],UI 應該 fallback 到 lib/pricing.ts 的硬編碼價格。
 */
export async function fetchAllSkuDetails(): Promise<PlaySkuDetails[]> {
  const service = await getService();
  if (!service) return [];

  try {
    const raw = await service.getDetails(ALL_PLAY_SKUS);
    return raw.map(toPlaySkuDetails);
  } catch (e) {
    console.warn("[playBilling] getDetails failed:", e);
    return [];
  }
}

/** 同上,但只拉特定 SKU */
export async function fetchSkuDetails(
  skus: string[]
): Promise<PlaySkuDetails[]> {
  const service = await getService();
  if (!service) return [];

  try {
    const raw = await service.getDetails(skus);
    return raw.map(toPlaySkuDetails);
  } catch (e) {
    console.warn("[playBilling] getDetails failed:", e);
    return [];
  }
}

function toPlaySkuDetails(d: RawSkuDetail): PlaySkuDetails {
  const valueMicros = Number(d.price.value);
  // d.price.value 通常已經是「人類可讀」價格(例如 "60.00"),
  // 不過 Chrome 實作有時會給 micros 格式。我們用簡單啟發:
  //   value > 100000 推測是 micros(NT$60 → 60_000_000)
  //   反之是普通數字(60.00)
  const isMicros = valueMicros > 100000;
  const numeric = isMicros ? valueMicros / 1_000_000 : valueMicros;

  let priceFormatted: string;
  try {
    priceFormatted = new Intl.NumberFormat(navigator.language, {
      style: "currency",
      currency: d.price.currency,
      minimumFractionDigits: d.price.currency === "TWD" ? 0 : 2,
    }).format(numeric);
  } catch {
    priceFormatted = `${d.price.currency} ${numeric}`;
  }

  return {
    sku: d.itemId,
    title: d.title,
    description: d.description,
    priceFormatted,
    priceMicros: isMicros ? valueMicros : Math.round(numeric * 1_000_000),
    currencyCode: d.price.currency,
  };
}

// ---------- 觸發購買 ----------

/**
 * 觸發 Play Billing 購買流程(顯示 Google 內建付款 UI)。
 * 流程結束後:
 *   - 成功:打 /api/billing/play/verify-purchase 讓後端驗證,驗證通過才回 ok=true
 *   - 失敗 / 用戶取消:回 ok=false 帶 error code
 *
 * 呼叫前須 isPlayBillingAvailable() === true,否則直接回 api_unavailable。
 */
export async function purchaseSku(sku: string): Promise<PurchaseResult> {
  if (!isPlayBillingAvailable()) {
    return {
      ok: false,
      error: "Play Billing not available in this environment",
      code: "api_unavailable",
    };
  }

  let response: ChromePaymentResponse;
  try {
    const request = new PaymentRequest(
      [
        {
          supportedMethods: PLAY_BILLING_URL,
          data: { sku },
        },
      ],
      {
        // total 在 Play Billing 是「裝飾性」的,Google 用 SKU 自身價格
        total: {
          label: `Purchase ${sku}`,
          amount: { currency: "TWD", value: "0" },
        },
      }
    );
    response = (await request.show()) as ChromePaymentResponse;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 用戶按取消會 throw AbortError 或 NotAllowedError
    if (msg.includes("AbortError") || msg.includes("user closed")) {
      return { ok: false, error: "purchase canceled by user", code: "user_canceled" };
    }
    return { ok: false, error: msg };
  }

  const purchaseToken = response.details?.purchaseToken;
  if (!purchaseToken) {
    await response.complete("fail");
    return { ok: false, error: "no purchase token in response", code: "no_token" };
  }

  // ---------- 後端驗證 ----------
  try {
    const verifyRes = await fetch("/api/billing/play/verify-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, purchaseToken }),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      await response.complete("fail");
      return {
        ok: false,
        error: err.error ?? `verify HTTP ${verifyRes.status}`,
        code: "verify_failed",
      };
    }

    await response.complete("success");
    return { ok: true, sku, purchaseToken };
  } catch (e) {
    await response.complete("fail");
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      code: "verify_failed",
    };
  }
}

// ---------- 便利包裝 ----------

export function getCreditPackSku(packId: CreditPackId): string {
  return CREDIT_PACK_SKUS[packId];
}

export function getSubscriptionSku(planId: SubscriptionPlanId): string {
  return SUBSCRIPTION_SKUS[planId];
}

/** 對應 pack_id 直接觸發購買 */
export function purchaseCreditPack(packId: CreditPackId): Promise<PurchaseResult> {
  return purchaseSku(CREDIT_PACK_SKUS[packId]);
}

/** 對應 plan_id 直接觸發購買 */
export function purchaseSubscription(
  planId: SubscriptionPlanId
): Promise<PurchaseResult> {
  const sku = SUBSCRIPTION_SKUS[planId];
  if (!sku) {
    return Promise.resolve({
      ok: false,
      error: `subscription ${planId} 不販售或未配置 SKU`,
    });
  }
  return purchaseSku(sku);
}
