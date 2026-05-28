/**
 * Platform detection —— 找出當前執行環境屬於哪個「殼」。
 *
 * 為什麼:
 *   既有的 isPlayBillingAvailable() 只回 boolean,沒辦法區分:
 *     - "我在 web"
 *     - "我在 TWA"
 *     - "我在 iOS Capacitor"
 *   新增 iOS App 後我們同時需要這三種狀態(三條購買路徑)。
 *
 * 偵測順序:
 *   1. Capacitor (iOS / Android native) → 看 window.Capacitor.isNativePlatform()
 *   2. TWA (Chrome 注入 Digital Goods API) → 看 window.getDigitalGoodsService
 *   3. fallback → 'web'
 *
 * 為什麼 Capacitor 排第一:
 *   Capacitor iOS 內也是 WKWebView,理論上 getDigitalGoodsService 不會存在,
 *   但保險起見先 short-circuit 掉 native 環境,避免未來 Chrome / WebKit
 *   行為改變時誤判。
 *
 * 為什麼不直接看 navigator.userAgent:
 *   UA 在 TWA / Capacitor 內可以被偽造或被 Chrome / iOS 改寫,不可靠;
 *   兩邊 native bridge 的存在性才是 ground truth。
 *
 * SSR 注意:
 *   本檔所有 fn 都 guard typeof window === "undefined",server-side 一律回 "web"。
 *   client 第一次 render 在 hydration 前也會回 "web"(因為 useState 預設值),
 *   useIsNativeWrapper() hook 在 useEffect 內補正,避免 hydration mismatch。
 */

export type Platform = "web" | "twa" | "ios";

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string; // 'ios' | 'android' | 'web'
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
    /**
     * 重複宣告 getDigitalGoodsService(主要宣告在 lib/billing/playBilling.ts)。
     * TypeScript global augmentation 在同一個 project 內會自動 merge,重複宣告安全;
     * 在這裡也宣告是為了讓 platform.ts 自身可獨立通過 type check,
     * 不依賴 playBilling.ts 的 import 順序。
     */
    getDigitalGoodsService?: (paymentMethod: string) => Promise<unknown>;
  }
}

/**
 * 同步判斷當前 platform。可在 component render 內安全呼叫,
 * 但因為 SSR 一律回 "web",hydration 之後才會出現真實值。
 * 元件要避免「render 出來的內容跟 hydration 後不一樣」造成的 mismatch,
 * 請改用 `useIsNativeWrapper()` hook(內部已處理)。
 */
export function getPlatform(): Platform {
  if (typeof window === "undefined") return "web";

  // 1. Capacitor 優先(iOS / Android native shell)
  const cap = window.Capacitor;
  if (cap?.isNativePlatform?.()) {
    const native = cap.getPlatform?.();
    if (native === "ios") return "ios";
    // android Capacitor 目前我們沒在用(Android 走 TWA),但保留 fallback
    if (native === "android") return "twa";
  }

  // 2. TWA(Chrome 把 Digital Goods API 注進 WebView)
  if (typeof window.getDigitalGoodsService === "function") {
    return "twa";
  }

  // 3. 一般網頁
  return "web";
}

/** 是否處於某種 native 殼內(iOS Capacitor 或 Android TWA) */
export function isNativeWrapper(): boolean {
  const p = getPlatform();
  return p === "ios" || p === "twa";
}

/** 是否處於 iOS Capacitor 內 */
export function isIos(): boolean {
  return getPlatform() === "ios";
}

/** 是否處於 Android TWA 內 */
export function isTwa(): boolean {
  return getPlatform() === "twa";
}

/** 是否處於普通網頁瀏覽器(含 PWA「加入主畫面」狀態) */
export function isWeb(): boolean {
  return getPlatform() === "web";
}

/**
 * 顯示給 debug 用的環境字串。
 * 例:"ios capacitor 7.x" / "twa chrome" / "web"
 */
export function describePlatform(): string {
  if (typeof window === "undefined") return "ssr";
  const p = getPlatform();
  if (p === "ios") {
    return "ios capacitor";
  }
  if (p === "twa") {
    return "twa chrome";
  }
  // PWA installed?
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari 專有
    window.navigator.standalone === true;
  return standalone ? "web pwa-standalone" : "web";
}
