"use client";

/**
 * /account/international-soon —— 國際(USD)支付 placeholder 頁。
 *
 * 用途:當使用者在 /account/credits 或 /account/upgrade 以 USD 幣別嘗試結帳時,
 * 給一個比 modal 更完整的落地頁,說明:
 *   - 國際支付整合中
 *   - 暫時可切回 NT$ 使用綠界
 *   - 可留 email 等通知
 *   - 若急需,提供 PayPal manual 轉帳窗口(mailto)
 */

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import CurrencySwitcher from "@/components/CurrencySwitcher";

export default function InternationalSoonPage() {
  const { t } = useLanguage();

  const mainStyle = {
    paddingTop: 80,
    paddingBottom: 48,
    paddingLeft: 16,
    paddingRight: 16,
    maxWidth: 640,
    margin: "0 auto",
  } as const;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <main style={mainStyle}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 40 }}>🌐</span>
        </div>
        <h1
          className="text-gold-gradient"
          style={{
            fontSize: 24,
            fontFamily: "'Noto Serif TC', serif",
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          {t(
            "國際支付即將推出",
            "International Payment Coming Soon"
          )}
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "rgba(192,192,208,0.7)",
            fontSize: 13,
            lineHeight: 1.8,
            marginBottom: 24,
          }}
        >
          {t(
            "我們正在整合國際信用卡(USD)結帳。上線前,你可以選擇下列任一方式繼續使用。",
            "We're integrating international credit card (USD) checkout. In the meantime, any of the options below will let you keep using the service."
          )}
        </p>

        {/* Option 1: switch to NT$ */}
        <div className="mystic-card" style={{ padding: 20, marginBottom: 16 }}>
          <h2
            style={{
              color: "#d4a855",
              fontSize: 15,
              fontFamily: "'Noto Serif TC', serif",
              marginBottom: 8,
            }}
          >
            {t("方案一:切換為 NT$(推薦)", "Option 1: Switch to NT$ (recommended)")}
          </h2>
          <p
            style={{
              color: "rgba(192,192,208,0.75)",
              fontSize: 13,
              lineHeight: 1.7,
              marginBottom: 14,
            }}
          >
            {t(
              "若你持有能跨幣別結帳的信用卡(Visa / Mastercard / JCB),可直接切換為新台幣,使用我們的台灣金流。注意:海外發卡行對 TWD 交易的成功率不一,若失敗建議改選其他方案。",
              "If your card supports cross-currency charging (Visa / Mastercard / JCB), switch to TWD and use our Taiwan payment rail. Note that some foreign-issued cards decline TWD charges — if that happens, try another option below."
            )}
          </p>
          <CurrencySwitcher />
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 10 }}>
            <Link
              href="/account/credits"
              style={{
                padding: "8px 16px",
                borderRadius: 9999,
                border: "1px solid rgba(212,168,85,0.4)",
                color: "#d4a855",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              {t("加購點數", "Credit Packs")}
            </Link>
            <Link
              href="/account/upgrade"
              style={{
                padding: "8px 16px",
                borderRadius: 9999,
                border: "1px solid rgba(212,168,85,0.4)",
                color: "#d4a855",
                fontSize: 12,
                textDecoration: "none",
              }}
            >
              {t("訂閱方案", "Subscription Plans")}
            </Link>
          </div>
        </div>

        {/* Option 2: email notify */}
        <div className="mystic-card" style={{ padding: 20, marginBottom: 16 }}>
          <h2
            style={{
              color: "#d4a855",
              fontSize: 15,
              fontFamily: "'Noto Serif TC', serif",
              marginBottom: 8,
            }}
          >
            {t("方案二:上線時 email 通知", "Option 2: Email me when it's live")}
          </h2>
          <p
            style={{
              color: "rgba(192,192,208,0.75)",
              fontSize: 13,
              lineHeight: 1.7,
              marginBottom: 14,
            }}
          >
            {t(
              "點下方按鈕寫信給我們,主旨內建「NOTIFY-USD」,我們上線當天寄通知。",
              "Tap the button below to email us. The subject line is pre-filled with \"NOTIFY-USD\" — we'll email you back the day it goes live."
            )}
          </p>
          <a
            href="mailto:oracle@heronhouse.me?subject=NOTIFY-USD%20International%20payment&body=Hi%2C%20please%20notify%20me%20when%20USD%20checkout%20is%20live.%20Thanks!"
            className="btn-gold"
            style={{
              display: "inline-block",
              padding: "8px 18px",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {t("寫信通知我", "Email me when live")}
          </a>
        </div>

        {/* Option 3: manual PayPal (high-touch) */}
        <div className="mystic-card" style={{ padding: 20, marginBottom: 24 }}>
          <h2
            style={{
              color: "#d4a855",
              fontSize: 15,
              fontFamily: "'Noto Serif TC', serif",
              marginBottom: 8,
            }}
          >
            {t("方案三:PayPal 手動匯款", "Option 3: Manual PayPal (concierge)")}
          </h2>
          <p
            style={{
              color: "rgba(192,192,208,0.75)",
              fontSize: 13,
              lineHeight: 1.7,
              marginBottom: 14,
            }}
          >
            {t(
              "若急用,寫信說明你要的方案(加購包 / 訂閱)與登入信箱,我們會用 PayPal 發請款單,收款後手動補點。通常同日內處理。",
              "If you need credits urgently, email us with your chosen pack or subscription plan and your login email. We'll send you a PayPal invoice, then top up your account manually once paid. Usually same-day."
            )}
          </p>
          <a
            href="mailto:oracle@heronhouse.me?subject=MANUAL-USD%20Payment%20Request&body=Hi%2C%20I%27d%20like%20to%20pay%20via%20PayPal.%0A%0ALogin%20email%3A%20%3Cyour-email%3E%0APlan%20or%20pack%3A%20%3Ce.g.%20pack_500%20%2F%20monthly%3E"
            style={{
              display: "inline-block",
              padding: "8px 18px",
              borderRadius: 9999,
              border: "1px solid rgba(212,168,85,0.4)",
              color: "#d4a855",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            {t("寫信請款", "Email for invoice")}
          </a>
        </div>

        <div style={{ textAlign: "center" }}>
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
    </div>
  );
}
