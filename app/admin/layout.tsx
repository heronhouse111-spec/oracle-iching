/**
 * Admin section layout — 左側固定側欄 + 右側主內容(BBQ 風格)
 *
 * 1. 套 admin 專用 light theme(對齊 heronhouse.me 視覺,跟前台 mystic dark 隔開)
 * 2. 左側固定 AdminSidebar,主內容靠 padding-left 推開
 * 3. 全站 fixed Header 在 admin 路由下會被 admin.css 隱藏 — 側欄就是唯一 chrome
 *
 * 不在這層做 admin guard 因為 /admin/page.tsx 已經做了 server-side guard。
 * sub-pages 用 client component 各自呼叫 API(API 也都有 assertAdmin guard)。
 */

import "./admin.css";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-light admin-shell">
      <AdminSidebar />
      <div className="admin-main">{children}</div>
    </div>
  );
}
