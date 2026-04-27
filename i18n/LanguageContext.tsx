"use client";

/**
 * 五語系 (繁中 / 簡中 / 英 / 日 / 韓) 語系管理。
 *
 * 設計取捨:
 * - `locale` 擴成 "zh" | "en" | "ja" | "ko" —— 既有的 `locale === "zh"` / `=== "en"` 比較全部相容。
 *   日韓暫不存進 Supabase divinations.locale(目前 schema 為 zh/en),API route 端會 narrow 成 en。
 * - 另加 `zhVariant: "TW" | "CN"` 控制字形變體,只在 locale === "zh" 時有意義。
 * - 簡中用 opencc-js (TW → CN) 即時轉換 t(zh, en) 的 zh 字串。
 *   lazy import —— 只有真的切到簡中才會下載 ~200KB 字典。
 * - 首訪自動偵測 navigator.languages;使用者手動切換後存 localStorage,
 *   下次訪問尊重手動選擇,不再自動覆蓋。
 * - t(zh, en, ja?, ko?):未提供 ja/ko 時 fallback 到 en — 翻譯可逐步補完,
 *   不必一次到位。
 *
 * SSR 注意:server 沒有 navigator,預設 locale="zh" + variant="TW" 以配合
 *   layout.tsx 的 <html lang="zh-Hant">。掛載後 effect 根據瀏覽器語系 / localStorage
 *   調整,初次 paint 可能會有一瞬閃動 —— 接受這個 tradeoff。
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";

export type Locale = "zh" | "en" | "ja" | "ko";
export type ZhVariant = "TW" | "CN";

interface LanguageContextType {
  locale: Locale;
  zhVariant: ZhVariant;
  /** 對外仍維持單一 setLocale,自動計算要不要改 zhVariant(例:外部傳 zh 時保留既有 variant) */
  setLocale: (locale: Locale) => void;
  setZhVariant: (v: ZhVariant) => void;
  /**
   * 5-way cycle: TW → CN → EN → JA → KO → TW
   * Header 用這支,不用關心底層 locale + variant 的關係。
   */
  cycleLocale: () => void;
  /** 目前是否為簡中(locale === "zh" && variant === "CN") */
  isSimplified: boolean;
  /**
   * t(zh, en, ja?, ko?):
   *   locale === "en" → en
   *   locale === "ja" → ja ?? en
   *   locale === "ko" → ko ?? en
   *   locale === "zh" + variant === "TW" → zh(原字串,繁體)
   *   locale === "zh" + variant === "CN" → 經 opencc-js 轉譯的簡體(尚未載入字典時先回原字串,載好自動重繪)
   */
  t: (zh: string, en: string, ja?: string, ko?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

const STORAGE_LOCALE = "preferred_locale"; // "zh" | "en" | "ja" | "ko"
const STORAGE_ZH_VARIANT = "preferred_zh_variant"; // "TW" | "CN"

/** 依 navigator.languages 推斷訪客預設語系。 */
function detectFromBrowser(): { locale: Locale; zhVariant: ZhVariant } {
  if (typeof navigator === "undefined") {
    return { locale: "zh", zhVariant: "TW" };
  }
  const prefs: string[] =
    (navigator.languages && [...navigator.languages]) ||
    (navigator.language ? [navigator.language] : []);
  for (const raw of prefs) {
    const lang = raw.toLowerCase();
    // 簡中圈:CN / SG / Hans
    if (
      lang.startsWith("zh-cn") ||
      lang.startsWith("zh-sg") ||
      lang.startsWith("zh-hans") ||
      lang === "zh-hans"
    ) {
      return { locale: "zh", zhVariant: "CN" };
    }
    // 繁中圈:TW / HK / MO / Hant / 泛 zh
    if (lang.startsWith("zh")) {
      return { locale: "zh", zhVariant: "TW" };
    }
    // 日文
    if (lang.startsWith("ja")) {
      return { locale: "ja", zhVariant: "TW" };
    }
    // 韓文
    if (lang.startsWith("ko")) {
      return { locale: "ko", zhVariant: "TW" };
    }
    // 英文圈
    if (lang.startsWith("en")) {
      return { locale: "en", zhVariant: "TW" };
    }
  }
  // 其餘 → 英文(服務全球使用者)
  return { locale: "en", zhVariant: "TW" };
}

/** document.documentElement.lang 同步,照 BCP-47 官方值給。 */
function htmlLangFor(locale: Locale, zhVariant: ZhVariant): string {
  if (locale === "en") return "en";
  if (locale === "ja") return "ja";
  if (locale === "ko") return "ko";
  return zhVariant === "CN" ? "zh-Hans" : "zh-Hant";
}

function isLocale(v: unknown): v is Locale {
  return v === "zh" || v === "en" || v === "ja" || v === "ko";
}

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // SSR 預設 zh + TW 對應 <html lang="zh-Hant">,mount 後 effect 校正
  const [locale, setLocaleState] = useState<Locale>("zh");
  const [zhVariant, setZhVariantState] = useState<ZhVariant>("TW");

  // 簡中轉換器(tw → cn)—— lazy import
  const [tw2cn, setTw2cn] = useState<((s: string) => string) | null>(null);

  // 轉換結果快取 —— OpenCC 對同一字串重複轉沒必要,render 熱路徑,值錢
  const cnCacheRef = useRef<Map<string, string>>(new Map());

  // ---- mount 時決定初始 locale ----
  useEffect(() => {
    try {
      const storedLocale = localStorage.getItem(STORAGE_LOCALE);
      const storedVariant = localStorage.getItem(
        STORAGE_ZH_VARIANT
      ) as ZhVariant | null;
      if (isLocale(storedLocale)) {
        setLocaleState(storedLocale);
        if (storedVariant === "TW" || storedVariant === "CN") {
          setZhVariantState(storedVariant);
        }
        return;
      }
    } catch {
      /* 無 localStorage 存取權,走自動偵測 */
    }
    // 沒有手動選過 → 按瀏覽器推斷
    const detected = detectFromBrowser();
    setLocaleState(detected.locale);
    setZhVariantState(detected.zhVariant);
  }, []);

  // ---- locale / variant 變動 → 同步 <html lang> + 持久化 ----
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = htmlLangFor(locale, zhVariant);
    }
  }, [locale, zhVariant]);

  // ---- 切到簡中 → lazy 載 opencc-js ----
  useEffect(() => {
    if (locale === "zh" && zhVariant === "CN" && !tw2cn) {
      let cancelled = false;
      (async () => {
        try {
          const mod = await import("opencc-js");
          if (cancelled) return;
          const conv = mod.Converter({ from: "tw", to: "cn" });
          cnCacheRef.current = new Map(); // 換 converter 就清快取
          setTw2cn(() => conv);
        } catch (e) {
          console.error("opencc-js 載入失敗,簡中暫以繁體顯示:", e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [locale, zhVariant, tw2cn]);

  // ---- 對外的 setter,一併寫回 localStorage ----
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_LOCALE, l);
    } catch {
      /* ignore */
    }
  }, []);

  const setZhVariant = useCallback((v: ZhVariant) => {
    setZhVariantState(v);
    try {
      localStorage.setItem(STORAGE_ZH_VARIANT, v);
    } catch {
      /* ignore */
    }
  }, []);

  // ---- 5-way cycle: TW → CN → EN → JA → KO → TW ----
  const cycleLocale = useCallback(() => {
    if (locale === "zh" && zhVariant === "TW") {
      setZhVariant("CN");
      // locale 保持 zh
    } else if (locale === "zh" && zhVariant === "CN") {
      setLocale("en");
    } else if (locale === "en") {
      setLocale("ja");
    } else if (locale === "ja") {
      setLocale("ko");
    } else {
      // ko → 繁體
      setLocale("zh");
      setZhVariant("TW");
    }
  }, [locale, zhVariant, setLocale, setZhVariant]);

  // ---- t(zh, en, ja?, ko?) ----
  const t = useCallback(
    (zh: string, en: string, ja?: string, ko?: string) => {
      if (locale === "en") return en;
      if (locale === "ja") return ja ?? en;
      if (locale === "ko") return ko ?? en;
      // locale === "zh"
      if (zhVariant === "TW") return zh;
      // variant === "CN"
      if (!tw2cn) return zh; // 字典未載,先顯示繁體占位
      const cache = cnCacheRef.current;
      const cached = cache.get(zh);
      if (cached !== undefined) return cached;
      const converted = tw2cn(zh);
      cache.set(zh, converted);
      return converted;
    },
    [locale, zhVariant, tw2cn]
  );

  const isSimplified = locale === "zh" && zhVariant === "CN";

  return (
    <LanguageContext.Provider
      value={{
        locale,
        zhVariant,
        setLocale,
        setZhVariant,
        cycleLocale,
        isSimplified,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
