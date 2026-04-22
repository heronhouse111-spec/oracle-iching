"use client";

/**
 * useCurrency —— 前端幣別狀態管理。
 *
 * 偵測優先序(mount effect 跑一次):
 *   1. localStorage `oracle_currency_override`(使用者手動切換過)
 *   2. cookie `oracle_country`(middleware 從 Vercel geo header 寫入),
 *      map 成幣別(TW → TWD, 其他 → USD)
 *   3. navigator.language 粗略判斷(本地開發沒 geo cookie 時的 fallback)
 *   4. 預設 USD
 *
 * SSR:首次渲染固定回 "TWD"(因為台灣主市場,閃動視覺可接受,跟 LanguageContext
 * 的 "zh" 預設同思路)。mount 後 effect 校正。
 *
 * 手動切換:setCurrency() 同時寫 localStorage + 寫 cookie(讓下次 SSR 跟上)。
 */

import { useCallback, useEffect, useState } from "react";
import type { Currency } from "@/lib/pricing";
import {
  CURRENCY_OVERRIDE_KEY,
  GEO_COOKIE,
  countryToCurrency,
  isValidCurrency,
} from "./country";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365; // 1 年
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax` +
    (secure ? "; Secure" : "");
}

function detectFromBrowser(): Currency {
  if (typeof navigator === "undefined") return "TWD";
  const langs =
    (navigator.languages && [...navigator.languages]) ||
    (navigator.language ? [navigator.language] : []);
  for (const raw of langs) {
    const lang = raw.toLowerCase();
    if (lang.startsWith("zh-tw") || lang.startsWith("zh-hant")) return "TWD";
  }
  return "USD";
}

export interface UseCurrencyResult {
  currency: Currency;
  /** 是否為自動偵測(而非使用者手動選擇)—— 用來在 UI 顯示「auto」提示 */
  autoDetected: boolean;
  setCurrency: (c: Currency) => void;
  /** 清除手動覆寫,回到自動偵測 */
  clearOverride: () => void;
}

/**
 * 跨 hook-instance 同步用的 custom event。
 *
 * 為何需要:多個 component 各自 call useCurrency() 時,每個 useState 是獨立的。
 * 在 A component 按切換,B component 不會重新 render,要等頁面 reload 重新讀
 * localStorage 才更新。用 window event 讓所有 instance 都能收到變更通知。
 *
 * - 同 tab 內:dispatch CurrencyChangeEvent
 * - 跨 tab:原生 storage event(localStorage 寫入會觸發其他 tab 的 storage event)
 */
const CURRENCY_CHANGE_EVENT = "oracle:currency-change";

interface CurrencyChangeDetail {
  currency: Currency;
  autoDetected: boolean;
}

function broadcastCurrency(detail: CurrencyChangeDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CurrencyChangeDetail>(CURRENCY_CHANGE_EVENT, { detail })
  );
}

export function useCurrency(): UseCurrencyResult {
  // SSR 預設 TWD(台灣主市場),mount 後校正
  const [currency, setCurrencyState] = useState<Currency>("TWD");
  const [autoDetected, setAutoDetected] = useState(true);

  useEffect(() => {
    // ---- 初始化:依優先序偵測一次 ----
    const applyDetection = () => {
      // 1. localStorage 手動覆寫
      try {
        const override = localStorage.getItem(CURRENCY_OVERRIDE_KEY);
        if (isValidCurrency(override)) {
          setCurrencyState(override);
          setAutoDetected(false);
          return;
        }
      } catch {
        /* 無 localStorage */
      }

      // 2. middleware 的 geo cookie
      const country = readCookie(GEO_COOKIE);
      if (country) {
        setCurrencyState(countryToCurrency(country));
        setAutoDetected(true);
        return;
      }

      // 3. 瀏覽器語系粗判(本地開發 / 非 Vercel 部署的 fallback)
      setCurrencyState(detectFromBrowser());
      setAutoDetected(true);
    };

    applyDetection();

    // ---- 同 tab:聽 CurrencyChangeEvent(setCurrency / clearOverride 會 dispatch) ----
    const onChange = (e: Event) => {
      const ev = e as CustomEvent<CurrencyChangeDetail>;
      if (!ev.detail) return;
      setCurrencyState(ev.detail.currency);
      setAutoDetected(ev.detail.autoDetected);
    };

    // ---- 跨 tab:聽原生 storage event(不同 tab 改 localStorage 會觸發) ----
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CURRENCY_OVERRIDE_KEY) return;
      if (isValidCurrency(e.newValue)) {
        setCurrencyState(e.newValue);
        setAutoDetected(false);
      } else {
        // override 被清空 → 重跑偵測
        applyDetection();
      }
    };

    window.addEventListener(CURRENCY_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CURRENCY_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    setAutoDetected(false);
    try {
      localStorage.setItem(CURRENCY_OVERRIDE_KEY, c);
    } catch {
      /* ignore */
    }
    // 同時寫 cookie 讓下次 SSR / route handlers 看得到
    writeCookie(CURRENCY_OVERRIDE_KEY, c);
    // 通知其他 useCurrency instance
    broadcastCurrency({ currency: c, autoDetected: false });
  }, []);

  const clearOverride = useCallback(() => {
    try {
      localStorage.removeItem(CURRENCY_OVERRIDE_KEY);
    } catch {
      /* ignore */
    }
    writeCookie(CURRENCY_OVERRIDE_KEY, ""); // 立刻過期
    // 重新依偵測優先序
    const country = readCookie(GEO_COOKIE);
    const next = country ? countryToCurrency(country) : detectFromBrowser();
    setCurrencyState(next);
    setAutoDetected(true);
    broadcastCurrency({ currency: next, autoDetected: true });
  }, []);

  return { currency, autoDetected, setCurrency, clearOverride };
}
