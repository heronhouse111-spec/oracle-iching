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
  SUBSCRIPTION_BENEFITS_BY_LOCALE,
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
        text: t(
          "終身方案不在此提供",
          "Lifetime not available here",
          "ライフタイムプランはこちらでは利用できません",
          "라이프타임 플랜은 여기서 이용할 수 없습니다"
        ),
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
        text: t(
          "訂閱成功!權益已啟用",
          "Subscribed — benefits active",
          "サブスク登録完了 — 特典が有効になりました",
          "구독 완료 — 혜택이 활성화되었습니다"
        ),
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

  const benefits = SUBSCRIPTION_BENEFITS_BY_LOCALE[locale];

  const planLabel = (id: SubscriptionPlanId) => {
    switch (id) {
      case "monthly":
        return t("月訂閱", "Monthly", "月額プラン", "월간 플랜");
      case "yearly":
        return t("年訂閱", "Yearly", "年額プラン", "연간 플랜");
      case "lifetime":
        return t("終身方案", "Lifetime", "ライフタイム", "라이프타임");
    }
  };

  const periodLabel = (id: SubscriptionPlanId) => {
    switch (id) {
      case "monthly":
        return t("/ 月", "/ month", "/ 月", "/ 월");
      case "yearly":
        return t("/ 年", "/ year", "/ 年", "/ 년");
      case "lifetime":
        return t("一次付清", "one-time", "一括払い", "일시 결제");
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
          {t(
            "升級訂閱",
            "Upgrade Subscription",
            "サブスクをアップグレード",
            "구독 업그레이드"
          )}
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
            "Unlock the full experience with 600 credits refilled every month.",
            "全機能をアンロック。毎月 600 ポイント自動補充で、ポイント切れの心配なし。",
            "전체 혜택 잠금 해제. 매월 600 포인트 자동 충전으로 포인트 걱정 없이 점치기."
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
              {t(
                "你目前的方案",
                "Your current plan",
                "現在のプラン",
                "현재 플랜"
              )}:
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
                    {t("推薦", "RECOMMENDED", "おすすめ", "추천")}
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
                    {(() => {
                      const monthly = formatPrice(
                        currency === "TWD" ? Math.round(perMonth) : Number(perMonth.toFixed(2)),
                        currency
                      );
                      return t(
                        `相當於 ${monthly} / 月,省 20%`,
                        `≈ ${monthly} / month · save 20%`,
                        `≈ ${monthly} / 月 · 20% お得`,
                        `≈ ${monthly} / 월 · 20% 절약`
                      );
                    })()}
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
                      "Pay once, lifetime access",
                      "一度のお支払いで永久会員",
                      "한 번 결제로 평생 회원"
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
                    ✓ {t("目前方案", "Current Plan", "現在のプラン", "현재 플랜")}
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
                    {t("已停售", "Discontinued", "販売終了", "판매 종료")}
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
                      ? t("處理中…", "Processing…", "処理中…", "처리 중…")
                      : t(
                          "選擇此方案",
                          "Choose This Plan",
                          "このプランを選ぶ",
                          "이 플랜 선택"
                        )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        )}

        {/* ---- 適合誰對照表 —— 幫使用者判斷該選訂閱還是加購包 ----
             加在方案 grid 跟「看加購包」按鈕之間,讓重度用戶看完價格時,
             立刻被「我每月占 > 40 次」的描述對到,主動轉訂閱。 */}
        <div
          className="mystic-card"
          style={{
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              color: "#d4a855",
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 15,
              textAlign: "center",
              marginBottom: 14,
              letterSpacing: 0.5,
            }}
          >
            {t(
              "✦ 我該選訂閱還是加購包?",
              "✦ Subscription or Credit Pack?",
              "✦ サブスクとポイントパック、どちらを選ぶ?",
              "✦ 구독과 포인트 팩, 어느 쪽을 선택할까요?"
            )}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "10px 14px",
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "rgba(232,232,240,0.85)",
            }}
          >
            <div style={{ color: "#d4a855", fontWeight: 600, whiteSpace: "nowrap" }}>
              {t("每月 < 20 次", "< 20 / month", "月 20 回未満", "월 20회 미만")}
            </div>
            <div style={{ color: "rgba(192,192,208,0.85)" }}>
              {t(
                "加購包就夠了 — 200 點 NT$120 約可占 40 次,用完再買",
                "Credit pack is enough — 200 credits for NT$120 covers ~40 readings.",
                "ポイントパックで十分 — 200 ポイント NT$120 で約 40 回",
                "포인트 팩이면 충분 — 200 포인트 NT$120 로 약 40회"
              )}
            </div>

            <div style={{ color: "#d4a855", fontWeight: 600, whiteSpace: "nowrap" }}>
              {t("每月 20-40 次", "20-40 / month", "月 20-40 回", "월 20-40회")}
            </div>
            <div style={{ color: "rgba(192,192,208,0.85)" }}>
              {t(
                "兩者皆可 — 想要無浮水印分享、premium 占卜師、Deep Insight 就訂閱",
                "Either works — subscribe if you want watermark-free shares, premium readers, or Deep Insight.",
                "どちらでも可 — 透かしなし共有 / Premium 占い師 / Deep Insight が欲しいならサブスク",
                "둘 다 가능 — 워터마크 없는 공유 / 프리미엄 점술사 / Deep Insight 원하면 구독"
              )}
            </div>

            <div style={{ color: "#6ee7b7", fontWeight: 600, whiteSpace: "nowrap" }}>
              {t("每月 > 40 次", "> 40 / month", "月 40 回以上", "월 40회 이상")}
            </div>
            <div style={{ color: "rgba(232,232,240,0.95)" }}>
              {t(
                "月訂閱 NT$150 最划算 — 等於每點 NT$0.25,比加購包便宜 40%+",
                "Monthly subscription wins — NT$0.25 per credit, 40%+ cheaper than packs.",
                "月額プランがお得 — 1 ポイント NT$0.25、パックより 40%+ 安い",
                "월간 구독이 가장 저렴 — 1 포인트 NT$0.25, 팩보다 40%+ 저렴"
              )}
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid rgba(212,168,85,0.15)",
              fontSize: 11,
              color: "rgba(192,192,208,0.55)",
              lineHeight: 1.55,
              textAlign: "center",
            }}
          >
            {t(
              "註:1 次易經 / 塔羅占卜 = 5 點;衍伸占卜 10 點;Yes/No 2 點",
              "Note: 1 reading = 5 credits; follow-up = 10; Yes/No = 2",
              "備考:占い 1 回 = 5 ポイント;フォローアップ = 10;Yes/No = 2",
              "참고: 점 1회 = 5 포인트; 후속 점 = 10; Yes/No = 2"
            )}
          </div>
        </div>

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
              "Just occasional use? Try credit packs instead.",
              "たまに占うだけ?ポイントパックの単発購入もできます。",
              "가끔만 점치시나요? 단회 포인트 팩 구매를 이용하세요."
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
            {t(
              "看加購包 →",
              "See Credit Packs →",
              "ポイントパックを見る →",
              "포인트 팩 보기 →"
            )}
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
            ← {t(
              "返回會員頁",
              "Back to account",
              "アカウントに戻る",
              "계정으로 돌아가기"
            )}
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
        title={t(
          "登入即可完成訂閱",
          "Sign in to complete your subscription",
          "ログインで登録を完了",
          "로그인하여 구독 완료"
        )}
        subtitle={t(
          "登入後會自動帶你進入訂閱結帳頁",
          "We'll take you straight to checkout after sign-in"
        )}
      />
    </div>
  );
}
