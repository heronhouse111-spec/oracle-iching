"use client";

/**
 * Admin 左側固定側欄。取代原本頂部 pill nav,改成 BBQ 後台風格 —
 * 品牌區 + 分組選單 + 底部使用者卡片。
 *
 * Desktop: 固定 240px,主內容靠 padding-left 推開。
 * Mobile (<900px): 整條退場,改用浮動漢堡按鈕展開 drawer。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    title: "主要",
    items: [{ href: "/admin", icon: "📊", label: "儀表板" }],
  },
  {
    title: "內容管理",
    items: [
      { href: "/admin/blog", icon: "📝", label: "部落格" },
      { href: "/admin/personas", icon: "🧙", label: "占卜師" },
      { href: "/admin/inspirations", icon: "✦", label: "問題靈感" },
      { href: "/admin/collection-milestones", icon: "🎯", label: "收集里程碑" },
      { href: "/admin/collection-hub", icon: "📜", label: "收藏中心文案" },
      { href: "/admin/ui-images", icon: "🖼️", label: "首頁 icon" },
      { href: "/admin/iching-images", icon: "☯", label: "易經卦圖" },
      { href: "/admin/announcements", icon: "📢", label: "公告" },
    ],
  },
  {
    title: "用戶與商務",
    items: [
      { href: "/admin/users", icon: "👥", label: "使用者" },
      { href: "/admin/pricing", icon: "💰", label: "方案 / 金額" },
      { href: "/admin/promo-codes", icon: "🎟️", label: "促銷碼" },
      { href: "/admin/credit-costs", icon: "✦", label: "占卜成本" },
    ],
  },
  {
    title: "系統",
    items: [
      { href: "/admin/flags", icon: "🚩", label: "Feature Flags" },
      { href: "/admin/audit-log", icon: "🔍", label: "Audit Log" },
      { href: "/admin/admins", icon: "👮", label: "管理員" },
    ],
  },
];

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  // 關閉 drawer:換頁就收
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 抓登入帳號(底部使用者卡片用)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setEmail(user.email);
      });
    });
  }, []);

  const handleLogout = async () => {
    if (!isSupabaseConfigured) return;
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <>
      {/* Mobile 漢堡 + 標題列 */}
      <div className="admin-sidebar-mobile-bar">
        <button
          type="button"
          aria-label="選單"
          onClick={() => setOpen((v) => !v)}
          className="admin-sidebar-hamburger"
        >
          {open ? "✕" : "☰"}
        </button>
        <span className="admin-sidebar-mobile-brand">Tarogram 易問 · 後台</span>
      </div>

      {/* 遮罩(mobile drawer 開啟時) */}
      {open && (
        <div
          className="admin-sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`admin-sidebar ${open ? "admin-sidebar--open" : ""}`}
        aria-label="後台導覽"
      >
        {/* 品牌區 */}
        <div className="admin-sidebar__brand">
          <div className="admin-sidebar__brand-name">Tarogram 易問</div>
          <div className="admin-sidebar__brand-sub">創作者後台 v1.0</div>
        </div>

        {/* 選單 */}
        <nav className="admin-sidebar__nav">
          {GROUPS.map((group) => (
            <div key={group.title} className="admin-sidebar__group">
              <div className="admin-sidebar__group-title">{group.title}</div>
              {group.items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-sidebar__item ${active ? "admin-sidebar__item--active" : ""}`}
                  >
                    <span className="admin-sidebar__item-icon" aria-hidden>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* 底部使用者卡片 */}
        <div className="admin-sidebar__user">
          <div className="admin-sidebar__user-avatar">
            {email ? email.charAt(0).toUpperCase() : "?"}
          </div>
          <div className="admin-sidebar__user-meta">
            <div className="admin-sidebar__user-name">超級管理員</div>
            <div className="admin-sidebar__user-email" title={email ?? ""}>
              {email ?? "—"}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="admin-sidebar__logout"
            title="登出"
            aria-label="登出"
          >
            ⎋
          </button>
        </div>
      </aside>
    </>
  );
}
