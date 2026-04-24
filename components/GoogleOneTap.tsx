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

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
