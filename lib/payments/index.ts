/**
 * Payment router —— 依幣別挑 provider。
 *
 * 使用範例:
 *   const provider = pickProvider(currency);
 *   const result = await provider.createCheckout({ ... });
 *   if (result.status === "ready") router.push(result.checkoutUrl);
 *   else if (result.status === "coming_soon") setModalState(result.reason);
 */

import type { Currency } from "@/lib/pricing";
import type { PaymentProvider } from "./provider";
import { ecpayProvider } from "./ecpay";
import { internationalProvider } from "./international";

export { ecpayProvider, internationalProvider };
export type {
  PaymentProvider,
  CheckoutRequest,
  CheckoutResult,
  CheckoutItem,
} from "./provider";

const ALL_PROVIDERS: PaymentProvider[] = [ecpayProvider, internationalProvider];

/**
 * 依幣別取對應 provider。
 * 找不到時回 internationalProvider 作為最保守的 fallback(至少會給 coming_soon 而不是炸)。
 */
export function pickProvider(currency: Currency): PaymentProvider {
  const match = ALL_PROVIDERS.find((p) => p.supports(currency));
  return match ?? internationalProvider;
}
