"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import AuthButton from "./AuthButton";
import CreditsBadge from "./CreditsBadge";

export default function Header() {
  const { locale, setLocale, t } = useLanguage();
  const pathname = usePathname();

  // 已在首頁時點 logo,Link 不會 remount app/page.tsx,
  // 占卜過程的 step / userQuestion 等 state 會留著 → 看起來像沒反應。
  // 改走 hard navigation 強制清空狀態回到 category 起始畫面。
  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/") {
      e.preventDefault();
      window.location.assign("/");
    }
  };

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
        <Link href="/" onClick={handleHomeClick} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Image
            src="/logo-64.png"
            alt={t("Oracle 問事", "Oracle")}
            width={36}
            height={36}
            priority
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "block",
              boxShadow: "0 0 12px rgba(212,168,85,0.35)",
            }}
          />
          <span className="text-gold-gradient" style={{ fontFamily: "'Noto Serif TC', serif", fontWeight: 700, fontSize: 18 }}>
            {t("Oracle 問事", "Oracle")}
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CreditsBadge />
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
