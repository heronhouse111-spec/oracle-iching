"use client";

/**
 * Admin 共用頂部導覽列。所有 /admin/* 頁面都用這個。
 * 顯示在 main Header 下方,作為 sub-section navigation。
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
  { href: "/admin/flags", label: "Feature Flags", emoji: "🚩" },
  { href: "/admin/audit-log", label: "Audit Log", emoji: "🔍" },
  { href: "/admin/admins", label: "管理員", emoji: "👮" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "sticky",
        top: 64,
        zIndex: 10,
        background: "rgba(10,10,26,0.85)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(212,168,85,0.15)",
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
              border: `1px solid ${active ? "rgba(212,168,85,0.6)" : "rgba(192,192,208,0.15)"}`,
              background: active ? "rgba(212,168,85,0.1)" : "transparent",
              color: active ? "#d4a855" : "rgba(192,192,208,0.7)",
              whiteSpace: "nowrap",
              fontWeight: active ? 600 : 400,
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
