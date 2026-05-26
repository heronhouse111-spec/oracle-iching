"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import { SUBSCRIPTION_SKUS, PLAY_PACKAGE_NAME } from "@/lib/billing/playSkus";

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

  // 目前有效訂閱來自哪個 provider(用來決定取消流程走哪邊)
  // ecpay → call /api/billing/ecpay/cancel-subscription
  // google_play → 引導至 Play Store(API 取消是 Google 政策禁止)
  const [activeProvider, setActiveProvider] = useState<
    "ecpay" | "google_play" | null
  >(null);

  // 取消訂閱
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  // 暱稱編輯
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState("");

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

  // 是否該顯示「取消訂閱」按鈕(僅 ECPay 訂閱可在站內直接取消)
  // 條件:有效中(is_active) + 還沒被取消(status=active) + 是月/年訂閱(lifetime 不能取消,本來就一次付清)
  //      + provider === "ecpay"(Google Play 訂閱受政策限制,只能在 Play Store 取消,見下方專屬 block)
  const canCancelSubscription =
    summary?.is_active === true &&
    summary?.subscription_status === "active" &&
    (summary?.subscription_plan === "monthly" ||
      summary?.subscription_plan === "yearly") &&
    activeProvider === "ecpay";

  // 是否該顯示「前往 Play Store 管理訂閱」連結(Google Play 訂閱戶)
  // 條件:有效中 + active + 月/年訂閱 + provider === "google_play"
  // 點下去開 Play Store 訂閱管理頁;真正取消後 Google 透過 RTDN webhook 通知我們更新 DB。
  const showPlayManageLink =
    summary?.is_active === true &&
    summary?.subscription_status === "active" &&
    (summary?.subscription_plan === "monthly" ||
      summary?.subscription_plan === "yearly") &&
    activeProvider === "google_play";

  // Play Store 訂閱管理 deep link(TWA 中 Chrome 會把它導到 Play Store app)
  // 格式:https://play.google.com/store/account/subscriptions?sku=<SKU>&package=<PKG>
  const playManageUrl = (() => {
    const plan = summary?.subscription_plan;
    if (plan !== "monthly" && plan !== "yearly") return null;
    const sku = SUBSCRIPTION_SKUS[plan];
    if (!sku) return null;
    return `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(sku)}&package=${encodeURIComponent(PLAY_PACKAGE_NAME)}`;
  })();

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

      // 撈最新一筆 active 訂閱的 provider — 決定取消流程走 ECPay endpoint
      // 還是引導到 Play Store。RLS 允許使用者讀自己的 subscriptions row。
      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("provider")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subRow?.provider === "ecpay" || subRow?.provider === "google_play") {
        setActiveProvider(subRow.provider);
      }

      setIsLoading(false);
    });
  }, []);

  const handleSaveNickname = async () => {
    const value = nicknameInput.trim();
    if (value.length < 1 || value.length > 30) {
      setNicknameError(t("暱稱請填 1–30 字", "1–30 chars please", "1～30 文字でお願いします", "1–30자로 입력하세요"));
      return;
    }
    setSavingNickname(true);
    setNicknameError("");
    try {
      const res = await fetch("/api/account/nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 422) {
        setNicknameError(data.message || t("不符合社群規範", "Doesn't meet guidelines", "ガイドライン違反", "가이드라인 위반"));
        return;
      }
      if (!res.ok) {
        setNicknameError(data.message || t("更新失敗", "Update failed", "更新失敗", "업데이트 실패"));
        return;
      }
      // 同步更新本地 summary,不用 reload
      setSummary((prev) =>
        prev ? { ...prev, display_name: data.nickname as string } : prev,
      );
      setEditingNickname(false);
    } catch (e) {
      setNicknameError(
        e instanceof Error ? e.message : t("網路錯誤", "Network error", "ネットワーク", "네트워크"),
      );
    } finally {
      setSavingNickname(false);
    }
  };

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
              {!editingNickname ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        color: "#d4a855",
                        fontFamily: "'Noto Serif TC', serif",
                        fontSize: 18,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {displayName}
                    </div>
                    <button
                      onClick={() => {
                        setNicknameInput(summary?.display_name ?? "");
                        setNicknameError("");
                        setEditingNickname(true);
                      }}
                      aria-label={t("編輯暱稱", "Edit nickname", "ニックネーム編集", "닉네임 편집")}
                      title={t("編輯暱稱", "Edit nickname", "ニックネーム編集", "닉네임 편집")}
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: "transparent",
                        border: "1px solid rgba(212,168,85,0.3)",
                        color: "#d4a855",
                        fontSize: 12,
                        cursor: "pointer",
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      ✎
                    </button>
                  </div>
                  <div
                    style={{
                      color: "rgba(192,192,208,0.6)",
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginTop: 2,
                    }}
                  >
                    {user.email}
                  </div>
                  <div
                    style={{
                      color: "rgba(192,192,208,0.45)",
                      fontSize: 11,
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}
                  >
                    {t(
                      "你創作的音樂會用這個暱稱顯示在排行榜",
                      "Your nickname appears on tracks you create on the leaderboard",
                      "作成した音楽はこのニックネームで表示されます",
                      "만든 음악은 이 닉네임으로 랭킹에 표시됩니다",
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <input
                    autoFocus
                    type="text"
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value.slice(0, 30))}
                    placeholder={t("輸入暱稱", "Enter nickname", "ニックネーム入力", "닉네임 입력")}
                    maxLength={30}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: 16,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(212,168,85,0.4)",
                      borderRadius: 8,
                      color: "#fff",
                      outline: "none",
                      fontFamily: "inherit",
                      marginBottom: 6,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(192,192,208,0.45)",
                      textAlign: "right",
                      marginBottom: 8,
                    }}
                  >
                    {nicknameInput.length} / 30
                  </div>
                  {nicknameError && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#ff8e7a",
                        marginBottom: 8,
                      }}
                    >
                      {nicknameError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={handleSaveNickname}
                      disabled={savingNickname}
                      style={{
                        padding: "8px 14px",
                        background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                        color: "#0a0a1a",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: savingNickname ? "wait" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {savingNickname
                        ? t("儲存中…", "Saving…", "保存中…", "저장 중…")
                        : t("儲存", "Save", "保存", "저장")}
                    </button>
                    <button
                      onClick={() => {
                        setEditingNickname(false);
                        setNicknameError("");
                      }}
                      disabled={savingNickname}
                      style={{
                        padding: "8px 14px",
                        background: "transparent",
                        color: "rgba(192,192,208,0.7)",
                        border: "1px solid rgba(192,192,208,0.3)",
                        borderRadius: 8,
                        fontSize: 13,
                        cursor: savingNickname ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {t("取消", "Cancel", "キャンセル", "취소")}
                    </button>
                  </div>
                </div>
              )}
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
            href="/iching/hexagrams"
            style={{
              display: "block",
              padding: "10px 12px",
              color: "rgba(192,192,208,0.9)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {t(
              "→ 我的易經卦象收藏",
              "→ My I Ching Collection",
              "→ 私の易経収集",
              "→ 나의 주역 수집",
            )}
          </Link>
          <Link
            href="/tarot/cards"
            style={{
              display: "block",
              padding: "10px 12px",
              color: "rgba(192,192,208,0.9)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {t(
              "→ 我的塔羅牌收藏",
              "→ My Tarot Collection",
              "→ 私のタロット収集",
              "→ 나의 타로 수집",
            )}
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

          {/* Google Play 訂閱:Google 政策只允許使用者在 Play Store 取消,
              這裡僅提示 + 提供 deep link;真正取消後 RTDN webhook 會把 DB 同步成 canceled。 */}
          {showPlayManageLink && playManageUrl && (
            <a
              href={playManageUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                padding: "8px 12px",
                color: "rgba(192,192,208,0.4)",
                fontSize: 11,
                textDecoration: "underline",
              }}
              title={t(
                "Google Play 訂閱僅能在 Play Store 中取消。會員權益保留到目前期限結束。",
                "Google Play subscriptions can only be canceled in the Play Store. Benefits remain until the current period ends.",
              )}
            >
              {t(
                "前往 Play Store 管理 / 取消訂閱",
                "Manage / cancel in Play Store",
                "Play Store でサブスクを管理 / 解約",
                "Play Store에서 구독 관리 / 취소",
              )}
            </a>
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
