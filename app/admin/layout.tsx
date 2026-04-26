/**
 * Admin section layout
 *
 * 1. 套 admin 專用 light theme(對齊 heronhouse.me 視覺,跟前台 mystic dark 隔開)
 * 2. 統一插入頂部 sub-nav
 *
 * 不在這層做 admin guard 因為 /admin/page.tsx 已經做了 server-side guard。
 * sub-pages 用 client component 各自呼叫 API(API 也都有 assertAdmin guard)。
 */

import "./admin.css";
import AdminNav from "@/components/admin/AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-light">
      <AdminNav />
      {children}
    </div>
  );
}
