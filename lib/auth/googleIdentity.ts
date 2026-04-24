"use client";

/**
 * Google Identity Services (GSI) 共用載入器 + id_token → Supabase 交換邏輯。
 *
 * 兩個 consumer:
 *   - components/GoogleOneTap.tsx → 進站自動 prompt() 跳 One Tap 卡片
 *   - components/AuthButton.tsx   → 用 renderButton() 畫 Google 官方按鈕
 *
 * 兩邊共用同一個 callback(handleCredentialResponse),避免重複定義。
 * 關鍵:**都用 signInWithIdToken,完全不走 signInWithOAuth redirect**。
 * 舊的 redirect 流程會讓 Google 同意畫面顯示 "xpijubxjokrpysrpjrct.supabase.co",
 * id_token 流程留在 oracle.heronhouse.me 同一頁,不會跳離。
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleIdConfig {
  client_id: string;
  callback: (response: { credential: string }) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  use_fedcm_for_prompt?: boolean;
  context?: "signin" | "signup" | "use";
}

interface GoogleRenderButtonOptions {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          prompt: () => void;
          cancel: () => void;
          renderButton: (
            parent: HTMLElement,
            options: GoogleRenderButtonOptions
          ) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

let initPromise: Promise<void> | null = null;

async function handleCredentialResponse(response: { credential: string }) {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: response.credential,
    });
    if (error) {
      console.error("[GSI] signInWithIdToken 失敗:", error.message);
      return;
    }
    // reload 讓所有 auth-aware component(Header / CreditsBadge / page.tsx 等)
    // 一次拿到最新 session,不會 race
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  } catch (e) {
    console.error("[GSI] 例外:", e);
  }
}

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("SSR environment"));
      return;
    }
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    // Script 已在 DOM 但還沒 load → 掛 onload
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("GSI load error")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GSI script load failed"));
    document.head.appendChild(script);
  });
}

/**
 * 保證 GSI 已載入 + initialize() 已呼叫。多次呼叫只執行一次。
 */
export function ensureGsiInitialized(): Promise<void> {
  if (initPromise) return initPromise;
  if (!CLIENT_ID) {
    initPromise = Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID not set")
    );
    return initPromise;
  }
  initPromise = (async () => {
    await loadGsiScript();
    if (!window.google?.accounts?.id) {
      throw new Error("GSI object missing after script load");
    }
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID!,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      context: "signin",
    });
  })();
  return initPromise;
}

/** 跳出 One Tap 卡片。呼叫前確保 GSI 已初始化。 */
export async function promptOneTap(): Promise<void> {
  await ensureGsiInitialized();
  window.google!.accounts.id.prompt();
}

/** 把 Google 官方登入按鈕畫到指定 DOM 元素。 */
export async function renderGoogleButton(
  parent: HTMLElement,
  options: GoogleRenderButtonOptions = {}
): Promise<void> {
  await ensureGsiInitialized();
  window.google!.accounts.id.renderButton(parent, {
    type: "standard",
    theme: "filled_blue",
    size: "medium",
    text: "signin_with",
    shape: "pill",
    logo_alignment: "left",
    ...options,
  });
}

export const GSI_CLIENT_ID_CONFIGURED = !!CLIENT_ID;
