"use client";

import Script from "next/script";
import { useEffect, useState, useCallback } from "react";

/**
 * Google One Tap — 在 iPhone / Chrome / 桌機 Safari 都能「以 xxx 身份繼續」一鍵登入。
 *
 * 行為:
 *   1. 使用者進任何一頁,if 未登入 → 右上角(桌機)/ 上方 pill(手機)跳出 One Tap 卡片
 *   2. 使用者按下「繼續」→ Google 回傳 id_token → 用 Supabase signInWithIdToken 換 session
 *   3. 已登入則不跳(避免干擾)
 *
 * 跟舊的 signInWithOAuth redirect 流程並存 ── AuthButton 的「登入」按鈕仍走舊路徑當 fallback。
 * 使用者 dismiss 掉 One Tap 或環境不支援 → 還是可以按按鈕用傳統流程登入。
 *
 * 環境需求:
 *   - NEXT_PUBLIC_GOOGLE_CLIENT_ID env var(Vercel Production + .env.local)
 *   - Supabase Dashboard → Authentication → Providers → Google 有填同一個 Client ID
 *   - Google Cloud Console → OAuth client → 已授權的 JavaScript 來源 含
 *     https://oracle.heronhouse.me 跟 http://localhost:3000
 */

// ── Google Identity Services 型別(官方無 TS types,手動宣告最小介面) ──
interface GoogleIdConfig {
  client_id: string;
  callback: (response: { credential: string }) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  use_fedcm_for_prompt?: boolean;
  context?: "signin" | "signup" | "use";
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          prompt: () => void;
          cancel: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const isSupabaseConfigured = !!SUPABASE_URL && SUPABASE_URL !== "your_supabase_url_here";

export default function GoogleOneTap() {
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // 收到 id_token 後換 Supabase session
  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: response.credential,
        });
        if (error) {
          console.error("[GoogleOneTap] signInWithIdToken 失敗:", error.message);
          return;
        }
        // reload 讓所有掛在 onAuthStateChange 的地方(Header / CreditsBadge / page.tsx)
        // 一次拿到最新 session,不會 race
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      } catch (e) {
        console.error("[GoogleOneTap] 例外:", e);
      }
    },
    []
  );

  useEffect(() => {
    if (!scriptLoaded) return;
    if (!CLIENT_ID) return;
    if (!isSupabaseConfigured) return;
    if (typeof window === "undefined" || !window.google) return;

    let cancelled = false;

    (async () => {
      // 先問 Supabase「現在這人登入了嗎?」登入了就別再彈 One Tap
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) return;

      window.google!.accounts.id.initialize({
        client_id: CLIENT_ID!,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: false,
        // Chrome 128+ 要求用 FedCM 才能彈 prompt
        use_fedcm_for_prompt: true,
        context: "signin",
      });
      // 實際叫出 One Tap 卡片
      window.google!.accounts.id.prompt();
    })();

    return () => {
      cancelled = true;
    };
  }, [scriptLoaded, handleCredentialResponse]);

  // 沒設 CLIENT_ID 就整個 bail(開發期沒裝 env 不會噴錯)
  if (!CLIENT_ID) return null;

  return (
    <Script
      src="https://accounts.google.com/gsi/client"
      strategy="afterInteractive"
      onLoad={() => setScriptLoaded(true)}
    />
  );
}
