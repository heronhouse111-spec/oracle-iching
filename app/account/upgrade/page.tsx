"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import { useIsTWA } from "@/lib/env/useIsTWA";
import { useCurrency } from "@/lib/geo/useCurrency";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_BENEFITS_ZH,
  SUBSCRIPTION_BENEFITS_EN,
  formatPrice,
  formatPriceOf,
  priceOf,
  type SubscriptionPlanId,
} from "@/lib/pricing";
import {
  isPlayBillingAvailable,
  purchaseSubscription,
} from "@/lib/billing/playBilling";

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

interface SubscriptionSummary {
  subscription_status: "free" | "active" | "canceled" | "expired";
  subscription_plan: SubscriptionPlanId | null;
  is_active: boolean;
}

export default function UpgradePage() {
  const { locale, t } = useLanguage();
  const isTwa = useIsTWA();
  const { currency } = useCurrency();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [current, setCurrent] = useState<SubscriptionSummary | null>(null);
  const [pendingPlan, setPendingPlan] = useState<SubscriptionPlanId | null>(
    null
  );

  // Play Billing 處理中(顯示 loading + disable 按鈕)
  const [playPurchasing, setPlayPurchasing] =
    useState<SubscriptionPlanId | null>(null);
  const [playToast, setPlayToast] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  // Web ECPay 訂閱結帳
  const [ecpayLoading, setEcpayLoading] =
    useState<SubscriptionPlanId | null>(null);
  const [ecpayError, setEcpayError] = useState<string | null>(null);

  // 登入 modal 開關 + 「使用者剛剛點了哪個 plan」記下來
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [pendingAfterLoginPlan, setPendingAfterLoginPlan] =
    useState<SubscriptionPlanId | null>(null);

  // 防止 autoSubscribe URL param 被多次觸發
  const autoSubscribeTriggeredRef = useRef(false);

  // 把 ?autoSubscribe=<planId> 推進 URL,讓 GSI window.location.reload()
  // 那條登入路徑回來後 URL 還帶得到參數,autoSubscribe useEffect 才會觸發。
  const openLoginModalForPlan = (planId: SubscriptionPlanId) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("autoSubscribe", planId);
      window.history.replaceState({}, "", url.toString());
    }
    setPendingAfterLoginPlan(planId);
    setLoginModalOpen(true);
  };

  const handleEcpaySubscribe = async (planId: SubscriptionPlanId) => {
    if (planId === "lifetime") return; // 不販售
    if (!authed) {
      // 未登入 → 開登入 modal,登入完成後 autoSubscribe useEffect 自動續跑
      openLoginModalForPlan(planId);
      return;
    }
    setEcpayLoading(planId);
    setEcpayError(null);
    try {
      const res = await fetch("/api/billing/ecpay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "subscription", planId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setEcpayError(
          t(
            `下單失敗:${err.error ?? res.statusText}`,
            `Checkout failed: ${err.error ?? res.statusText}`,
          ),
        );
        return;
      }
      const { checkoutUrl } = (await res.json()) as { checkoutUrl: string };
      window.location.assign(checkoutUrl);
    } catch (e) {
      setEcpayError(
        t(
          `網路錯誤:${e instanceof Error ? e.message : String(e)}`,
          `Network error: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    } finally {
      setEcpayLoading(null);
    }
  };

  const [playReady, setPlayReady] = useState(false);
  useEffect(() => {
    if (isTwa) setPlayReady(isPlayBillingAvailable());
  }, [isTwa]);

  const handlePlayPurchaseSubscription = async (planId: SubscriptionPlanId) => {
    if (planId === "lifetime") {
      // Play Billing 不支援 lifetime,UI 不該觸發到這
      setPlayToast({
        kind: "error",
        text: t("終身方案不在此提供", "Lifetime not available here"),
      });
      return;
    }
    if (!authed) {
      // 未登入 → 開登入 modal
      openLoginModalForPlan(planId);
      return;
    }
    setPlayPurchasing(planId);
    setPlayToast(null);
    try {
      const result = await purchaseSubscription(planId);
      if (!result.ok) {
        if (result.code === "user_canceled") return;
        setPlayToast({
          kind: "error",
          text: t(`訂閱失敗:${result.error}`, `Subscribe failed: ${result.error}`),
        });
        return;
      }
      // 重抓訂閱狀態
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("user_subscription_summary")
            .select("subscription_status, subscription_plan, is_active")
            .eq("user_id", user.id)
            .maybeSingle();
          if (data) setCurrent(data as SubscriptionSummary);
        }
      } catch {
        /* noop */
      }
      setPlayToast({
        kind: "success",
        text: t("訂閱成功!權益已啟用", "Subscribed — benefits active"),
      });
    } finally {
      setPlayPurchasing(null);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthed(false);
      return;
    }
    import("@/lib/supabase/client").then(async ({ createClient }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      const { data } = await supabase
        .from("user_subscription_summary")
        .select("subscription_status, subscription_plan, is_active")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setCurrent(data as SubscriptionSummary);
    });
  }, []);

  /**
   * autoSubscribe URL 偵測:當使用者從登入頁回跳(URL 帶 ?autoSubscribe=<planId>),
   * 且 authed === true,自動觸發對應訂閱流程(TWA → Play、web → ECPay)。
   *
   * 跑完(或已觸發過)就把 query string 從網址裡清掉,避免重整再跑一次。
   */
  useEffect(() => {
    if (authed !== true) return;
    if (autoSubscribeTriggeredRef.current) return;
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const autoSubscribe = url.searchParams.get("autoSubscribe");
    if (!autoSubscribe) return;

    const valid = (SUBSCRIPTION_PLANS as readonly { id: SubscriptionPlanId }[])
      .some((p) => p.id === autoSubscribe && p.id !== "lifetime");
    if (!valid) {
      url.searchParams.delete("autoSubscribe");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    autoSubscribeTriggeredRef.current = true;
    url.searchParams.delete("autoSubscribe");
    window.history.replaceState({}, "", url.toString());

    const planId = autoSubscribe as SubscriptionPlanId;
    if (isTwa) {
      void handlePlayPurchaseSubscription(planId);
    } else {
      void handleEcpaySubscribe(planId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, isTwa]);

  const mainStyle = {
    paddingTop: 80,
    paddingBottom: 48,
    paddingLeft: 16,
    paddingRight: 16,
    maxWidth: 960,
    margin: "0 auto",
  } as const;

  const benefits =
    locale === "zh" ? SUBSCRIPTION_BENEFITS_ZH : SUBSCRIPTION_BENEFITS_EN;

  const planLabel = (id: SubscriptionPlanId) => {
    switch (id) {
      case "monthly":
        return t("月訂閱", "Monthly");
      case "yearly":
        return t("年訂閱", "Yearly");
      case "lifetime":
        return t("終身方案", "Lifetime");
    }
  };

  const periodLabel = (id: SubscriptionPlanId) => {
    switch (id) {
      case "monthly":
        return t("/ 月", "/ month");
      case "yearly":
        return t("/ 年", "/ year");
      case "lifetime":
        return t("一次付清", "one-time");
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <main style={mainStyle}>
        {/* ---- Title ---- */}
        <h1
          className="text-gold-gradient"
          style={{
            fontSize: 24,
            fontFamily: "'Noto Serif TC', serif",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {t("升級訂閱", "Upgrade Subscription")}
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "rgba(192,192,208,0.6)",
            fontSize: 13,
            marginBottom: 28,
            lineHeight: 1.6,
          }}
        >
          {t(
            "解鎖完整權益,每月自動補 600 點,問卜不再煩惱點數",
            "Unlock the full experience with 600 credits refilled every month."
          )}
        </p>

        {/* ---- Current plan banner ---- */}
        {current && current.is_active && current.subscription_plan && (
          <div
            className="mystic-card"
            style={{
              padding: 16,
              marginBottom: 24,
              textAlign: "center",
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(52,211,153,0.35)",
            }}
          >
            <span
              style={{
                color: "#6ee7b7",
                fontSize: 12,
                letterSpacing: 1,
              }}
            >
              {t("你目前的方案", "Your current plan")}:
            </span>{" "}
            <span
              style={{
                color: "#6ee7b7",
                fontWeight: 600,
                fontSize: 14,
                marginLeft: 4,
              }}
            >
              {planLabel(current.subscription_plan)}
            </span>
          </div>
        )}

        {/* ---- TWA guard: Play Billing policy compliance ----
             Play 上架的 TWA 殼內不可顯示 in-app purchase UI。      */}
        {/* TWA toast */}
        {isTwa && playToast && (
          <div
            className="mystic-card"
            style={{
              padding: 14,
              marginBottom: 16,
              textAlign: "center",
              border: `1px solid ${
                playToast.kind === "success"
                  ? "rgba(110,231,183,0.5)"
                  : "rgba(248,113,113,0.5)"
              }`,
              background:
                playToast.kind === "success"
                  ? "rgba(110,231,183,0.08)"
                  : "rgba(248,113,113,0.08)",
              color: playToast.kind === "success" ? "#6ee7b7" : "#fca5a5",
              fontSize: 13,
            }}
          >
            {playToast.text}
          </div>
        )}
        {isTwa && !playReady && (
          <div
            className="mystic-card"
            style={{
              padding: 14,
              marginBottom: 16,
              textAlign: "center",
              fontSize: 12,
              color: "rgba(192,192,208,0.7)",
            }}
          >
            {t(
              "正在初始化付款服務,請稍候…",
              "Initializing payment service, please wait…"
            )}
          </div>
        )}

        {/* ---- Currency switcher (web only) ---- */}
        {!isTwa && <CurrencySwitcher />}

        {!isTwa && ecpayError && (
          <div
            className="mystic-card"
            style={{
              padding: 14,
              marginBottom: 16,
              textAlign: "center",
              border: "1px solid rgba(248,113,113,0.5)",
              background: "rgba(248,113,113,0.08)",
              color: "#fca5a5",
              fontSize: 13,
            }}
          >
            {ecpayError}
          </div>
        )}
        {/* 訂閱方案 grid 在 TWA + web 都顯示;onClick 行為依環境分流 */}

        {/* ---- Plan grid(TWA + web 都顯示) ---- */}
        {(
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent =
              current?.is_active && current.subscription_plan === plan.id;
            const planPrice = priceOf(plan.price, currency);
            const perMonth =
              plan.id === "lifetime"
                ? null
                : planPrice / plan.amortizeMonths;
            return (
              <div
                key={plan.id}
                className="mystic-card"
                style={{
                  padding: 24,
                  position: "relative",
                  border: plan.highlighted
                    ? "1px solid rgba(212,168,85,0.6)"
                    : undefined,
                  boxShadow: plan.highlighted
                    ? "0 0 30px rgba(212,168,85,0.2)"
                    : undefined,
                }}
              >
                {plan.highlighted && (
                  <div
                    style={{
                      position: "absolute",
                      top: -10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background:
                        "linear-gradient(135deg, #d4a855 0%, #f0d78c 50%, #d4a855 100%)",
                      color: "#0a0a1a",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 9999,
                      letterSpacing: 1,
                    }}
                  >
                    {t("推薦", "RECOMMENDED")}
                  </div>
                )}

                <div
                  style={{
                    color: "#d4a855",
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: 18,
                    textAlign: "center",
                    marginBottom: 14,
                  }}
                >
                  {planLabel(plan.id)}
                </div>

                <div style={{ textAlign: "center", marginBottom: 6 }}>
                  <span
                    className="text-gold-gradient"
                    style={{
                      fontFamily: "'Noto Serif TC', serif",
                      fontSize: 30,
                      fontWeight: 700,
                    }}
                  >
                    {formatPriceOf(plan.price, currency)}
                  </span>
                  <span
                    style={{
                      color: "rgba(192,192,208,0.6)",
                      fontSize: 13,
                      marginLeft: 6,
                    }}
                  >
                    {periodLabel(plan.id)}
                  </span>
                </div>

                {perMonth !== null && plan.id === "yearly" && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#6ee7b7",
                      fontSize: 11,
                      marginBottom: 16,
                    }}
                  >
                    {t(
                      `相當於 ${formatPrice(
                        currency === "TWD" ? Math.round(perMonth) : Number(perMonth.toFixed(2)),
                        currency
                      )} / 月,省 20%`,
                      `≈ ${formatPrice(
                        currency === "TWD" ? Math.round(perMonth) : Number(perMonth.toFixed(2)),
                        currency
                      )} / month · save 20%`
                    )}
                  </div>
                )}

                {plan.id === "lifetime" && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "rgba(192,192,208,0.55)",
                      fontSize: 11,
                      marginBottom: 16,
                    }}
                  >
                    {t(
                      "一次付清,永久會員",
                      "Pay once, lifetime access"
                    )}
                  </div>
                )}

                {plan.id === "monthly" && (
                  <div style={{ height: 11, marginBottom: 16 }} />
                )}

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0 0 20px 0",
                    fontSize: 12,
                    lineHeight: 1.7,
                    color: "rgba(192,192,208,0.85)",
                  }}
                >
                  {benefits.map((benefit, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          color: "#d4a855",
                          fontSize: 10,
                          lineHeight: 1.7,
                        }}
                      >
                        ✦
                      </span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      borderRadius: 9999,
                      border: "1px solid rgba(52,211,153,0.4)",
                      background: "rgba(16,185,129,0.12)",
                      color: "#6ee7b7",
                      fontSize: 13,
                      cursor: "default",
                    }}
                  >
                    ✓ {t("目前方案", "Current Plan")}
                  </button>
                ) : plan.id === "lifetime" ? (
                  // 終身方案不再販售(網頁也已隱藏);留按鈕避免破版,點擊無動作
                  <button
                    disabled
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      borderRadius: 9999,
                      border: "1px solid rgba(192,192,208,0.2)",
                      background: "transparent",
                      color: "rgba(192,192,208,0.4)",
                      fontSize: 13,
                      cursor: "not-allowed",
                    }}
                  >
                    {t("已停售", "Discontinued")}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (isTwa) {
                        handlePlayPurchaseSubscription(plan.id);
                      } else {
                        handleEcpaySubscribe(plan.id);
                      }
                    }}
                    disabled={
                      (isTwa && (!playReady || playPurchasing !== null)) ||
                      (!isTwa && ecpayLoading === plan.id)
                    }
                    className="btn-gold"
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      fontSize: 13,
                      opacity:
                        (isTwa && (!playReady || playPurchasing !== null)) ||
                        (!isTwa && ecpayLoading === plan.id)
                          ? 0.5
                          : 1,
                      cursor:
                        (isTwa && (!playReady || playPurchasing !== null)) ||
                        (!isTwa && ecpayLoading === plan.id)
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {playPurchasing === plan.id || ecpayLoading === plan.id
                      ? t("處理中…", "Processing…")
                      : t("選擇此方案", "Choose This Plan")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        )}

        {/* ---- Footer links(TWA + web 都顯示) ---- */}
        {(
        <div
          className="mystic-card"
          style={{
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              color: "rgba(192,192,208,0.7)",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {t(
              "只想偶爾問卜?可單次加購點數。",
              "Just occasional use? Try credit packs instead."
            )}
          </div>
          <Link
            href="/account/credits"
            style={{
              fontSize: 13,
              color: "#d4a855",
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: 9999,
              border: "1px solid rgba(212,168,85,0.4)",
              whiteSpace: "nowrap",
            }}
          >
            {t("看加購包 →", "See Credit Packs →")}
          </Link>
        </div>
        )}

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link
            href="/account"
            style={{
              color: "rgba(192,192,208,0.5)",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            ← {t("返回會員頁", "Back to account")}
          </Link>
        </div>
      </main>

      {/* ---- 登入 modal —— 未登入點「選擇此方案」時開啟,
            next 帶 ?autoSubscribe=<planId>,登入完成後 useEffect 自動續跑 ---- */}
      <LoginOptionsModal
        open={loginModalOpen}
        onClose={() => {
          setLoginModalOpen(false);
          setPendingAfterLoginPlan(null);
          // 使用者放棄登入 → 把 ?autoSubscribe 從 URL 清掉
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            if (url.searchParams.has("autoSubscribe")) {
              url.searchParams.delete("autoSubscribe");
              window.history.replaceState({}, "", url.toString());
            }
          }
        }}
        next={
          pendingAfterLoginPlan
            ? `/account/upgrade?autoSubscribe=${pendingAfterLoginPlan}`
            : "/account/upgrade"
        }
        title={t("登入即可完成訂閱", "Sign in to complete your subscription")}
        subtitle={t(
          "登入後會自動帶你進入訂閱結帳頁",
          "We'll take you straight to checkout after sign-in"
        )}
      />

      {/* ---- "Coming soon" modal (web only — TWA has no purchase trigger) ---- */}
      {!isTwa && pendingPlan && (
        <div
          onClick={() => setPendingPlan(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="mystic-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: 32,
              maxWidth: 360,
              width: "100%",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {authed ? "☯" : "🔐"}
            </div>
            <h3
              className="text-gold-gradient"
              style={{
                fontFamily: "'Noto Serif TC', serif",
                fontSize: 20,
                marginBottom: 12,
              }}
            >
              {!authed
                ? t("請先登入", "Sign In First")
                : currency === "USD"
                ? t("國際支付即將推出", "International Payment Coming Soon")
                : t("金流準備中", "Payment Coming Soon")}
            </h3>
            <p
              style={{
                color: "rgba(192,192,208,0.75)",
                fontSize: 13,
                lineHeight: 1.7,
                marginBottom: 20,
              }}
            >
              {!authed
                ? t(
                    "訂閱與點數需要綁定帳號,請先登入。登入送 30 點,老使用者自動補 500 點。",
                    "Subscriptions require an account. Sign in to continue — 30 credits on signup, 500 for existing users."
                  )
                : currency === "USD"
                ? t(
                    "國際信用卡(USD)訂閱正在整合中。你可以切換到 NT$ 用台灣金流,或留 email 等我們通知上線。",
                    "International (USD) subscription is being integrated. Switch to NT$ for the Taiwan payment rail, or leave your email so we can notify you when USD goes live."
                  )
                : t(
                    "訂閱功能即將開放,上線前會以 email 通知。想優先試用可到首頁訂閱電子報。",
                    "Subscription will open shortly — you'll be notified via email when live."
                  )}
            </p>
            {authed ? (
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {currency === "USD" && (
                  <Link
                    href="/account/international-soon"
                    className="btn-gold"
                    style={{ padding: "8px 18px", fontSize: 13, textDecoration: "none" }}
                  >
                    {t("查看替代方案 →", "See alternatives →")}
                  </Link>
                )}
                <button
                  onClick={() => setPendingPlan(null)}
                  style={{
                    padding: "8px 18px",
                    fontSize: 13,
                    borderRadius: 9999,
                    border: "1px solid rgba(192,192,208,0.3)",
                    background: "none",
                    color: "rgba(192,192,208,0.8)",
                    cursor: "pointer",
                  }}
                >
                  {t("了解", "Got it")}
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                }}
              >
                <button
                  onClick={() => setPendingPlan(null)}
                  style={{
                    padding: "8px 18px",
                    fontSize: 13,
                    borderRadius: 9999,
                    border: "1px solid rgba(192,192,208,0.3)",
                    background: "none",
                    color: "rgba(192,192,208,0.8)",
                    cursor: "pointer",
                  }}
                >
                  {t("取消", "Cancel")}
                </button>
                <Link
                  href="/"
                  className="btn-gold"
                  style={{
                    padding: "8px 24px",
                    fontSize: 13,
                    textDecoration: "none",
                  }}
                >
                  {t("回首頁登入", "Sign In")}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
