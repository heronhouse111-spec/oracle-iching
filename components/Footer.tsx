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
            "Readings are for entertainment and self-reflection only. Not a basis for investment, medical, legal, or major life decisions.",
            "占い結果は娯楽と自己省察のためのものです。投資・医療・法律・人生の重要な決断の根拠にしないでください。",
            "점괘는 오락과 자기 성찰용입니다. 투자·의료·법률·인생의 중대한 결정의 근거로 삼지 마세요."
          )}
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
            fontSize: 11,
            marginTop: 4,
            marginBottom: 4,
          }}
        >
          <Link href="/blog" style={{ color: "rgba(212,168,85,0.75)", textDecoration: "none" }}>
            {t("部落格", "Blog", "ブログ", "블로그")}
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            fontSize: 11,
          }}
        >
          {/*
            注意:TWA(Google Play 上架的 Android app)內絕對不顯示「加入主畫面」連結。
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
                ✦ {t("加入主畫面", "Install app", "ホーム画面に追加", "홈 화면에 추가")}
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
            {t("服務條款", "Terms", "利用規約", "이용약관")}
          </Link>
          <span style={{ color: "rgba(192,192,208,0.3)" }}>·</span>
          <Link
            href="/privacy"
            style={{
              color: "rgba(212,168,85,0.75)",
              textDecoration: "none",
            }}
          >
            {t("隱私權政策", "Privacy", "プライバシー", "개인정보")}
          </Link>
          <span style={{ color: "rgba(192,192,208,0.3)" }}>·</span>
          <span style={{ color: "rgba(192,192,208,0.4)" }}>
            © {new Date().getFullYear()} {t("鷺居國際", "Heronhouse", "鷺居國際", "Heronhouse")}
          </span>
        </div>
      </div>
    </footer>
  );
}
