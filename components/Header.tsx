"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import Link from "next/link";
import AuthButton from "./AuthButton";
import CreditsBadge from "./CreditsBadge";
import LocaleDropdown from "./LocaleDropdown";
import HomeMenu from "./HomeMenu";

export default function Header() {
  const { t } = useLanguage();

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
        <HomeMenu />

        <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CreditsBadge />
          <Link href="/history" style={{ color: "#c0c0d0", fontSize: 14, textDecoration: "none" }}>
            {t("占卜紀錄", "History", "占い履歴", "점 기록")}
          </Link>
          <LocaleDropdown />
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
