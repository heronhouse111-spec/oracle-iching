"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import {
  CREDIT_PACKS,
  formatTwd,
  type CreditPackId,
} from "@/lib/pricing";

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

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [refillsAt, setRefillsAt] = useState<string | null>(null);
  const [pendingPack, setPendingPack] = useState<CreditPackId | null>(null);

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

        {/* ---- Pack grid ---- */}
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
                  {formatTwd(pack.priceTwd)}
                </div>
                <button
                  onClick={() => setPendingPack(pack.id)}
                  className="btn-gold"
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    fontSize: 13,
                  }}
                >
                  {t("購買", "Purchase")}
                </button>
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
      {pendingPack && (
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
                    "購買功能即將開放,上線前會以 email 通知。現階段登入即贈 30 點,老使用者已自動補 500 點。",
                    "Credit purchase will open shortly — you'll be notified via email. Meanwhile, signup grants 30 credits; existing users have been topped up with 500."
                  )
                : t(
                    "購買點數需要綁定帳號。登入即贈 30 點,老使用者自動補 500 點。",
                    "Purchases require an account. Sign in for 30 bonus credits (500 for returning users)."
                  )}
            </p>
            {authed ? (
              <button
                onClick={() => setPendingPack(null)}
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
