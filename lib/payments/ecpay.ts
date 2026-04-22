/**
 * ECPay(綠界)實作 —— TWD 專用。
 *
 * 目前階段 1:綠界帳號申請中,createCheckout 回傳 coming_soon。
 * 階段 2 綠界核可後,改成:
 *   1. POST /api/payments/ecpay/create 建訂單 + 回傳 checkout form URL
 *   2. 前端導向該 URL 填卡
 *   3. ECPay webhook → /api/payments/ecpay/webhook 更新訂單狀態 + 補點
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
