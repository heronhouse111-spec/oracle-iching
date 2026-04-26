/**
 * Admin section layout — 統一插入頂部子導覽列,讓所有 /admin/* 頁面共用。
 *
 * 不在這層做 admin guard 因為 /admin/page.tsx 已經做了 server-side guard。
 * sub-pages 用 client component 各自呼叫 API(API 也都有 assertAdmin guard)。
 */

import AdminNav from "@/components/admin/AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
