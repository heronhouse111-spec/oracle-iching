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

/**
 * UI 語系 → 預設幣別。
 *
 * 為什麼需要這支:
 *   - 中文(zh)用戶 99% 是台灣市場 → TWD
 *   - 英 / 日 / 韓 UI 的使用者就算物理上在台灣(TWA 殼會出現這情境),
 *     看到 "NT$150 / month" 會誤以為價格本身、認知落差大
 *   - useCurrency 在沒有 manual override 時優先採信 locale,
 *     不再讓 geo cookie 把英文 UI 強制變成 TWD
 *
 * 注意:這只決定 UI **顯示**的幣別。實際付款的幣別依路徑而異:
 *   - 網頁版(ECPay):一律 TWD,顯示 USD 只是「約等於」
 *   - TWA(Play Billing):Google 按使用者 Play 帳號國家決定,
 *     跟這個 helper 無關,使用者顯示 USD 但 Google 仍可能扣 TWD
 *     (詳見 lib/billing/playBilling.ts 的 fetchAllSkuDetails — 未來
 *      可改用 Play 回傳的 priceFormatted 取代本 helper 的結果)
 */
export function localeToCurrency(locale: string | null | undefined): Currency {
  if (!locale) return "USD";
  // 只有中文 locale 預設 TWD;其餘(en / ja / ko / 未知)走 USD
  return locale.toLowerCase().startsWith("zh") ? "TWD" : "USD";
}

/** 使用者可手動覆蓋的幣別合法值 */
export function isValidCurrency(v: unknown): v is Currency {
  return v === "TWD" || v === "USD";
}
