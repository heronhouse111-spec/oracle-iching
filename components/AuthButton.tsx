"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import LoginOptionsModal from "./LoginOptionsModal";

// Line 目前尚未在 Supabase 後台啟用(需 Pro plan 接 Custom OIDC),以 env 開關控制
const LINE_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_LINE_LOGIN_ENABLED === "true";

// Check if Supabase is configured
const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

export default function AuthButton() {
  const { t } = useLanguage();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    // Lazy import supabase client only when configured
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
      supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user ?? null);
      });
    });
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <button
        style={{
          padding: "6px 12px", borderRadius: 9999, border: "1px solid rgba(212,168,85,0.2)",
          color: "rgba(212,168,85,0.4)", fontSize: 12, background: "none", cursor: "default",
        }}
        title={t(
          "請先設定 Supabase",
          "Configure Supabase first",
          "Supabase の設定が必要です",
          "Supabase 설정이 필요합니다"
        )}
      >
        {t("登入", "Sign In", "ログイン", "로그인")}
      </button>
    );
  }

  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setShowMenu(false);
  };

  if (!user) {
    return (
      <>
        <button onClick={() => setLoginOpen(true)} style={{
          padding: "6px 12px", borderRadius: 9999, border: "1px solid rgba(212,168,85,0.3)",
          color: "#d4a855", fontSize: 12, background: "none", cursor: "pointer",
        }}>
          {t("登入", "Sign In", "ログイン", "로그인")}
        </button>
        <LoginOptionsModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          lineEnabled={LINE_ENABLED}
        />
      </>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        aria-label={t(
          "已登入使用者選單",
          "Signed-in user menu",
          "ログイン中のユーザーメニュー",
          "로그인된 사용자 메뉴"
        )}
        title={user.email ?? t("已登入", "Signed in", "ログイン中", "로그인됨")}
        style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "rgba(212,168,85,0.2)", border: "1px solid rgba(212,168,85,0.3)",
          color: "#d4a855", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: 0,
        }}
      >
        {/* 簡潔人像:頭圓 + 肩弧,一眼讀成「已登入」 */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </svg>
      </button>
      {showMenu && (
        <div className="mystic-card" style={{
          position: "absolute", right: 0, top: 40, padding: 12, minWidth: 180, zIndex: 50,
        }}>
          <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
            {user.email}
          </p>
          <Link
            href="/account"
            onClick={() => setShowMenu(false)}
            style={{
              display: "block",
              color: "#d4a855",
              fontSize: 12,
              marginTop: 10,
              paddingTop: 8,
              borderTop: "1px solid rgba(212,168,85,0.1)",
              textDecoration: "none",
            }}
          >
            {t("我的會員", "My Account", "マイアカウント", "내 계정")} →
          </Link>
          <button onClick={handleLogout} style={{
            color: "#d4a855", fontSize: 12, background: "none", border: "none", cursor: "pointer",
            marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(212,168,85,0.1)",
            width: "100%", textAlign: "left",
          }}>
            {t("登出", "Sign Out", "ログアウト", "로그아웃")}
          </button>
        </div>
      )}
    </div>
  );
}
