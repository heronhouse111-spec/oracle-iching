/**
 * Payment provider abstraction —— 階段 1 先搭好介面,階段 2 再填真實實作。
 *
 * 設計理由:
 *   - TWD 走綠界(ECPay),USD 走國際金流(Paddle / Stripe,未定)
 *   - 前端只呼叫 `createCheckout`,不關心底下是哪家
 *   - 加新金流 = 加新 implementation + 改 router,UI 一行不動
 */

import type { Currency, CreditPackId, SubscriptionPlanId } from "@/lib/pricing";

export type CheckoutItem =
  | { kind: "credit_pack"; id: CreditPackId }
  | { kind: "subscription"; id: SubscriptionPlanId };

export interface CheckoutRequest {
  /** Supabase user id —— 用於 webhook 回調時對帳 */
  userId: string;
  item: CheckoutItem;
  currency: Currency;
  /** 結帳完成 / 取消後的回跳頁 */
  successUrl: string;
  cancelUrl: string;
}

export type CheckoutResult =
  | {
      status: "ready";
      /** 導向這個 URL 進行結帳(綠界 checkout / Stripe session / Paddle overlay url) */
      checkoutUrl: string;
      /** 對應的訂單 id,供前端非同步輪詢狀態(可選) */
      orderId?: string;
    }
  | {
      status: "coming_soon";
      /** 為什麼還沒好,供前端顯示對應文案 */
      reason: "ecpay_pending" | "international_pending";
    }
  | {
      status: "error";
      message: string;
    };

export interface PaymentProvider {
  readonly id: string;
  /** 此 provider 是否支援指定幣別 */
  supports(currency: Currency): boolean;
  /** 建立結帳;目前階段 1 全部回 coming_soon */
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
}
