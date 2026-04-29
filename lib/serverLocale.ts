/**
 * serverLocale.ts — server component 端讀使用者語系的對等實作.
 *
 * client 端 i18n/LanguageContext.tsx 把 locale 寫進 cookie ("locale" / "zh_variant"),
 * server component 用這支讀回來,並產出跟 client `t()` 同形狀的 helper。
 * 兩邊長相一致,呼叫端在 server / client 不必寫兩套。
 *
 * 注意:呼叫 cookies() 會把 page 標記成 dynamic — 接受這個 tradeoff:
 * 為了讓使用者只看到自己語言的字,不再 ZH+EN 並排,值得放棄這幾個百科頁的 SSG。
 * 真正會被 SEO 抓的內容(blog 等)沒走這支,還是 static.
 */

import { cookies } from "next/headers";

export type Locale = "zh" | "en" | "ja" | "ko";
export type ZhVariant = "TW" | "CN";

function isLocale(v: unknown): v is Locale {
  return v === "zh" || v === "en" || v === "ja" || v === "ko";
}

export async function getServerLocale(): Promise<{
  locale: Locale;
  zhVariant: ZhVariant;
}> {
  const c = await cookies();
  const locale = c.get("locale")?.value;
  const zhVariant = c.get("zh_variant")?.value;
  return {
    locale: isLocale(locale) ? locale : "zh",
    zhVariant: zhVariant === "CN" ? "CN" : "TW",
  };
}

/**
 * 跟 client 端 t(zh, en, ja?, ko?) 同 signature,差別:
 * 簡中變體不在 server 做轉換 — server 一律先回繁體,client hydrate 後若是
 * CN variant,opencc-js 會把畫面替換掉。Server 端去引 opencc-js 太重又只省
 * 一瞬間,不划算。
 */
export async function getServerT() {
  const { locale } = await getServerLocale();
  return (zh: string, en: string, ja?: string, ko?: string) => {
    if (locale === "en") return en;
    if (locale === "ja") return ja ?? en;
    if (locale === "ko") return ko ?? en;
    return zh;
  };
}

/**
 * Locale-aware string picker — 給 server component / generateMetadata 用,
 * 不必先 await getServerT()。傳 Locale + 4 個語系字串,回對應的字串(同樣的
 * fallback 規則:ja/ko 缺值 → en;zh 永遠回 zh,簡中等 client hydrate)。
 *
 * 用 nullish-tolerant 簽名(ja/ko 可能是 undefined / null / "")配合
 * data 檔的 *Ja?/*Ko? 欄位。
 */
export function pickByLocale(
  locale: Locale,
  zh: string,
  en: string,
  ja?: string | null,
  ko?: string | null
): string {
  if (locale === "en") return en;
  if (locale === "ja") return ja || en;
  if (locale === "ko") return ko || en;
  return zh;
}
