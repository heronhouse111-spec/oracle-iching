"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Link from "next/link";
import AuthButton from "./AuthButton";

export default function Header() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(10,10,26,0.8)", backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(212,168,85,0.1)",
    }}>
      <div style={{
        maxWidth: 640, margin: "0 auto", padding: "0 16px",
        height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <span style={{ fontSize: 22, letterSpacing: 1 }}>☯&nbsp;🎴</span>
          <span className="text-gold-gradient" style={{ fontFamily: "'Noto Serif TC', serif", fontWeight: 700, fontSize: 18 }}>
            {t("Oracle 神諭", "Oracle")}
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/history" style={{ color: "#c0c0d0", fontSize: 14, textDecoration: "none" }}>
            {t("占卜紀錄", "History")}
          </Link>
          <button
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            style={{
              padding: "6px 12px", borderRadius: 9999, border: "1px solid rgba(212,168,85,0.3)",
              color: "#d4a855", fontSize: 12, background: "none", cursor: "pointer",
            }}
          >
            {locale === "zh" ? "EN" : "中"}
          </button>
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
