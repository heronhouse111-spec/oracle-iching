"use client";

/**
 * useIsInAppBrowser — 偵測當前頁面是不是在社群 App 的內嵌 WebView 裡。
 *
 * 為何需要:
 *   Google 2021 年起實施「使用安全瀏覽器」政策,偵測到 OAuth 流程在
 *   LINE/Facebook/Instagram/Messenger 等 App 的內嵌 WebView 中執行時,
 *   直接回 403 `disallowed_useragent` 擋下登入。
 *   Supabase auth 靠 Google OAuth,所以這些 App 點進來的用戶全部卡死在登入頁。
 *
 *   偵測後要讓用戶有辦法跳出去(外部 Safari/Chrome),不然登入流程完全不可用。
 *
 * 偵測策略:
 *   以 navigator.userAgent 關鍵字白名單比對。各 App 的 UA 片段:
 *   - LINE:         `Line/`
 *   - Facebook:     `FBAN`, `FBAV`, `FB_IAB`
 *   - Messenger:    `FBAN/MessengerForiOS`, `FB_IAB/MESSENGER`(歸到 facebook)
 *   - Instagram:    `Instagram`
 *   - WeChat:       `MicroMessenger`
 *   - TikTok:       `Bytedance`, `BytedanceWebview`
 *   - Threads:      `Barcelona`(Threads iOS WebView 代號)
 *   - Notion / 等其他 in-app WebView 無獨特 UA,以 fallback 通用偵測處理
 *
 * 回傳:
 *   { isInApp, app }
 *   - isInApp:false 表示在正常瀏覽器(Safari/Chrome/Firefox/Edge 等)
 *   - app:偵測到的 App 識別碼,用於 UI 顯示不同指引(LINE 有 openExternalBrowser
 *     捷徑,其他 App 需要手動操作選單)
 *
 * SSR 行為:
 *   首次渲染回傳 { isInApp: false, app: null },useEffect 後才同步真實狀態,
 *   避免 hydration mismatch。
 */

import { useEffect, useState } from "react";

export type InAppBrowserApp =
  | "line"
  | "facebook"
  | "instagram"
  | "wechat"
  | "tiktok"
  | "threads"
  | "unknown";

export interface InAppBrowserState {
  isInApp: boolean;
  app: InAppBrowserApp | null;
}

const INITIAL: InAppBrowserState = { isInApp: false, app: null };

function detectApp(ua: string): InAppBrowserApp | null {
  // LINE — 最重要,因為有 openExternalBrowser 可以一鍵跳出
  if (/Line\//i.test(ua)) return "line";

  // Messenger 要放在 Facebook 前面偵測(兩者都有 FBAN),但我們統一歸 facebook
  // 因為 UI 指引都是「點右上角選單 → 在瀏覽器開啟」
  if (/FB_IAB\/MESSENGER|FBAN\/Messenger/i.test(ua)) return "facebook";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";

  // Instagram — 自家 App 內嵌瀏覽器
  if (/Instagram/i.test(ua)) return "instagram";

  // WeChat / 微信 — 中國大陸常見 in-app WebView
  if (/MicroMessenger/i.test(ua)) return "wechat";

  // TikTok 系列(Bytedance 出品,包括 TikTok、抖音、Lark 等)
  if (/Bytedance|BytedanceWebview|tiktok_webview/i.test(ua)) return "tiktok";

  // Threads iOS App 代號
  if (/Barcelona/i.test(ua)) return "threads";

  // Android WebView 通用偵測(包住 wv 或缺 Chrome/Safari 關鍵字等情況)
  // 有些自製 App WebView 不帶特徵,但 Google 不一定擋,我們不主動標 unknown
  // 避免誤判正常瀏覽器。保守做法:已知名單才標。

  return null;
}

function detect(): InAppBrowserState {
  if (typeof navigator === "undefined") return INITIAL;
  const app = detectApp(navigator.userAgent || "");
  return app ? { isInApp: true, app } : INITIAL;
}

/**
 * Client-only hook。SSR 首次渲染回傳 { isInApp: false, app: null },
 * mount 後才偵測並 setState。
 */
export function useIsInAppBrowser(): InAppBrowserState {
  const [state, setState] = useState<InAppBrowserState>(INITIAL);

  useEffect(() => {
    setState(detect());
  }, []);

  return state;
}

/**
 * LINE 專用:在目前 URL 加上 `?openExternalBrowser=1` 並觸發導航。
 * LINE 的內嵌瀏覽器偵測到這個 query param 會自動用系統預設瀏覽器開啟該 URL。
 * 這是 LINE 官方文件公開的機制:
 *   https://developers.line.biz/en/docs/line-login/line-url-scheme/
 *
 * 呼叫後使用者會離開 LINE 的內嵌瀏覽器,進到 Safari/Chrome,
 * OAuth 流程就不會被 Google 擋。
 */
export function openInExternalBrowserViaLine(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("openExternalBrowser", "1");
  window.location.href = url.toString();
}

/**
 * Imperative 版本(非 React)—— utility 層需要判斷時使用。
 * SSR 環境固定回傳 INITIAL。
 */
export function detectInAppBrowserSync(): InAppBrowserState {
  return detect();
}
