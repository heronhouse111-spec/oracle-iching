"use client";

/**
 * useIsTWA — 偵測當前載入環境是否為 Google Play 上架的 TWA 殼。
 *
 * 為何需要:
 *   Google Play 政策要求所有在 Play 商店散佈的 app,若涉及數位商品/服務購買,
 *   必須使用 Google Play Billing。我們的金流是綠界,無法 Play Billing 化。
 *   因此 **TWA 殼內必須完全不呈現 in-app purchase UI**。
 *   使用者看到的是「點數/訂閱請到網頁版」的靜態說明,不是可點的購買按鈕。
 *
 * 偵測策略(多層 fallback):
 *   1) sessionStorage 標記:一旦在這個 tab 偵測過,全程維持 TWA 模式
 *      (避免使用者切換 hash/route 時 query string 消失而誤判)
 *   2) URL query param `?source=twa`:來自 Bubblewrap manifest 的 start_url
 *   3) document.referrer 開頭 `android-app://`:TWA 進入頁有此 referrer
 *
 * 注意:
 *   - PWA (`?source=pwa`) 不算 TWA,金流仍可開(Play Billing 不管 PWA)
 *   - 這個 hook 必須用在 "use client" component 內,且偵測在 useEffect 裡跑,
 *     避免 SSR hydration mismatch。SSR 首次渲染固定回傳 false。
 */

import { useEffect, useState } from "react";

const TWA_SESSION_KEY = "oracle_is_twa";
const TWA_SOURCE_VALUES = new Set(["twa", "android-app"]);

function detectTwa(): boolean {
  if (typeof window === "undefined") return false;

  // 1) sessionStorage —— 這個 tab 之前標記過
  try {
    if (window.sessionStorage.getItem(TWA_SESSION_KEY) === "1") return true;
  } catch {
    // sessionStorage 可能被關,繼續下一個偵測
  }

  // 2) Bubblewrap start_url 帶入的 source param
  try {
    const params = new URLSearchParams(window.location.search);
    if (TWA_SOURCE_VALUES.has(params.get("source") ?? "")) {
      try {
        window.sessionStorage.setItem(TWA_SESSION_KEY, "1");
      } catch {
        /* noop */
      }
      return true;
    }
  } catch {
    /* noop */
  }

  // 3) document.referrer 看 android-app://
  if (
    typeof document !== "undefined" &&
    document.referrer.startsWith("android-app://")
  ) {
    try {
      window.sessionStorage.setItem(TWA_SESSION_KEY, "1");
    } catch {
      /* noop */
    }
    return true;
  }

  return false;
}

/**
 * Client-only hook. SSR 期間固定回傳 false,mount 後才同步實際狀態。
 */
export function useIsTWA(): boolean {
  const [isTwa, setIsTwa] = useState(false);

  useEffect(() => {
    setIsTwa(detectTwa());
  }, []);

  return isTwa;
}

/**
 * Imperative 版本(非 React) —— 可用於 utility 層檢查。
 * 注意:在 SSR 環境會回傳 false。
 */
export function isTwaEnvironmentSync(): boolean {
  return detectTwa();
}
