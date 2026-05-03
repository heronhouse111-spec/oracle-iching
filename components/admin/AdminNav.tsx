"use client";

/**
 * Admin 共用頂部導覽列。所有 /admin/* 頁面都用這個。
 *
 * 視覺對齊 heronhouse.me / pay.heronhouse.me — 白色玻璃 nav + 藍色 active state。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  emoji: string;
}

const ITEMS: NavItem[] = [
  { href: "/admin", label: "首頁", emoji: "🏠" },
  { href: "/admin/users", label: "使用者", emoji: "👥" },
  { href: "/admin/pricing", label: "方案 / 金額", emoji: "💰" },
  { href: "/admin/promo-codes", label: "促銷碼", emoji: "🎟️" },
  { href: "/admin/announcements", label: "公告", emoji: "📢" },
  { href: "/admin/personas", label: "占卜師", emoji: "🧙" },
  { href: "/admin/inspirations", label: "問題靈感", emoji: "✦" },
  { href: "/admin/collection-milestones", label: "收集里程碑", emoji: "🎯" },
  { href: "/admin/credit-costs", label: "占卜成本", emoji: "✦" },
  { href: "/admin/ui-images", label: "首頁 icon", emoji: "🖼️" },
  { href: "/admin/flags", label: "Feature Flags", emoji: "🚩" },
  { href: "/admin/audit-log", label: "Audit Log", emoji: "🔍" },
  { href: "/admin/admins", label: "管理員", emoji: "👮" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      className="admin-nav"
      style={{
        position: "sticky",
        top: 64,
        zIndex: 10,
        background: "rgba(255, 255, 255, 0.82)",
        backdropFilter: "saturate(160%) blur(10px)",
        WebkitBackdropFilter: "saturate(160%) blur(10px)",
        borderBottom: "1px solid #dbe3ee",
        padding: "10px 16px",
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        overflowX: "auto",
      }}
    >
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              borderRadius: 9999,
              textDecoration: "none",
              border: `1px solid ${active ? "#3b6fa3" : "#dbe3ee"}`,
              background: active ? "#eef4fa" : "transparent",
              color: active ? "#1e4272" : "#5a6a82",
              whiteSpace: "nowrap",
              fontWeight: active ? 600 : 400,
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            <span aria-hidden style={{ marginRight: 6 }}>
              {item.emoji}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
