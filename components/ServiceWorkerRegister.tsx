"use client";

/**
 * 用途:註冊 /sw.js,讓站台被 Chrome / Android 判定為可安裝 PWA。
 * 沒有 UI,掛在 layout 一次即可。
 *
 * 注意:
 * - 開發環境(localhost)也註冊,方便 DevTools → Application → Manifest 看診斷。
 * - 瀏覽器不支援時安靜跳過,不報錯。
 */

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // 延遲到 load 之後,避免跟首屏 critical requests 搶頻寬
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // 註冊失敗不影響主要功能,僅 console 方便 debug
          console.warn("[sw] register failed:", err);
        });
    };

    if (document.readyState === "complete") {
      onLoad();
    } else {
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}
