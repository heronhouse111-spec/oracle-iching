"use client";

/**
 * TwaPurchaseNotice —— TWA 殼內代替 in-app purchase UI 的靜態告示卡。
 *
 * 為何這樣寫:
 *   Google Play Billing 政策禁止我們在 Play 上架的 app 內:
 *     (a) 顯示可點擊的購買按鈕,且
 *     (b) 將使用者導向外部付款流程
 *   因此這張卡只有「告知 + 純文字 URL」,不放可點的按鈕或自動 redirect。
 *   使用者看到資訊,決定自行開瀏覽器前往網頁版。
 *
 * 使用方式:
 *   當 useIsTWA() === true 時,以這個 component 取代 /account/credits 或
 *   /account/upgrade 內的 pricing grid + 購買 modal。
 */

import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  kind: "credits" | "subscription";
}

const WEB_URL = "oracle.heronhouse.me";

export default function TwaPurchaseNotice({ kind }: Props) {
  const { t } = useLanguage();

  const title =
    kind === "credits"
      ? t("點數購買僅於網頁版", "Credit Purchase — Web Only")
      : t("訂閱管理僅於網頁版", "Subscription — Web Only");

  const body =
    kind === "credits"
      ? t(
          "為配合 Google Play 政策,點數購買僅在網頁版開放。請於瀏覽器開啟下方網址完成購買,購買後再回到 App,點數會自動同步。",
          "Due to Google Play policy, credit purchases are only available on the web. Please open the URL below in your browser to complete a purchase — credits will sync automatically."
        )
      : t(
          "為配合 Google Play 政策,訂閱方案目前僅在網頁版開放。請於瀏覽器開啟下方網址查看與管理訂閱,App 端會自動套用訂閱狀態。",
          "Due to Google Play policy, subscription management is only available on the web. Please open the URL below in your browser — the App will mirror your subscription automatically."
        );

  return (
    <div
      className="mystic-card"
      style={{
        padding: 28,
        textAlign: "center",
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12, color: "#d4a855" }}>
        {kind === "credits" ? "✦" : "☯"}
      </div>
      <h2
        className="text-gold-gradient"
        style={{
          fontFamily: "'Noto Serif TC', serif",
          fontSize: 18,
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          color: "rgba(192,192,208,0.75)",
          fontSize: 13,
          lineHeight: 1.75,
          marginBottom: 20,
          maxWidth: 440,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {body}
      </p>
      <div
        style={{
          display: "inline-block",
          padding: "10px 20px",
          borderRadius: 10,
          border: "1px solid rgba(212,168,85,0.35)",
          background: "rgba(212,168,85,0.06)",
          color: "#d4a855",
          fontFamily: "'SF Mono', Menlo, monospace",
          fontSize: 14,
          letterSpacing: 0.4,
          userSelect: "all",
        }}
      >
        {WEB_URL}
      </div>
      <p
        style={{
          color: "rgba(192,192,208,0.45)",
          fontSize: 11,
          marginTop: 14,
          lineHeight: 1.6,
        }}
      >
        {t(
          "長按可複製網址",
          "Long-press the address above to copy"
        )}
      </p>
    </div>
  );
}
