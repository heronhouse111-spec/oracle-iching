"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_BENEFITS_ZH,
  SUBSCRIPTION_BENEFITS_EN,
  YEARLY_EXTRA_BENEFIT_ZH,
  YEARLY_EXTRA_BENEFIT_EN,
  formatTwd,
  type SubscriptionPlanId,
} from "@/lib/pricing";

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
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [current, setCurrent] = useState<SubscriptionSummary | null>(null);
  const [pendingPlan, setPendingPlan] = useState<SubscriptionPlanId | null>(
    null
  );

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
  const yearlyExtra =
    locale === "zh" ? YEARLY_EXTRA_BENEFIT_ZH : YEARLY_EXTRA_BENEFIT_EN;

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

        {/* ---- Plan grid ---- */}
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
            const perMonth =
              plan.id === "lifetime"
                ? null
                : plan.priceTwd / plan.amortizeMonths;
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
                    {formatTwd(plan.priceTwd)}
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
                      `相當於 ${formatTwd(Math.round(perMonth))} / 月,省 20%`,
                      `≈ ${formatTwd(Math.round(perMonth))} / month · save 20%`
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
                  {plan.id === "yearly" && (
                    <li
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: "1px solid rgba(212,168,85,0.15)",
                        color: "#6ee7b7",
                      }}
                    >
                      <span style={{ fontSize: 10, lineHeight: 1.7 }}>🎁</span>
                      <span>{yearlyExtra}</span>
                    </li>
                  )}
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
                ) : (
                  <button
                    onClick={() => setPendingPlan(plan.id)}
                    className="btn-gold"
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      fontSize: 13,
                    }}
                  >
                    {t("選擇此方案", "Choose This Plan")}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ---- Footer links ---- */}
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

      {/* ---- "Coming soon" modal ---- */}
      {pendingPlan && (
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
              {authed
                ? t("金流準備中", "Payment Coming Soon")
                : t("請先登入", "Sign In First")}
            </h3>
            <p
              style={{
                color: "rgba(192,192,208,0.75)",
                fontSize: 13,
                lineHeight: 1.7,
                marginBottom: 20,
              }}
            >
              {authed
                ? t(
                    "訂閱功能即將開放,上線前會以 email 通知。想優先試用可到首頁訂閱電子報。",
                    "Subscription will open shortly — you'll be notified via email when live."
                  )
                : t(
                    "訂閱與點數需要綁定帳號,請先登入。登入送 30 點,老使用者自動補 500 點。",
                    "Subscriptions require an account. Sign in to continue — 30 credits on signup, 500 for existing users."
                  )}
            </p>
            {authed ? (
              <button
                onClick={() => setPendingPlan(null)}
                className="btn-gold"
                style={{ padding: "8px 24px", fontSize: 13 }}
              >
                {t("了解", "Got it")}
              </button>
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
