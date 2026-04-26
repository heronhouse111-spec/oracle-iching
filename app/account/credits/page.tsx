"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import { useIsTWA } from "@/lib/env/useIsTWA";
import { useCurrency } from "@/lib/geo/useCurrency";
import {
  CREDIT_PACKS,
  formatPriceOf,
  type CreditPackId,
} from "@/lib/pricing";
import {
  isPlayBillingAvailable,
  purchaseCreditPack,
} from "@/lib/billing/playBilling";

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

interface BalanceResponse {
  balance: number | null;
  refillsAt: string | null;
  authenticated: boolean;
}

export default function CreditsPurchasePage() {
  const { locale, t } = useLanguage();
  const isTwa = useIsTWA();
  const { currency } = useCurrency();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [refillsAt, setRefillsAt] = useState<string | null>(null);
  const [pendingPack, setPendingPack] = useState<CreditPackId | null>(null);

  // Play Billing 進行中的 pack id(顯示 loading + disable 按鈕)
  const [playPurchasing, setPlayPurchasing] = useState<CreditPackId | null>(null);
  // Play Billing 成功 / 失敗訊息
  const [playToast, setPlayToast] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  // Web 端 ECPay 結帳:loading 中 pack id(避免 double-click)
  const [ecpayLoading, setEcpayLoading] = useState<CreditPackId | null>(null);
  const [ecpayError, setEcpayError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthed(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/credits/balance", {
          cache: "no-store",
        });
        if (!res.ok) {
          setAuthed(false);
          return;
        }
        const data: BalanceResponse = await res.json();
        setAuthed(data.authenticated);
        setBalance(data.balance);
        setRefillsAt(data.refillsAt);
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  const mainStyle = {
    paddingTop: 80,
    paddingBottom: 48,
    paddingLeft: 16,
    paddingRight: 16,
    maxWidth: 720,
    margin: "0 auto",
  } as const;

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(
      locale === "zh" ? "zh-TW" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
  };

  /**
   * TWA 殼內透過 Play Billing 購買點數。
   * 跟 web 不同:
   *   - 不打開「金流準備中」modal,直接觸發 Google 內建付款 UI
   *   - 成功後 backend 已補點,我們只要重抓餘額顯示
   */
  const handlePlayPurchase = async (packId: CreditPackId) => {
    if (!authed) {
      // 未登入,引導去登入
      setPlayToast({
        kind: "error",
        text: t("請先登入帳號再購買", "Please sign in before purchasing"),
      });
      return;
    }
    setPlayPurchasing(packId);
    setPlayToast(null);
    try {
      const result = await purchaseCreditPack(packId);
      if (!result.ok) {
        if (result.code === "user_canceled") {
          // 使用者自己取消,不顯示錯誤
          return;
        }
        setPlayToast({
          kind: "error",
          text: t(
            `購買失敗:${result.error}`,
            `Purchase failed: ${result.error}`
          ),
        });
        return;
      }
      // 成功 → 重抓餘額
      try {
        const res = await fetch("/api/credits/balance", { cache: "no-store" });
        if (res.ok) {
          const data: BalanceResponse = await res.json();
          setBalance(data.balance);
          setRefillsAt(data.refillsAt);
        }
      } catch {
        /* 餘額拉失敗也沒關係,下次重整就有 */
      }
      setPlayToast({
        kind: "success",
        text: t("購買成功!點數已補入帳號", "Purchase complete — credits added"),
      });
    } finally {
      setPlayPurchasing(null);
    }
  };

  // TWA 環境下偵測 Play Billing 是否可用(有些舊版 Chrome 沒 Digital Goods API)
  const [playReady, setPlayReady] = useState(false);
  useEffect(() => {
    if (isTwa) setPlayReady(isPlayBillingAvailable());
  }, [isTwa]);

  /**
   * Web 端走 ECPay 結帳 —— 打 /api/billing/ecpay/checkout 拿 hub checkoutUrl,
   * 然後 window.location.assign 跳過去(hub 會 auto-submit ECPay form)。
   */
  const handleEcpayCheckout = async (packId: CreditPackId) => {
    if (!authed) {
      setEcpayError(t("請先登入帳號再購買", "Please sign in before purchasing"));
      return;
    }
    setEcpayLoading(packId);
    setEcpayError(null);
    try {
      const res = await fetch("/api/billing/ecpay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "credits", packId }),
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
      // 跳到 hub checkout 頁,hub 會 auto-submit 到綠界
      window.location.assign(checkoutUrl);
    } catch (e) {
      setEcpayError(
        t(
          `網路錯誤:${e instanceof Error ? e.message : String(e)}`,
          `Network error: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    } finally {
      // 跳轉中,通常使用者不會看到 loading 狀態被重置
      setEcpayLoading(null);
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
          {t("購買點數", "Purchase Credits")}
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
            "每次 AI 占卜分析扣 5 點、衍伸問卜扣 10 點、追問每則 1 點",
            "Main divination costs 5 credits; follow-up reading 10; each chat message 1."
          )}
        </p>

        {/* ---- Current balance (only for signed-in users) ---- */}
        {authed && balance !== null && (
          <div
            className="mystic-card"
            style={{
              padding: 20,
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  color: "rgba(192,192,208,0.5)",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                {t("目前餘額", "Current Balance")}
              </div>
              <div
                style={{
                  color: "#d4a855",
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 28,
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: 16, marginRight: 6 }}>✦</span>
                {balance}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  color: "rgba(192,192,208,0.5)",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                {t("下次補點", "Next Refill")}
              </div>
              <div
                style={{
                  color: "rgba(192,192,208,0.9)",
                  fontSize: 13,
                }}
              >
                {formatDate(refillsAt)}
              </div>
            </div>
          </div>
        )}

        {/* ---- Signed-out hint ---- */}
        {authed === false && (
          <div
            className="mystic-card"
            style={{
              padding: 16,
              marginBottom: 24,
              textAlign: "center",
              background: "rgba(212,168,85,0.05)",
              border: "1px solid rgba(212,168,85,0.25)",
            }}
          >
            <span
              style={{
                color: "rgba(212,168,85,0.9)",
                fontSize: 12,
                lineHeight: 1.7,
              }}
            >
              {t(
                "登入後可查看目前餘額、下次補點時間",
                "Sign in to see your current balance and next refill date"
              )}
            </span>
          </div>
        )}

        {/* ---- TWA toast(購買結果通知) ---- */}
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
              color:
                playToast.kind === "success" ? "#6ee7b7" : "#fca5a5",
              fontSize: 13,
            }}
          >
            {playToast.text}
          </div>
        )}

        {/* ---- TWA: Play Billing 不可用警示 ---- */}
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

        {/* ---- Web ECPay 錯誤訊息 ---- */}
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

        {/* ---- Currency switcher (web only) ---- */}
        {!isTwa && <CurrencySwitcher />}

        {/* ---- Pack grid (TWA + web 都顯示;onClick 行為依環境分流) ---- */}
        {(
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {CREDIT_PACKS.map((pack) => {
            return (
              <div
                key={pack.id}
                className="mystic-card"
                style={{
                  padding: 20,
                  position: "relative",
                  border: pack.highlighted
                    ? "1px solid rgba(212,168,85,0.6)"
                    : undefined,
                  boxShadow: pack.highlighted
                    ? "0 0 30px rgba(212,168,85,0.2)"
                    : undefined,
                }}
              >
                {pack.highlighted && (
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
                    {t("最划算", "BEST VALUE")}
                  </div>
                )}
                <div
                  style={{
                    color: "rgba(192,192,208,0.5)",
                    fontSize: 11,
                    marginBottom: 8,
                    textAlign: "center",
                  }}
                >
                  {t("加購包", "Credit Pack")}
                </div>
                <div
                  className="text-gold-gradient"
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: 30,
                    fontWeight: 700,
                    textAlign: "center",
                    marginBottom: 4,
                  }}
                >
                  {pack.credits}
                  <span
                    style={{
                      fontSize: 14,
                      marginLeft: 4,
                      color: "rgba(192,192,208,0.8)",
                      WebkitTextFillColor: "rgba(192,192,208,0.8)",
                      backgroundImage: "none",
                    }}
                  >
                    {t("點", "pts")}
                  </span>
                </div>
                {pack.bonusCredits > 0 ? (
                  <div
                    style={{
                      color: "#6ee7b7",
                      fontSize: 12,
                      textAlign: "center",
                      marginBottom: 12,
                    }}
                  >
                    {t(
                      `＋贈 ${pack.bonusCredits} 點`,
                      `+${pack.bonusCredits} bonus`
                    )}
                  </div>
                ) : (
                  <div style={{ height: 12, marginBottom: 12 }} />
                )}
                <div
                  style={{
                    textAlign: "center",
                    color: "#d4a855",
                    fontSize: 20,
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  {/* TWA 內價格由 Play Store 在地化顯示(未來可從 fetchSkuDetails 拉,
                       目前先用 lib/pricing.ts 的硬編碼;Play 後台一致即可) */}
                  {formatPriceOf(pack.price, currency)}
                </div>
                <button
                  onClick={() => {
                    if (isTwa) {
                      handlePlayPurchase(pack.id);
                    } else {
                      handleEcpayCheckout(pack.id);
                    }
                  }}
                  disabled={
                    (isTwa && (!playReady || playPurchasing !== null)) ||
                    (!isTwa && ecpayLoading === pack.id)
                  }
                  className="btn-gold"
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    fontSize: 13,
                    opacity:
                      (isTwa && (!playReady || playPurchasing !== null)) ||
                      (!isTwa && ecpayLoading === pack.id)
                        ? 0.5
                        : 1,
                    cursor:
                      (isTwa && (!playReady || playPurchasing !== null)) ||
                      (!isTwa && ecpayLoading === pack.id)
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {playPurchasing === pack.id || ecpayLoading === pack.id
                    ? t("處理中…", "Processing…")
                    : t("購買", "Purchase")}
                </button>
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
              "想改成月 / 年訂閱、省更多?",
              "Want monthly / yearly subscriptions for deeper savings?"
            )}
          </div>
          <Link
            href="/account/upgrade"
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
            {t("看訂閱方案 →", "See Subscription Plans →")}
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

      {/* ---- "Coming soon" modal (web only — TWA has no purchase trigger) ---- */}
      {!isTwa && pendingPack && (
        <div
          onClick={() => setPendingPack(null)}
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
              {authed ? "✦" : "🔐"}
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
                    "購買點數需要綁定帳號。登入即贈 30 點,老使用者自動補 500 點。",
                    "Purchases require an account. Sign in for 30 bonus credits (500 for returning users)."
                  )
                : currency === "USD"
                ? t(
                    "國際信用卡(USD)支付正在整合中。您可以切換到 NT$ 使用台灣金流,或等我們 email 通知。現階段登入即贈 30 點。",
                    "International (USD) payment is being integrated. Switch to NT$ to use the Taiwan payment rail, or we'll email you when USD goes live. Signup grants 30 credits."
                  )
                : t(
                    "購買功能即將開放,上線前會以 email 通知。現階段登入即贈 30 點,老使用者已自動補 500 點。",
                    "Credit purchase will open shortly — you'll be notified via email. Meanwhile, signup grants 30 credits; existing users have been topped up with 500."
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
                  onClick={() => setPendingPack(null)}
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
                  onClick={() => setPendingPack(null)}
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
