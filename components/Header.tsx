"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import AuthButton from "./AuthButton";
import CreditsBadge from "./CreditsBadge";

export default function Header() {
  const { locale, zhVariant, cycleLocale, t } = useLanguage();
  const pathname = usePathname();

  // 三段循環顯示:繁 → 简 → EN → 繁
  const localeBadge =
    locale === "en" ? "EN" : zhVariant === "CN" ? "简" : "繁";
  const localeTitle =
    locale === "en"
      ? "English · click to switch (→ 繁體)"
      : zhVariant === "CN"
        ? "简体中文 · 点击切换 (→ English)"
        : "繁體中文 · 點擊切換 (→ 简体)";

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
      // iOS PWA(加到桌面)會全螢幕 + 狀態列透明疊在頁面上;沒這行 logo 會被 notch / 時間蓋掉。
      // 非 PWA 的 Safari tab 下,safe-area-inset-top 回傳 0,對正常網頁無影響。
      paddingTop: "env(safe-area-inset-top)",
    }}>
      <div style={{
        maxWidth: 640, margin: "0 auto",
        // 橫向 iPhone 時 safe-area-inset-left/right 會非 0(notch 在左側或右側),
        // 用 max() 保留至少 16px 的視覺呼吸空間。
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
        height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" onClick={handleHomeClick} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Image
            src="/logo-64.png"
            alt={t("易問", "Oracle")}
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
            {t("易問", "Oracle")}
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CreditsBadge />
          <Link href="/history" style={{ color: "#c0c0d0", fontSize: 14, textDecoration: "none" }}>
            {t("占卜紀錄", "History")}
          </Link>
          <button
            onClick={cycleLocale}
            title={localeTitle}
            aria-label={localeTitle}
            style={{
              padding: "6px 12px", borderRadius: 9999, border: "1px solid rgba(212,168,85,0.3)",
              color: "#d4a855", fontSize: 12, background: "none", cursor: "pointer",
              minWidth: 44, textAlign: "center",
            }}
          >
            {localeBadge}
          </button>
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
