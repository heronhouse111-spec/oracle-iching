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

  // 取消訂閱
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const handleCancelSubscription = async () => {
    if (!confirm(
      t(
        "確認取消訂閱?\n\n下一期不會再自動扣款,但你仍可使用會員權益直到目前已付期限結束。",
        "Cancel subscription?\n\nNo further auto-renewal will occur, but you'll keep member benefits until the current period ends.",
      ),
    )) {
      return;
    }
    setCancelLoading(true);
    setCancelMessage(null);
    try {
      const res = await fetch("/api/billing/ecpay/cancel-subscription", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCancelMessage({
          kind: "error",
          text: t(
            `取消失敗:${err.error ?? res.statusText}`,
            `Cancel failed: ${err.error ?? res.statusText}`,
          ),
        });
        return;
      }
      setCancelMessage({
        kind: "success",
        text: t(
          "已取消下期續扣。會員權益維持到目前已付期限結束。",
          "Auto-renewal canceled. Member benefits remain until current period ends.",
        ),
      });
      // 重抓 summary 顯示新狀態
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user: u2 } } = await supabase.auth.getUser();
      if (u2) {
        const { data } = await supabase
          .from("user_subscription_summary")
          .select("*")
          .eq("user_id", u2.id)
          .maybeSingle();
        if (data) setSummary(data as SubscriptionSummary);
      }
    } catch (e) {
      setCancelMessage({
        kind: "error",
        text: t(
          `網路錯誤:${e instanceof Error ? e.message : String(e)}`,
          `Network: ${e instanceof Error ? e.message : String(e)}`,
        ),
      });
    } finally {
      setCancelLoading(false);
    }
  };

  // 是否該顯示「取消訂閱」按鈕
  // 條件:有效中(is_active) + 還沒被取消(status=active) + 是月/年訂閱(lifetime 不能取消,本來就一次付清)
  const canCancelSubscription =
    summary?.is_active === true &&
    summary?.subscription_status === "active" &&
    (summary?.subscription_plan === "monthly" ||
      summary?.subscription_plan === "yearly");

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
            {t("載入中...", "Loading...", "読み込み中...", "불러오는 중...")}
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
              {t(
                "回首頁登入",
                "Back to home to sign in",
                "ホームに戻ってログイン",
                "홈으로 돌아가 로그인"
              )}
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
        label: t("訂閱中", "Active", "サブスク中", "구독 중"),
        bg: "rgba(16,185,129,0.12)",
        border: "rgba(52,211,153,0.45)",
        color: "#6ee7b7",
      };
    }
    if (status === "canceled") {
      return {
        label: t(
          "已取消(未到期)",
          "Canceled (still valid)",
          "キャンセル済み(有効期限内)",
          "취소됨(유효 기간 내)"
        ),
        bg: "rgba(245,158,11,0.12)",
        border: "rgba(251,191,36,0.45)",
        color: "#fcd34d",
      };
    }
    if (status === "expired") {
      return {
        label: t("已到期", "Expired", "期限切れ", "만료됨"),
        bg: "rgba(244,63,94,0.12)",
        border: "rgba(251,113,133,0.45)",
        color: "#fda4af",
      };
    }
    return {
      label: t("免費會員", "Free Member", "無料会員", "무료 회원"),
      bg: "rgba(192,192,208,0.08)",
      border: "rgba(192,192,208,0.3)",
      color: "rgba(192,192,208,0.9)",
    };
  })();

  const planLabel = (() => {
    switch (plan) {
      case "monthly":
        return t("月訂閱", "Monthly", "月額プラン", "월간 플랜");
      case "yearly":
        return t("年訂閱", "Yearly", "年額プラン", "연간 플랜");
      case "lifetime":
        return t("終身方案", "Lifetime", "ライフタイム", "라이프타임");
      default:
        return t(
          "尚未訂閱",
          "Not subscribed",
          "未登録",
          "구독 안 함"
        );
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
    t("無名氏", "Anonymous", "匿名", "익명");

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
          {t("我的會員", "My Account", "マイアカウント", "내 계정")}
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
              {t("訂閱狀態", "Subscription", "サブスク状態", "구독 상태")}
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
              <div style={labelStyle}>{t("方案", "Plan", "プラン", "플랜")}</div>
              <div style={valueStyle}>{planLabel}</div>
            </div>
            <div>
              <div style={labelStyle}>{t("到期日", "Expires", "有効期限", "만료일")}</div>
              <div style={valueStyle}>
                {plan === "lifetime"
                  ? t("永久", "Never", "永久", "영구")
                  : formatDate(summary?.subscription_expires_at)}
              </div>
            </div>
            {summary?.subscription_started_at && (
              <div>
                <div style={labelStyle}>{t("開始日", "Started", "開始日", "시작일")}</div>
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
                    {t("剩餘天數", "Days Left", "残日数", "남은 일수")}
                  </div>
                  <div style={valueStyle}>
                    {daysRemaining} {t("天", "days", "日", "일")}
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
                  "升級訂閱後每月自動補 600 點,解鎖完整占卜紀錄、塔羅切換、詳細爻辭分析與無浮水印輸出。",
                  "Subscribe for 600 credits monthly, full history, Tarot, detailed yao analysis, and watermark-free exports."
                )}
              </p>
              <Link
                href="/account/upgrade"
                className="btn-gold"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 16px",
                  fontSize: 13,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                {t(
                  "查看訂閱方案",
                  "See Subscription Plans",
                  "サブスクプランを見る",
                  "구독 플랜 보기"
                )}
              </Link>
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
            href="/account/credits"
            style={{
              display: "block",
              padding: "10px 12px",
              color: "rgba(192,192,208,0.9)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {t(
              "→ 購買點數",
              "→ Purchase Credits",
              "→ ポイント購入",
              "→ 포인트 구매"
            )}
          </Link>
          {isActive && (
            <Link
              href="/account/upgrade"
              style={{
                display: "block",
                padding: "10px 12px",
                color: "rgba(192,192,208,0.9)",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              {t(
                "→ 管理訂閱方案",
                "→ Manage Subscription",
                "→ サブスク管理",
                "→ 구독 관리"
              )}
            </Link>
          )}
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
            {t("→ 占卜紀錄", "→ Divination History", "→ 占い履歴", "→ 점 기록")}
          </Link>
          <Link
            href="/account/linked"
            style={{
              display: "block",
              padding: "10px 12px",
              color: "rgba(192,192,208,0.9)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {t(
              "→ 登入方式綁定",
              "→ Linked Sign-in Methods",
              "→ ログイン方法の連携",
              "→ 로그인 방법 연동"
            )}
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
            {t(
              "→ 開始新占卜",
              "→ Start a new divination",
              "→ 新しい占いを始める",
              "→ 새로운 점 시작"
            )}
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
            {t("登出", "Sign Out", "ログアウト", "로그아웃")}
          </button>

          {/* 取消訂閱 — 小、低調,只在有效中訂閱者出現 */}
          {canCancelSubscription && (
            <button
              onClick={handleCancelSubscription}
              disabled={cancelLoading}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                color: "rgba(192,192,208,0.4)",
                fontSize: 11,
                background: "none",
                border: "none",
                cursor: cancelLoading ? "not-allowed" : "pointer",
                textDecoration: "underline",
                opacity: cancelLoading ? 0.5 : 1,
              }}
              title={t(
                "停止下期自動扣款。會員權益保留到目前期限結束。",
                "Stop auto-renewal. Benefits keep until current period ends.",
              )}
            >
              {cancelLoading
                ? t("處理中…", "Processing…", "処理中…", "처리 중…")
                : t(
                    "取消訂閱(停止下期續扣)",
                    "Cancel subscription (stop auto-renewal)",
                    "サブスク解約(次回更新を停止)",
                    "구독 취소(다음 갱신 중지)"
                  )}
            </button>
          )}
          {cancelMessage && (
            <div
              style={{
                padding: "8px 12px",
                fontSize: 11,
                color:
                  cancelMessage.kind === "success" ? "#6ee7b7" : "#fca5a5",
                lineHeight: 1.5,
              }}
            >
              {cancelMessage.text}
            </div>
          )}

          <Link
            href="/account/delete"
            style={{
              display: "block",
              padding: "10px 12px",
              color: "rgba(244,113,133,0.7)",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            {t(
              "→ 刪除帳號與所有資料",
              "→ Delete account & all data",
              "→ アカウントとすべてのデータを削除",
              "→ 계정과 모든 데이터 삭제"
            )}
          </Link>
        </div>
      </main>
    </div>
  );
}
