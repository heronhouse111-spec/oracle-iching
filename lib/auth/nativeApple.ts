"use client";

/**
 * iOS 原生 Sign in with Apple。
 *
 * 為什麼需要:iOS Capacitor 的 WKWebView 跑 Apple 的「網頁版 OAuth」會開外部瀏覽器,
 * 登入完成後停在 Safari、不會跳回 App(使用者卡在網頁)。所以 iOS App 內改走「原生」
 * Sign in with Apple(透過 @capgo/capacitor-social-login),拿 idToken 後再用 Supabase
 * signInWithIdToken 換 session —— 跟 lib/auth/nativeGoogle.ts 同一套做法,全程留在 App。
 *
 * 前置:
 *   - Supabase Apple provider 的 Client IDs 需含 App Bundle ID me.heronhouse.tarogram
 *     (原生 Apple idToken 的 aud = bundle ID),並開啟 Skip nonce checks。
 *   - Xcode App target 需加「Sign in with Apple」能力(entitlement)。
 *
 * 只在 iOS Capacitor 內呼叫(由 LoginOptionsModal 以 isIos 判斷)。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  // 原生 iOS 用 ASAuthorization,綁定 App 的 Bundle ID,毋需額外 clientId。
  await SocialLogin.initialize({ apple: {} });
  initialized = true;
}

/**
 * 觸發原生 Apple 登入並用 idToken 建立 Supabase session。
 * 成功後不自動 reload —— 由呼叫端決定(LoginOptionsModal 會 reload)。
 * 失敗丟例外,呼叫端顯示錯誤。
 */
export async function signInWithNativeApple(): Promise<void> {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  await ensureInit();

  const res = await SocialLogin.login({
    provider: "apple",
    options: { scopes: ["email", "name"] },
  });

  if (res.provider !== "apple") {
    throw new Error("非預期的登入 provider");
  }
  const idToken = (res.result as { idToken?: string | null })?.idToken;
  if (!idToken) {
    throw new Error("Apple 未回傳 idToken");
  }

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient() as SupabaseClient;
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: idToken,
  });
  if (error) {
    throw new Error(`Apple 登入失敗:${error.message}`);
  }
}
