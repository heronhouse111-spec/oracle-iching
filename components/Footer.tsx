"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIsTWA } from "@/lib/env/useIsTWA";

export default function Footer() {
  const { t } = useLanguage();
  const isTwa = useIsTWA();

  return (
    <footer
      style={{
        borderTop: "1px solid rgba(212,168,85,0.1)",
        padding: "20px 16px 32px",
        marginTop: 48,
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <p
          style={{
            color: "rgba(192,192,208,0.45)",
            fontSize: 11,
            lineHeight: 1.7,
            margin: 0,
            maxWidth: 480,
          }}
        >
          {t(
            "占卜結果僅供娛樂與自我參考,請勿作為投資、醫療、法律或重大人生決策之依據。",
            "Readings are for entertainment and self-reflection only. Not a basis for investment, medical, legal, or major life decisions."
          )}
        </p>

        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            fontSize: 11,
          }}
        >
          {/*
            ⚠ TWA(Google Play 上架的 Android app)內絕對不顯示「加入主畫面」連結。
            Play 政策(anti-steering)禁止 app 內出現引導用戶到 web 版本 / 外部安裝管道的內容。
            isTwa = true 時連連結跟分隔點都隱藏。
          */}
          {!isTwa && (
            <>
              <Link
                href="/install"
                style={{
                  color: "rgba(212,168,85,0.85)",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                ✦ {t("加入主畫面", "Install app")}
              </Link>
              <span style={{ color: "rgba(192,192,208,0.3)" }}>·</span>
            </>
          )}
          <Link
            href="/terms"
            style={{
              color: "rgba(212,168,85,0.75)",
              textDecoration: "none",
            }}
          >
            {t("服務條款", "Terms")}
          </Link>
          <span style={{ color: "rgba(192,192,208,0.3)" }}>·</span>
          <Link
            href="/privacy"
            style={{
              color: "rgba(212,168,85,0.75)",
              textDecoration: "none",
            }}
          >
            {t("隱私權政策", "Privacy")}
          </Link>
          <span style={{ color: "rgba(192,192,208,0.3)" }}>·</span>
          <span style={{ color: "rgba(192,192,208,0.4)" }}>
            © {new Date().getFullYear()} {t("鷺居國際", "Heronhouse")}
          </span>
        </div>
      </div>
    </footer>
  );
}
