"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";

interface SubscriptionSummary {
  user_id: string;
  display_name: string | null;
  subscription_status: "free" | "active" | "canceled" | "expired";
  subscription_plan: "monthly" | "yearly" | "lifetime" | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  is_active: boolean;
  days_remaining: number | null;
}

interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
}

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

export default function AccountPage() {
  const { locale, t } = useLanguage();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    import("@/lib/supabase/client").then(async ({ createClient }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      setUser(user as AuthUser);
      const { data } = await supabase
        .from("user_subscription_summary")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setSummary(data as SubscriptionSummary);
      setIsLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const mainStyle = {
    paddingTop: 80,
    paddingBottom: 48,
    paddingLeft: 16,
    paddingRight: 16,
    maxWidth: 640,
    margin: "0 auto",
  } as const;

  // ---- Loading ----
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Header />
        <main style={mainStyle}>
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "rgba(192,192,208,0.6)",
            }}
          >
            {t("載入中...", "Loading...")}
          </div>
        </main>
      </div>
    );
  }

  // ---- Supabase not configured ----
  if (!isSupabaseConfigured) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Header />
        <main style={mainStyle}>
          <div
            className="mystic-card"
            style={{ padding: 48, textAlign: "center" }}
          >
            <p style={{ color: "rgba(192,192,208,0.8)" }}>
              {t(
                "會員功能尚未設定,請先完成 Supabase 設定。",
                "Account features are not configured yet."
              )}
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ---- Not logged in ----
  if (!user) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Header />
        <main style={mainStyle}>
          <div
            className="mystic-card"
            style={{ padding: 48, textAlign: "center" }}
          >
            <span
              style={{ fontSize: 40, display: "block", marginBottom: 16 }}
            >
              🔐
            </span>
            <p
              style={{
                color: "rgba(192,192,208,0.8)",
                marginBottom: 16,
              }}
            >
              {t(
                "請先登入以查看會員資訊",
                "Please sign in to view your account"
              )}
            </p>
            <Link
              href="/"
              className="btn-gold"
              style={{
                display: "inline-block",
                marginTop: 8,
                textDecoration: "none",
              }}
            >
              {t("回首頁登入", "Back to home to sign in")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ---- Derived display values ----
  const status = summary?.subscription_status ?? "free";
  const isActive = summary?.is_active ?? false;
  const plan = summary?.subscription_plan;
  const daysRemaining = summary?.days_remaining;

  const statusBadge = (() => {
    if (isActive) {
      return {
        label: t("訂閱中", "Active"),
        bg: "rgba(16,185,129,0.12)",
        border: "rgba(52,211,153,0.45)",
        color: "#6ee7b7",
      };
    }
    if (status === "canceled") {
      return {
        label: t("已取消(未到期)", "Canceled (still valid)"),
        bg: "rgba(245,158,11,0.12)",
        border: "rgba(251,191,36,0.45)",
        color: "#fcd34d",
      };
    }
    if (status === "expired") {
      return {
        label: t("已到期", "Expired"),
        bg: "rgba(244,63,94,0.12)",
        border: "rgba(251,113,133,0.45)",
        color: "#fda4af",
      };
    }
    return {
      label: t("免費會員", "Free Member"),
      bg: "rgba(192,192,208,0.08)",
      border: "rgba(192,192,208,0.3)",
      color: "rgba(192,192,208,0.9)",
    };
  })();

  const planLabel = (() => {
    switch (plan) {
      case "monthly":
        return t("月訂閱", "Monthly");
      case "yearly":
        return t("年訂閱", "Yearly");
      case "lifetime":
        return t("終身方案", "Lifetime");
      default:
        return t("尚未訂閱", "Not subscribed");
    }
  })();

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(
      locale === "zh" ? "zh-TW" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
  };

  const displayName =
    summary?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    t("無名氏", "Anonymous");

  const labelStyle = {
    color: "rgba(192,192,208,0.5)",
    fontSize: 11,
    marginBottom: 4,
  } as const;
  const valueStyle = {
    color: "rgba(192,192,208,0.95)",
    fontSize: 14,
  } as const;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <main style={mainStyle}>
        <h1
          className="text-gold-gradient"
          style={{
            fontSize: 24,
            fontFamily: "'Noto Serif TC', serif",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          {t("我的會員", "My Account")}
        </h1>

        {/* --- Profile card --- */}
        <div
          className="mystic-card"
          style={{ padding: 24, marginBottom: 20 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(212,168,85,0.2)",
                border: "1px solid rgba(212,168,85,0.3)",
                color: "#d4a855",
                fontSize: 20,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {(user.email?.charAt(0) || "U").toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: "#d4a855",
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 18,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  color: "rgba(192,192,208,0.6)",
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.email}
              </div>
            </div>
          </div>
        </div>

        {/* --- Subscription card --- */}
        <div
          className="mystic-card"
          style={{ padding: 24, marginBottom: 20 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <h2
              style={{
                color: "#d4a855",
                fontFamily: "'Noto Serif TC', serif",
                fontSize: 15,
                margin: 0,
              }}
            >
              {t("訂閱狀態", "Subscription")}
            </h2>
            <span
              style={{
                fontSize: 11,
                padding: "4px 12px",
                borderRadius: 9999,
                background: statusBadge.bg,
                border: `1px solid ${statusBadge.border}`,
                color: statusBadge.color,
              }}
            >
              {statusBadge.label}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div>
              <div style={labelStyle}>{t("方案", "Plan")}</div>
              <div style={valueStyle}>{planLabel}</div>
            </div>
            <div>
              <div style={labelStyle}>{t("到期日", "Expires")}</div>
              <div style={valueStyle}>
                {plan === "lifetime"
                  ? t("永久", "Never")
                  : formatDate(summary?.subscription_expires_at)}
              </div>
            </div>
            {summary?.subscription_started_at && (
              <div>
                <div style={labelStyle}>{t("開始日", "Started")}</div>
                <div style={valueStyle}>
                  {formatDate(summary.subscription_started_at)}
                </div>
              </div>
            )}
            {isActive &&
              daysRemaining !== null &&
              daysRemaining !== undefined &&
              plan !== "lifetime" && (
                <div>
                  <div style={labelStyle}>
                    {t("剩餘天數", "Days Left")}
                  </div>
                  <div style={valueStyle}>
                    {daysRemaining} {t("天", "days")}
                  </div>
                </div>
              )}
          </div>

          {!isActive && (
            <div
              style={{
                borderTop: "1px solid rgba(212,168,85,0.1)",
                marginTop: 20,
                paddingTop: 16,
              }}
            >
              <p
                style={{
                  color: "rgba(192,192,208,0.7)",
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: "0 0 12px 0",
                }}
              >
                {t(
                  "升級訂閱後可解鎖完整占卜紀錄、多種占卜系統(塔羅…),並支援無浮水印輸出。",
                  "Upgrade to unlock full history, multiple systems (Tarot…), and watermark-free outputs."
                )}
              </p>
              <button
                disabled
                title={t("金流功能準備中", "Payment coming soon")}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: 9999,
                  border: "1px solid rgba(212,168,85,0.4)",
                  color: "rgba(212,168,85,0.6)",
                  fontSize: 13,
                  background: "none",
                  cursor: "not-allowed",
                }}
              >
                {t("升級訂閱(即將推出)", "Upgrade (Coming Soon)")}
              </button>
            </div>
          )}

          {status === "canceled" && isActive && (
            <div
              style={{
                borderTop: "1px solid rgba(212,168,85,0.1)",
                marginTop: 20,
                paddingTop: 16,
              }}
            >
              <p
                style={{
                  color: "rgba(252,211,77,0.85)",
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {t(
                  "你已取消訂閱,但在到期日前仍可使用所有付費功能。",
                  "Your subscription is canceled but remains valid until the expiry date."
                )}
              </p>
            </div>
          )}
        </div>

        {/* --- Quick links --- */}
        <div className="mystic-card" style={{ padding: 12 }}>
          <Link
            href="/history"
            style={{
              display: "block",
              padding: "10px 12px",
              color: "rgba(192,192,208,0.9)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {t("→ 占卜紀錄", "→ Divination History")}
          </Link>
          <Link
            href="/"
            style={{
              display: "block",
              padding: "10px 12px",
              color: "rgba(192,192,208,0.9)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {t("→ 開始新占卜", "→ Start a new divination")}
          </Link>
          <button
            onClick={handleLogout}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              marginTop: 4,
              color: "rgba(192,192,208,0.6)",
              fontSize: 13,
              background: "none",
              border: "none",
              borderTop: "1px solid rgba(212,168,85,0.1)",
              cursor: "pointer",
            }}
          >
            {t("登出", "Sign Out")}
          </button>
        </div>
      </main>
    </div>
  );
}
