/**
 * Server-side 幣別偵測 —— Next.js App Router server components / route handlers 用。
 *
 * 優先序:
 *   1. 使用者手動覆寫 cookie(oracle_currency_override)—— 透過 /api/currency 寫入
 *   2. Vercel geo 標頭 x-vercel-ip-country → countryToCurrency
 *   3. middleware 之前寫的 oracle_country cookie(fallback,當 /api/... 由其他前端呼叫時)
 *   4. 預設 USD
 */

import { headers, cookies } from "next/headers";
import type { Currency } from "@/lib/pricing";
import {
  GEO_COOKIE,
  CURRENCY_OVERRIDE_KEY,
  countryToCurrency,
  isValidCurrency,
} from "./country";

export async function detectServerCurrency(): Promise<Currency> {
  const cookieStore = await cookies();

  // 1. 使用者手動選擇
  const override = cookieStore.get(CURRENCY_OVERRIDE_KEY)?.value;
  if (isValidCurrency(override)) return override;

  // 2. Vercel geo header(最新鮮)
  const h = await headers();
  const geoCountry = h.get("x-vercel-ip-country");
  if (geoCountry) return countryToCurrency(geoCountry);

  // 3. middleware 先前存的 cookie
  const cookieCountry = cookieStore.get(GEO_COOKIE)?.value;
  if (cookieCountry) return countryToCurrency(cookieCountry);

  // 4. 預設
  return "USD";
}
