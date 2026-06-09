"use client";

/**
 * iOS 原生 Google 登入。
 *
 * 為什麼需要:iOS Capacitor 的 WKWebView 會擋網頁版 Google GSI / OAuth,
 * 所以 iOS App 內必須走「原生」Google Sign-In(透過 @capgo/capacitor-social-login),
 * 拿到 idToken 後,再用 Supabase 既有的 signInWithIdToken 換 session
 * (跟 lib/auth/googleIdentity.ts 的 web 流程殊途同歸)。
 *
 * 前置(已完成,見 APPLE_LOGIN_SETUP.md / task #12 紀錄):
 *   - Google Cloud(oracle-iching 專案)已建 iOS OAuth client(下方 IOS_GOOGLE_CLIENT_ID)
 *   - Info.plist 已加反轉 client ID 的 URL scheme
 *   - Supabase Google provider 已把此 iOS client ID 加進授權清單,並開啟 Skip nonce checks
 *
 * 只在 iOS Capacitor 內呼叫(由 LoginOptionsModal 以 isIos 判斷)。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// 公開識別碼(非密鑰)。Google Cloud → oracle-iching 專案 → OAuth iOS client。
const IOS_GOOGLE_CLIENT_ID =
  "437841841993-t93kf8ab5dakc97mouoeha0jte7c6m82.apps.googleusercontent.com";

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  await SocialLogin.initialize({ google: { iOSClientId: IOS_GOOGLE_CLIENT_ID } });
  initialized = true;
}

/**
 * 觸發原生 Google 登入並用 idToken 建立 Supabase session。
 * 成功後不會自己 reload —— 由呼叫端決定(LoginOptionsModal 會 reload 讓所有元件吃到新 session)。
 * 失敗會丟例外,呼叫端顯示錯誤。
 */
export async function signInWithNativeGoogle(): Promise<void> {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  await ensureInit();

  const res = await SocialLogin.login({
    provider: "google",
    options: { scopes: ["email", "profile"] },
  });

  if (res.provider !== "google") {
    throw new Error("非預期的登入 provider");
  }
  // online 模式回傳 idToken;以防 union 型別,做安全存取
  const idToken = (res.result as { idToken?: string | null })?.idToken;
  if (!idToken) {
    throw new Error("Google 未回傳 idToken(請確認 iOS client 設定)");
  }

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient() as SupabaseClient;
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) {
    throw new Error(`Google 登入失敗:${error.message}`);
  }
}
