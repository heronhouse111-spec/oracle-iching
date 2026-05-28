/**
 * useIsNativeWrapper —— 偵測當前是否處於 native 殼內(iOS Capacitor / Android TWA)。
 *
 * 為什麼是 hook 不是直接呼叫 getPlatform():
 *   1. SSR 期間 window 不存在,getPlatform() 一律回 "web"。
 *      Component 直接用會造成「server render 是 web、client hydration 後變 ios/twa」的 mismatch。
 *      hook 內 useState + useEffect 處理:第一次 render 回 null,
 *      useEffect 後設成真實 platform,UI 就不會閃。
 *   2. 元件用起來語意清楚:`const platform = useIsNativeWrapper()`
 *
 * 三個變體:
 *   - useIsNativeWrapper()    → Platform | null      (給需要區分 ios / twa 的元件)
 *   - useIsInNativeShell()    → boolean              (只在乎「是不是 native」)
 *   - usePlatformLabel()      → "ios" | "twa" | "web" | "loading"  (給 debug / analytics)
 *
 * 與 lib/billing/playBilling.ts 的 isPlayBillingAvailable() 關係:
 *   isPlayBillingAvailable() 是「同步、不需 hook」的底層 API,給 lib code 用。
 *   這支 hook 是給 React component 用,多了 SSR 安全 + hydration 處理。
 *   兩者結論一致,只是使用情境不同。
 */

"use client";

import { useEffect, useState } from "react";
import { getPlatform, type Platform } from "@/lib/billing/platform";

/**
 * 取得當前 platform。SSR 期間 / hydration 完成前回 null。
 * UI 應該針對 null 顯示「中性內容」(不要假設是 web,也不要假設是 ios),
 * 真實值出來後再 render 對應分支。
 */
export function useIsNativeWrapper(): Platform | null {
  const [platform, setPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    setPlatform(getPlatform());
  }, []);

  return platform;
}

/** 是否處於 native 殼內(iOS / TWA 皆是);SSR/hydration 前回 false */
export function useIsInNativeShell(): boolean {
  const platform = useIsNativeWrapper();
  return platform === "ios" || platform === "twa";
}

/** 是否在 iOS Capacitor 內;SSR/hydration 前回 false */
export function useIsIos(): boolean {
  return useIsNativeWrapper() === "ios";
}

/** 是否在 Android TWA 內;SSR/hydration 前回 false */
export function useIsTwa(): boolean {
  return useIsNativeWrapper() === "twa";
}

/**
 * 給 debug overlay / analytics 用,固定回字串永不為 null。
 * hydration 前固定回 "loading"。
 */
export function usePlatformLabel(): "ios" | "twa" | "web" | "loading" {
  const platform = useIsNativeWrapper();
  return platform ?? "loading";
}
