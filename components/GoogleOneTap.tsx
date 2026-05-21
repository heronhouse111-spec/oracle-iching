"use client";

import { useEffect } from "react";
import {
  GSI_CLIENT_ID_CONFIGURED,
  promptOneTap,
} from "@/lib/auth/googleIdentity";

/**
 * Google One Tap — 進站後,if 未登入就自動跳「以 xxx 身份繼續」卡片。
 *
 * 邏輯全部集中到 lib/auth/googleIdentity.ts,這裡只負責「時機」:
 *   - mount → 先問 Supabase 是否已登入
 *   - 未登入 → 呼叫 promptOneTap()
 *   - 已登入 → 不干擾
 *
 * 跟 AuthButton 的 renderGoogleButton 共用同一個 GSI instance(經由 ensureGsiInitialized
 * 的 singleton 保證)。
 */
export default function GoogleOneTap() {
  useEffect(() => {
    if (!GSI_CLIENT_ID_CONFIGURED) return;

    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    // Defer 到 browser idle —— One Tap 是「漸進增強」(已登入者根本看不到),不該跟首頁
    // 一起競爭 main thread。idle 之前 dynamic import supabase client 跟 GSI script 都
    // 不會跑,給 hydration / first interaction 完整的優先權。
    // requestIdleCallback 沒有支援的瀏覽器(Safari < 18)走 setTimeout fallback。
    const ric =
      (window as typeof window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }).requestIdleCallback;

    const start = () => {
      if (cancelled) return;
      (async () => {
        // 有 env var(NEXT_PUBLIC_SUPABASE_URL)才去問 session;沒設就 bail
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!SUPABASE_URL || SUPABASE_URL === "your_supabase_url_here") return;

        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (cancelled) return;
          if (user) return;

          await promptOneTap();
        } catch (e) {
          console.warn("[GoogleOneTap] prompt 未成功:", e);
        }
      })();
    };

    if (typeof ric === "function") {
      // timeout 3 秒保底:就算 idle 一直沒到也最晚 3 秒後跑
      idleHandle = ric(start, { timeout: 3000 });
    } else {
      timeoutHandle = window.setTimeout(start, 1500);
    }

    return () => {
      cancelled = true;
      const cic = (window as typeof window & {
        cancelIdleCallback?: (handle: number) => void;
      }).cancelIdleCallback;
      if (idleHandle !== undefined && typeof cic === "function") cic(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, []);

  return null;
}
