"use client";

/**
 * 合併其他帳號頁(/account/merge)
 *
 * 解決的問題:使用者用不同登入方式(Google / Apple)各自建了帳號、點數被切開。
 * 此頁把「另一個既有帳號 B」併入「目前登入的帳號 A」。設計見 ACCOUNT_MERGE_DESIGN.md。
 *
 * 核心難點 —— Supabase 瀏覽器端一次只有一個 session:
 *   登入 B 會把 A 的 session 蓋掉。所以流程是:
 *   1. 按鈕觸發前,把 A 的 session(access+refresh)暫存到 sessionStorage,設旗標
 *   2. signInWithOAuth(B) → 整頁跳轉到 provider → 回到本頁時已是 B 的 session
 *   3. 趁還是 B:讀 B 的 id / 點數 / 訂閱(RLS 允許讀自己),存進 state
 *   4. 用暫存的 A token 還原 A 的 session(B 的 access token 仍然有效,後端驗證用)
 *   5. 顯示預覽 + 訂閱衝突時讓使用者選保留哪份 → 確認(不可逆)
 *   6. POST /api/account/merge { sourceAccessToken: B_token, keepSubscription }
 *   7. 成功後把 B 的 provider 重新 link 到 A,讓之後用該方式登入會認得 A
 *
 * 注意:此功能由後端 ACCOUNT_MERGE_ENABLED 旗標控制,預設關閉,未測完不開放。
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import { linkIdentity } from "@/lib/auth/signIn";

const STASH_KEY = "merge_keep_session_v1";

interface SourcePreview {
  accessToken: string;
  userId: string;
  email: string | null;
  provider: string | null;
  credits: number;
  subStatus: string;
  subExpiresAt: string | null;
}

type Step = "intro" | "preview" | "done";

export default function MergeAccountPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [step, setStep] = useState<Step>("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keepEmail, setKeepEmail] = useState<string | null>(null);
  const [keepSub, setKeepSub] = useState<{ status: string; expiresAt: string | null } | null>(null);
  const [source, setSource] = useState<SourcePreview | null>(null);
  const [keepSubscription, setKeepSubscription] = useState<"keep" | "source">("keep");

  // 載入目前登入帳號 A 的基本資訊
  const loadKeep = useCallback(async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/");
      return null;
    }
    setKeepEmail(user.email ?? null);
    const { data: prof } = await supabase
      .from("profiles")
      .select("subscription_status, subscription_expires_at")
      .eq("id", user.id)
      .single();
    if (prof) {
      setKeepSub({
        status: prof.subscription_status as string,
        expiresAt: (prof.subscription_expires_at as string) ?? null,
      });
    }
    return user;
  }, [router]);

  // 回到本頁時:若帶著「合併進行中」旗標,代表剛從 B 登入回來
  const handleReturnFromSourceLogin = useCallback(async () => {
    const stashRaw = sessionStorage.getItem(STASH_KEY);
    if (!stashRaw) return false;

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    // 現在的 session 應該是 B
    const {
      data: { session: bSession },
    } = await supabase.auth.getSession();
    const {
      data: { user: bUser },
    } = await supabase.auth.getUser();

    let stash: { access_token: string; refresh_token: string; keepUserId: string } | null = null;
    try {
      stash = JSON.parse(stashRaw);
    } catch {
      stash = null;
    }

    if (!bSession || !bUser || !stash) {
      sessionStorage.removeItem(STASH_KEY);
      return false;
    }

    // 使用者取消登入、或又登回同一個 A → 視為未驗證
    if (bUser.id === stash.keepUserId) {
      sessionStorage.removeItem(STASH_KEY);
      // 還是 A,沒有第二個帳號,直接停在 intro
      return false;
    }

    // 趁現在是 B,讀 B 的點數 / 訂閱(RLS 允許讀自己)
    const { data: bProf } = await supabase
      .from("profiles")
      .select("credits_balance, subscription_status, subscription_expires_at")
      .eq("id", bUser.id)
      .single();

    const preview: SourcePreview = {
      accessToken: bSession.access_token,
      userId: bUser.id,
      email: bUser.email ?? null,
      provider: bUser.app_metadata?.provider ?? bUser.identities?.[0]?.provider ?? null,
      credits: (bProf?.credits_balance as number) ?? 0,
      subStatus: (bProf?.subscription_status as string) ?? "free",
      subExpiresAt: (bProf?.subscription_expires_at as string) ?? null,
    };

    // 還原 A 的 session(B 的 access token 已存進 preview,後端驗證仍有效)
    const { error: restoreErr } = await supabase.auth.setSession({
      access_token: stash.access_token,
      refresh_token: stash.refresh_token,
    });
    sessionStorage.removeItem(STASH_KEY);
    if (restoreErr) {
      setError(
        t(
          "還原原帳號登入狀態失敗,請重新整理再試一次。",
          "Failed to restore your original session. Please refresh and try again."
        )
      );
      return false;
    }

    setSource(preview);
    // 預設保留 A 的訂閱;若只有 B 有 active 訂閱,預設改成保留 B
    setStep("preview");
    return true;
  }, [t]);

  useEffect(() => {
    (async () => {
      const handled = await handleReturnFromSourceLogin();
      await loadKeep();
      if (!handled) setStep("intro");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 觸發登入來源帳號 B(先暫存 A 的 session)
  const startSourceLogin = async (provider: "google" | "apple") => {
    setError(null);
    setBusy(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!session || !user) {
        router.replace("/");
        return;
      }
      // 暫存 A 的 session,跨 OAuth 跳轉用
      sessionStorage.setItem(
        STASH_KEY,
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          keepUserId: user.id,
        })
      );
      const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(
        "/account/merge"
      )}`;
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          ...(provider === "apple" ? { scopes: "email name" } : {}),
        },
      });
      if (oauthErr) {
        sessionStorage.removeItem(STASH_KEY);
        setError(oauthErr.message);
        setBusy(false);
      }
      // 成功會整頁跳轉,不會走到這
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const bothHaveActiveSub =
    keepSub?.status === "active" || keepSub?.status === "canceled"
      ? source?.subStatus === "active" || source?.subStatus === "canceled"
      : false;

  const confirmMerge = async () => {
    if (!source) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAccessToken: source.accessToken,
          keepSubscription,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "merge_failed");
      }
      // 把 B 的 provider 重新綁到 A(B 已刪,該 identity 已釋出),讓之後用該方式登入會認得 A
      const prov = data.sourceProvider;
      if (prov === "google" || prov === "apple") {
        try {
          await linkIdentity(prov, { next: "/account" });
          return; // linkIdentity 會整頁跳轉
        } catch {
          // 綁定失敗不擋合併成功,使用者可稍後到綁定頁手動加綁
        }
      }
      setStep("done");
    } catch (e) {
      setError(
        t(
          `合併失敗:${e instanceof Error ? e.message : String(e)}`,
          `Merge failed: ${e instanceof Error ? e.message : String(e)}`
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <main style={pageStyle}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/account" style={{ color: "rgba(212,168,85,0.8)", fontSize: 13, textDecoration: "none" }}>
            ← {t("回我的會員", "Back to My Account")}
          </Link>
        </div>

        <h1
          className="text-gold-gradient"
          style={{ fontSize: 24, fontFamily: "'Noto Serif TC', serif", fontWeight: 700, marginBottom: 6 }}
        >
          {t("合併其他帳號", "Merge Another Account")}
        </h1>

        {keepEmail && (
          <p
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(212,168,85,0.08)",
              border: "1px solid rgba(212,168,85,0.2)",
              color: "#d4a855",
              fontSize: 12,
              margin: "12px 0",
              wordBreak: "break-all",
            }}
          >
            {t("保留的帳號(目前登入):", "Account to keep (current): ")}
            {keepEmail}
          </p>
        )}

        {error && (
          <p
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(229,57,67,0.1)",
              border: "1px solid rgba(229,57,67,0.3)",
              color: "#ff9a9a",
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {error}
          </p>
        )}

        {step === "intro" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: "rgba(192,192,208,0.7)", fontSize: 13, lineHeight: 1.7 }}>
              {t(
                "如果你之前用另一種方式(例如 Google)登入過、累積了點數或訂閱,可以把那個帳號併入目前這個帳號。系統會先請你登入要併入的帳號以證明所有權。",
                "If you previously signed in with another method (e.g. Google) and accumulated credits or a subscription, you can merge that account into this one. You'll be asked to sign in to the other account to prove ownership."
              )}
            </p>
            <p
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(255,176,72,0.08)",
                border: "1px solid rgba(255,176,72,0.35)",
                color: "#ffd99a",
                fontSize: 12.5,
                lineHeight: 1.6,
              }}
            >
              ⚠{" "}
              {t(
                "合併後,被併入的帳號會被停用,且此操作無法復原。點數會相加,占卜紀錄與收藏會合併。",
                "After merging, the other account is deactivated and this cannot be undone. Credits are added together; history and collections are merged."
              )}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button type="button" onClick={() => startSourceLogin("google")} disabled={busy} className="btn-gold" style={btnStyle}>
                {t("登入要併入的 Google 帳號", "Sign in to the Google account to merge")}
              </button>
              <button type="button" onClick={() => startSourceLogin("apple")} disabled={busy} className="btn-gold" style={btnStyle}>
                {t("登入要併入的 Apple 帳號", "Sign in to the Apple account to merge")}
              </button>
            </div>
          </div>
        )}

        {step === "preview" && source && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="mystic-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, color: "#e8e8f0", fontWeight: 600, marginBottom: 8 }}>
                {t("要併入的帳號", "Account to merge in")}
              </div>
              <div style={{ fontSize: 12, color: "rgba(192,192,208,0.7)", lineHeight: 1.9, wordBreak: "break-all" }}>
                <div>{source.email ?? source.provider ?? source.userId}</div>
                <div>{t("點數:", "Credits: ")}{source.credits}</div>
                <div>{t("訂閱狀態:", "Subscription: ")}{source.subStatus}{source.subExpiresAt ? `（${t("到期", "expires")} ${source.subExpiresAt.slice(0, 10)}）` : ""}</div>
              </div>
            </div>

            {bothHaveActiveSub && (
              <div className="mystic-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 13, color: "#e8e8f0", fontWeight: 600, marginBottom: 8 }}>
                  {t("兩個帳號都有訂閱,請選擇要保留哪一份", "Both accounts have a subscription — choose which to keep")}
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "rgba(232,232,240,0.9)", marginBottom: 8 }}>
                  <input type="radio" name="sub" checked={keepSubscription === "keep"} onChange={() => setKeepSubscription("keep")} />
                  {t("保留目前帳號的訂閱", "Keep this account's subscription")}
                  {keepSub?.expiresAt ? `（${t("到期", "expires")} ${keepSub.expiresAt.slice(0, 10)}）` : ""}
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "rgba(232,232,240,0.9)" }}>
                  <input type="radio" name="sub" checked={keepSubscription === "source"} onChange={() => setKeepSubscription("source")} />
                  {t("改用要併入帳號的訂閱", "Use the merged account's subscription")}
                  {source.subExpiresAt ? `（${t("到期", "expires")} ${source.subExpiresAt.slice(0, 10)}）` : ""}
                </label>
                <p style={{ fontSize: 11, color: "rgba(192,192,208,0.55)", marginTop: 8, lineHeight: 1.6 }}>
                  {t(
                    "未保留的那份訂閱請記得自行到原金流取消,以免重複扣款。",
                    "Remember to cancel the subscription you don't keep, to avoid double billing."
                  )}
                </p>
              </div>
            )}

            <button type="button" onClick={confirmMerge} disabled={busy} className="btn-gold" style={btnStyle}>
              {busy ? t("合併中…", "Merging…") : t("確認合併(不可復原)", "Confirm merge (irreversible)")}
            </button>
          </div>
        )}

        {step === "done" && (
          <div
            className="mystic-card"
            style={{ padding: 18, color: "rgba(232,232,240,0.9)", fontSize: 13, lineHeight: 1.7 }}
          >
            {t(
              "合併完成!點數與紀錄已併入目前帳號。",
              "Merge complete! Credits and history are now on this account."
            )}
            <div style={{ marginTop: 14 }}>
              <Link href="/account" style={{ color: "#d4a855", fontSize: 13 }}>
                {t("← 回我的會員", "← Back to My Account")}
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  paddingTop: 88,
  paddingBottom: 48,
  paddingLeft: 16,
  paddingRight: 16,
  maxWidth: 560,
  margin: "0 auto",
};

const btnStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  fontSize: 13,
  fontWeight: 700,
};
