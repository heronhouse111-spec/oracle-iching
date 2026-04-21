"use client";

/**
 * 帳號登入方式管理頁
 *
 * 目的:
 * - 讓使用者綁定多種登入方式,避免下次用錯 provider 就變新帳號(Supabase 預設:
 *   即使 email 一樣,不同 OAuth identity 預設會被視為不同 user)。
 * - 也可以解綁已不使用的 identity,但至少要保留一個以上(lib/auth/signIn.ts 會擋)。
 *
 * Supabase API:
 * - supabase.auth.getUserIdentities() → 目前所有綁定
 * - supabase.auth.linkIdentity({provider}) → 追加一個
 * - supabase.auth.unlinkIdentity(identity) → 移除一個
 *
 * 注意:linkIdentity 要在 Supabase Dashboard → Auth → Settings 打開
 *   "Enable Manual Linking" 才能運作,預設是關的。
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import { linkIdentity, unlinkIdentity, type SocialProvider } from "@/lib/auth/signIn";

interface Identity {
  identity_id: string;
  provider: string; // "google" | "apple" | "line" | "email" | ...
  created_at?: string;
  last_sign_in_at?: string;
  identity_data?: { email?: string; name?: string };
}

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

const LINE_LOGIN_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_LINE_LOGIN_ENABLED === "true";

const APPLE_LOGIN_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_APPLE_LOGIN_ENABLED === "true";

// 支援的登入方式清單(對外顯示順序)
// Apple / LINE 需 env flag 開啟,未開啟時整列不 render(避免使用者看到無法用的選項)。
// Facebook 保留在此頁 —— 這是 FB 唯一的綁定入口,
// 已登入使用者可把 FB 追加到自己帳號上,下次用 FB 登入會認得,避免生出孤兒帳號。
const ALL_PROVIDERS: { key: SocialProvider | "email"; label: string; labelEn: string; color: string }[] = [
  { key: "google", label: "Google", labelEn: "Google", color: "#4285F4" },
  { key: "apple", label: "Apple", labelEn: "Apple", color: "#000" },
  { key: "facebook", label: "Facebook", labelEn: "Facebook", color: "#1877F2" },
  { key: "line", label: "LINE", labelEn: "LINE", color: "#06C755" },
  { key: "email", label: "Email 登入連結", labelEn: "Email Magic Link", color: "#d4a855" },
];
const PROVIDERS = ALL_PROVIDERS.filter((p) => {
  if (p.key === "apple") return APPLE_LOGIN_ENABLED;
  if (p.key === "line") return LINE_LOGIN_ENABLED;
  return true;
});

export default function LinkedAccountsPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const loadIdentities = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/");
      return;
    }
    setEmail(user.email ?? null);

    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else {
      setIdentities((data.identities as Identity[]) ?? []);
    }
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    loadIdentities();
  }, [loadIdentities]);

  const handleLink = async (provider: SocialProvider) => {
    setMessage(null);
    setBusy(provider);
    try {
      await linkIdentity(provider, { next: "/account/linked" });
      // linkIdentity 成功會 full-page redirect 去 provider,不會走到這
    } catch (e) {
      setMessage({
        kind: "error",
        text: e instanceof Error ? e.message : String(e),
      });
      setBusy(null);
    }
  };

  const handleUnlink = async (identity: Identity) => {
    if (!confirm(
      t(
        `確定要移除「${labelOf(identity.provider)}」登入方式嗎?移除後這個 provider 將無法再用來登入此帳號。`,
        `Remove "${labelOf(identity.provider)}" sign-in? After removal you won't be able to use this provider to sign in to this account.`
      )
    )) {
      return;
    }
    setMessage(null);
    setBusy(identity.identity_id);
    try {
      await unlinkIdentity(identity.identity_id);
      setMessage({
        kind: "success",
        text: t("已移除登入方式", "Sign-in method removed"),
      });
      await loadIdentities();
    } catch (e) {
      setMessage({
        kind: "error",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Header />
        <main style={pageStyle}>
          <p style={{ color: "rgba(192,192,208,0.75)", textAlign: "center" }}>
            {t("功能需 Supabase 設定後才能使用", "This page requires Supabase to be configured")}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <main style={pageStyle}>
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/account"
            style={{
              color: "rgba(212,168,85,0.8)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← {t("回我的會員", "Back to My Account")}
          </Link>
        </div>

        <h1
          className="text-gold-gradient"
          style={{
            fontSize: 24,
            fontFamily: "'Noto Serif TC', serif",
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          {t("登入方式綁定", "Linked Sign-in Methods")}
        </h1>
        <p
          style={{
            color: "rgba(192,192,208,0.65)",
            fontSize: 13,
            marginBottom: 20,
            lineHeight: 1.7,
          }}
        >
          {t(
            "你可以把多種登入方式綁到同一個帳號,點數與占卜紀錄共通。想改用 Facebook 登入?請先用目前的 Google 或 Email 登入,然後在下方按「綁定 Facebook」。未綁定就直接用 FB 登入會變新帳號,點數無法帶過去。",
            "Link multiple sign-in methods so credits and history stay on one account. To use Facebook next time, sign in with your current Google or Email first, then click \"Link\" beside Facebook below. Logging in with Facebook without linking first will create a new, separate account."
          )}
        </p>

        {email && (
          <p
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(212,168,85,0.08)",
              border: "1px solid rgba(212,168,85,0.2)",
              color: "#d4a855",
              fontSize: 12,
              marginBottom: 16,
              wordBreak: "break-all",
            }}
          >
            {t("目前帳號:", "Current account: ")}{email}
          </p>
        )}

        {message && (
          <p
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background:
                message.kind === "error"
                  ? "rgba(229,57,67,0.1)"
                  : "rgba(52,168,83,0.1)",
              border:
                message.kind === "error"
                  ? "1px solid rgba(229,57,67,0.3)"
                  : "1px solid rgba(52,168,83,0.3)",
              color: message.kind === "error" ? "#ff9a9a" : "#9ae0a5",
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {message.text}
          </p>
        )}

        {isLoading ? (
          <p style={{ color: "rgba(192,192,208,0.55)", textAlign: "center" }}>
            {t("載入中…", "Loading…")}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PROVIDERS.map((p) => {
              const linked = identities.find((i) => i.provider === p.key);
              const disabled = p.key === "line" && !LINE_LOGIN_ENABLED;
              const isBusy = busy === p.key || busy === linked?.identity_id;

              return (
                <div
                  key={p.key}
                  className="mystic-card"
                  style={{
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    opacity: disabled ? 0.55 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: "#e8e8f0",
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 2,
                      }}
                    >
                      {t(p.label, p.labelEn)}
                    </div>
                    {linked ? (
                      <div
                        style={{
                          color: "rgba(192,192,208,0.6)",
                          fontSize: 11,
                          wordBreak: "break-all",
                        }}
                      >
                        {linked.identity_data?.email ??
                          t("已綁定", "Linked")}
                      </div>
                    ) : disabled ? (
                      <div
                        style={{
                          color: "rgba(192,192,208,0.4)",
                          fontSize: 11,
                        }}
                      >
                        {t("即將推出", "Coming soon")}
                      </div>
                    ) : (
                      <div
                        style={{
                          color: "rgba(192,192,208,0.45)",
                          fontSize: 11,
                        }}
                      >
                        {t("尚未綁定", "Not linked")}
                      </div>
                    )}
                  </div>

                  {p.key === "email" ? (
                    // Email magic link 是一次性寄信,沒有持續的 identity 綁定概念,
                    // 只顯示「已用過一次」狀態即可,不提供解綁(沒意義)
                    <span
                      style={{
                        fontSize: 12,
                        color: linked
                          ? "rgba(52,168,83,0.7)"
                          : "rgba(192,192,208,0.4)",
                      }}
                    >
                      {linked ? t("已啟用", "Active") : t("—", "—")}
                    </span>
                  ) : linked ? (
                    <button
                      type="button"
                      onClick={() => handleUnlink(linked)}
                      disabled={isBusy || identities.length <= 1}
                      title={
                        identities.length <= 1
                          ? t(
                              "至少要保留一種登入方式",
                              "At least one sign-in method must remain"
                            )
                          : undefined
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: 9999,
                        border: "1px solid rgba(244,113,133,0.4)",
                        background: "none",
                        color: "rgba(244,113,133,0.85)",
                        fontSize: 12,
                        cursor:
                          identities.length <= 1 ? "not-allowed" : "pointer",
                        opacity: identities.length <= 1 ? 0.4 : 1,
                        flexShrink: 0,
                      }}
                    >
                      {isBusy ? "…" : t("移除", "Unlink")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLink(p.key as SocialProvider)}
                      disabled={disabled || isBusy}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 9999,
                        border: "1px solid rgba(212,168,85,0.4)",
                        background: "rgba(212,168,85,0.1)",
                        color: "#d4a855",
                        fontSize: 12,
                        cursor: disabled ? "not-allowed" : "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {isBusy ? "…" : t("綁定", "Link")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p
          style={{
            marginTop: 20,
            padding: 12,
            borderRadius: 8,
            background: "rgba(192,192,208,0.04)",
            border: "1px solid rgba(192,192,208,0.1)",
            color: "rgba(192,192,208,0.55)",
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          {t(
            "小提醒:綁定功能需在 Supabase Dashboard 開啟 Manual Linking。如綁定時跳出錯誤,請聯絡管理員。",
            "Note: Manual Linking must be enabled in Supabase Dashboard. If linking fails with an error, please contact support."
          )}
        </p>
      </main>
    </div>
  );
}

function labelOf(provider: string): string {
  switch (provider) {
    case "google":
      return "Google";
    case "apple":
      return "Apple";
    case "facebook":
      return "Facebook";
    case "line":
      return "LINE";
    case "email":
      return "Email";
    default:
      return provider;
  }
}

const pageStyle: React.CSSProperties = {
  paddingTop: 88,
  paddingBottom: 48,
  paddingLeft: 16,
  paddingRight: 16,
  maxWidth: 560,
  margin: "0 auto",
};
