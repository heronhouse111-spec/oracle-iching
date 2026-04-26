"use client";

/**
 * /admin/admins — 管理員名單 + 角色變更
 *
 * 只有 super_admin 能改變 role(API 那邊有 guard)。
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "user" | "support" | "admin" | "super_admin";
  signed_up_at: string;
  last_sign_in_at: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  user: "一般使用者",
  support: "客服(只讀)",
  admin: "管理員",
  super_admin: "超級管理員",
};

const ROLE_COLOR: Record<string, string> = {
  user: "rgba(192,192,208,0.6)",
  support: "#86b6f6",
  admin: "#d4a855",
  super_admin: "#fca5a5",
};

export default function AdminAdminsPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/users/search?q=${encodeURIComponent(search)}&limit=200`,
        { cache: "no-store" },
      );
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/admins";
        return;
      }
      const data = (await res.json()) as { users: UserRow[] };
      // 預設只顯示 role >= support 的(管理員們)
      const filtered = search
        ? data.users
        : data.users.filter((u) => u.role && u.role !== "user");
      setRows(filtered);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const changeRole = async (id: string, role: string) => {
    const res = await fetch(`/api/admin/users/${id}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const j = await res.json();
    if (!res.ok) {
      alert(j.detail ?? j.error);
      return;
    }
    await load();
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main
        style={{
          paddingTop: 88,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <Link href="/admin" style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", textDecoration: "none" }}>
          ← 後台首頁
        </Link>

        <h1
          className="text-gold-gradient"
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 24, marginTop: 16, marginBottom: 8 }}
        >
          管理員名單
        </h1>
        <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginBottom: 16 }}>
          預設只顯示有後台權限的人(support/admin/super_admin)。輸入 email 搜尋可看到一般使用者並升級他們。
          <br />
          ⚠ 只有 <strong>super_admin</strong> 能改角色,且不能把自己降級。
        </p>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="輸入 email 搜尋(空白 = 只看現任管理員)"
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(212,168,85,0.3)",
            background: "rgba(13,13,43,0.5)",
            color: "#e8e8f0",
            fontSize: 13,
            outline: "none",
            marginBottom: 16,
            boxSizing: "border-box",
          }}
        />

        {loading && <div style={{ color: "rgba(192,192,208,0.5)" }}>載入中…</div>}

        <div className="mystic-card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "rgba(212,168,85,0.06)", color: "rgba(192,192,208,0.7)" }}>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>Email</th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>顯示名</th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>目前角色</th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>變更</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid rgba(192,192,208,0.08)" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <Link href={`/admin/users/${u.id}`} style={{ color: "#d4a855", textDecoration: "none" }}>
                      {u.email}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 12px", color: "rgba(192,192,208,0.7)" }}>
                    {u.display_name ?? "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 9999,
                        background: "rgba(192,192,208,0.06)",
                        border: `1px solid ${ROLE_COLOR[u.role] ?? "rgba(192,192,208,0.3)"}`,
                        color: ROLE_COLOR[u.role] ?? "rgba(192,192,208,0.7)",
                        fontSize: 11,
                      }}
                    >
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      style={{
                        padding: "4px 8px",
                        fontSize: 12,
                        borderRadius: 6,
                        border: "1px solid rgba(212,168,85,0.3)",
                        background: "rgba(13,13,43,0.5)",
                        color: "#e8e8f0",
                      }}
                    >
                      <option value="user">user(一般)</option>
                      <option value="support">support(只讀客服)</option>
                      <option value="admin">admin(管理員)</option>
                      <option value="super_admin">super_admin(超管)</option>
                    </select>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} style={{ padding: 32, textAlign: "center", color: "rgba(192,192,208,0.4)" }}>
                    無結果
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
