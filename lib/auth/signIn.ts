/**
 * 集中所有登入呼叫 —— LoginOptionsModal / AuthButton / handleLoginForShare 都走這支。
 *
 * 設計:
 * - OAuth provider 統一走 signInWithOAuth,Supabase 後台沒啟用的會在 redirect 回來時
 *   在 URL 帶 `?error=...`,我們讓呼叫端用 try/catch 抓 client-side error message。
 * - Line 不是 Supabase 標準 provider(只有 Pro plan 接 Custom OIDC 才能開),
 *   這邊先用 `as "line"` 繞過 TS,實際跑起來若未開會收到 Supabase 400,
 *   由 UI 統一顯示「此登入方式尚未開通」。
 * - Email magic link 用 signInWithOtp({email})。Supabase 內建,無需額外設定。
 * - redirectTo 統一用 `/api/auth/callback`,PKCE code 由既有 route handler 換 session。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// 對外:能跑 OAuth 的 provider 集合(Line 目前可能沒開,UI 會標示)
export type SocialProvider = "google" | "apple" | "facebook" | "line";

// Supabase 實際吃的字串 —— line 不是 TS 型別內的合法值,用字串傳
type OAuthProviderString = "google" | "apple" | "facebook" | "line";

export interface SignInOptions {
  /** 登入成功後 callback 再 redirect 的目的地,預設 "/" */
  next?: string;
}

function buildRedirectTo(nextPath: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : ""; // SSR 呼叫不應該發生,server action 會自己處理
  const url = new URL(`${base}/api/auth/callback`);
  if (nextPath && nextPath !== "/") url.searchParams.set("next", nextPath);
  return url.toString();
}

/**
 * OAuth(Google / Apple / Line 共用)。失敗時拋例外,呼叫端顯示錯誤。
 *
 * 注意 Supabase OAuth 成功路徑會 full-page redirect 去 provider,不會 return。
 * 拋例外只在「Supabase client 拒發請求」—— 通常是 provider 尚未啟用。
 */
export async function signInWithSocial(
  provider: SocialProvider,
  options: SignInOptions = {}
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient() as SupabaseClient;
  const redirectTo = buildRedirectTo(options.next ?? "/");

  // line 不在 TS 聯集裡,這邊用 as 繞;若 Supabase 後台沒啟 line,
  // 下一步 Supabase 會回 AuthError { status: 400, message: "Unsupported provider..." }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider as unknown as "google",
    options: {
      redirectTo,
      // Apple 常見 bug:email 預設不會回傳,要明確 scope
      ...(provider === "apple" ? { scopes: "email name" } : {}),
    },
  });

  if (error) {
    // 把 Supabase 的英文錯誤轉成友善訊息,UI 直接丟這個字串到 toast/alert
    throw new Error(mapOAuthError(provider, error.message));
  }
}

/** Email magic link —— Supabase 直接寄信,使用者點信裡連結就回 callback route。 */
export async function signInWithEmailMagicLink(
  email: string,
  options: SignInOptions = {}
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient() as SupabaseClient;
  const emailRedirectTo = buildRedirectTo(options.next ?? "/");

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo,
      // shouldCreateUser: true(預設)—— 新 email 會自動建帳號
    },
  });

  if (error) {
    throw new Error(`寄送登入連結失敗:${error.message}`);
  }
}

/**
 * 把使用者目前的 session 另外綁一個 provider identity。
 * 需要 Supabase-js ≥2.40,支援 MFA-style 的 linkIdentity。
 * 登入狀態下才能呼叫;未登入直接呼叫 signInWithSocial。
 */
export async function linkIdentity(
  provider: SocialProvider,
  options: SignInOptions = {}
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient() as SupabaseClient;
  const redirectTo = buildRedirectTo(options.next ?? "/account/linked");

  const { error } = await supabase.auth.linkIdentity({
    provider: provider as unknown as "google",
    options: {
      redirectTo,
      ...(provider === "apple" ? { scopes: "email name" } : {}),
    },
  });

  if (error) {
    throw new Error(mapOAuthError(provider, error.message));
  }
}

/** 解除綁定某個 identity(user 必須還剩至少一個 identity,不然會變孤兒帳號)。 */
export async function unlinkIdentity(identityId: string): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient() as SupabaseClient;

  const { data: identitiesData, error: listErr } =
    await supabase.auth.getUserIdentities();
  if (listErr) throw new Error(`無法讀取帳號綁定:${listErr.message}`);

  const target = identitiesData.identities.find(
    (i) => i.identity_id === identityId
  );
  if (!target) throw new Error("找不到要解綁的登入方式");

  if (identitiesData.identities.length <= 1) {
    throw new Error(
      "至少要保留一種登入方式,無法解綁最後一個。請先綁定其他方式。"
    );
  }

  const { error } = await supabase.auth.unlinkIdentity(target);
  if (error) throw new Error(`解綁失敗:${error.message}`);
}

function mapOAuthError(provider: SocialProvider, raw: string): string {
  const p =
    provider === "google"
      ? "Google"
      : provider === "apple"
        ? "Apple"
        : provider === "facebook"
          ? "Facebook"
          : "LINE";
  // Supabase 常見關鍵字
  if (/unsupported provider|disabled|not enabled/i.test(raw)) {
    return `${p} 登入尚未開通,請稍候或改用其他登入方式`;
  }
  if (/network|failed to fetch/i.test(raw)) {
    return `網路連線異常,請稍後再試`;
  }
  return `${p} 登入失敗:${raw}`;
}
