/**
 * International provider placeholder —— USD 專用,階段 2 決定接 Paddle / Stripe 再填。
 *
 * 目前階段 1:一律回 coming_soon。前端顯示「國際支付即將推出」,提供 email 通知按鈕。
 *
 * 階段 2 建議:
 *   - Paddle(Merchant of Record,省全球稅務 / 歐洲 VAT / 美國 sales tax)
 *   - LemonSqueezy(同 Paddle,小廠價格親民)
 *   - Stripe(邀請制,申請到最好)
 */

import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
} from "./provider";
import type { Currency } from "@/lib/pricing";

export const internationalProvider: PaymentProvider = {
  id: "international_placeholder",

  supports(currency: Currency): boolean {
    return currency === "USD";
  },

  async createCheckout(_req: CheckoutRequest): Promise<CheckoutResult> {
    return {
      status: "coming_soon",
      reason: "international_pending",
    };
  },
};
