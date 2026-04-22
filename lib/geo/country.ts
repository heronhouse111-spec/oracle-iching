/**
 * Geo utilities —— country code ↔ currency 映射。
 *
 * 目前階段 1 規則簡單:TW → TWD,其他 → USD。
 * 未來若要加更多幣別(JPY、HKD、CNY、EUR 等)在這個檔案擴充就好,
 * 其他地方(middleware / useCurrency / pricing)都不必動。
 */

import type { Currency } from "@/lib/pricing";

export const GEO_COOKIE = "oracle_country";
export const CURRENCY_OVERRIDE_KEY = "oracle_currency_override";

/** ISO 3166-1 alpha-2 → 預設幣別 */
export function countryToCurrency(country: string | null | undefined): Currency {
  if (!country) return "USD";
  // 台灣用 TWD
  if (country.toUpperCase() === "TW") return "TWD";
  // 其他地區全部走 USD(下個階段再細分 JPY、HKD 等)
  return "USD";
}

/** 使用者可手動覆蓋的幣別合法值 */
export function isValidCurrency(v: unknown): v is Currency {
  return v === "TWD" || v === "USD";
}
