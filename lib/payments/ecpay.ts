/**
 * @deprecated 這支 stub 已被 hub-based 架構取代,實際的 ECPay 串接在:
 *   - app/api/billing/ecpay/checkout/route.ts  (建單,委派 pay.heronhouse.me hub)
 *   - app/api/billing/ecpay/granted/route.ts   (hub 回 callback,補點 / 啟用訂閱)
 *
 * 保留這支 + index.ts 的抽象介面是為了未來若要做不同 provider 路由(如 Paddle/Stripe)時
 * 仍有一致的 PaymentProvider 介面。但目前路由邏輯沒走這裡。
 */

import type {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
} from "./provider";
import type { Currency } from "@/lib/pricing";

export const ecpayProvider: PaymentProvider = {
  id: "ecpay",

  supports(currency: Currency): boolean {
    return currency === "TWD";
  },

  async createCheckout(_req: CheckoutRequest): Promise<CheckoutResult> {
    // TODO (階段 2): 真實 ECPay 整合
    // 1. 呼叫 /api/payments/ecpay/create 生成訂單 + MerchantTradeNo
    // 2. 回傳 checkoutUrl = 綠界的 AioCheckOut 頁
    return {
      status: "coming_soon",
      reason: "ecpay_pending",
    };
  },
};
