"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

// Check if Supabase is configured
const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

export default function AuthButton() {
  const { t } = useLanguage();
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);

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
        title={t("請先設定 Supabase", "Configure Supabase first")}
      >
        {t("登入", "Sign In")}
      </button>
    );
  }

  const handleLogin = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  };

  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setShowMenu(false);
  };

  if (!user) {
    return (
      <button onClick={handleLogin} style={{
        padding: "6px 12px", borderRadius: 9999, border: "1px solid rgba(212,168,85,0.3)",
        color: "#d4a855", fontSize: 12, background: "none", cursor: "pointer",
      }}>
        {t("登入", "Sign In")}
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setShowMenu(!showMenu)} style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "rgba(212,168,85,0.2)", border: "1px solid rgba(212,168,85,0.3)",
        color: "#d4a855", fontSize: 12, fontWeight: 700, cursor: "pointer",
      }}>
        {user.email?.charAt(0).toUpperCase() || "U"}
      </button>
      {showMenu && (
        <div className="mystic-card" style={{
          position: "absolute", right: 0, top: 40, padding: 12, minWidth: 160, zIndex: 50,
        }}>
          <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.email}
          </p>
          <button onClick={handleLogout} style={{
            color: "#d4a855", fontSize: 12, background: "none", border: "none", cursor: "pointer", marginTop: 8,
          }}>
            {t("登出", "Sign Out")}
          </button>
        </div>
      )}
    </div>
  );
}
