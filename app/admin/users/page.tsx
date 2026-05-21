"use client";

/**
 * /admin/users — 使用者搜尋 + 列表
 *
 * 搜尋透過 /api/admin/users/search?q=...,結果列表點擊跳到 /admin/users/[id]。
 * 預設不帶 q 撈最新註冊 20 筆;輸入 q 後即時 ILIKE 過濾。
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface UserRow {
  id: string;
  email: string | null;
  signed_up_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  preferred_locale: string | null;
  is_admin: boolean | null;
}

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/users/search?q=${encodeURIComponent(q)}&limit=50`,
          { cache: "no-store" },
        );
        if (res.status === 401) {
          window.location.href = "/?redirect=/admin/users";
          return;
        }
        if (res.status === 403) {
          setError("沒有 admin 權限");
          return;
        }
        if (!res.ok) {
          setError(`查詢失敗:HTTP ${res.status}`);
          return;
        }
        const data = (await res.json()) as { users: UserRow[] };
        setRows(data.users);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link
            href="/admin"
            style={{
              fontSize: 12,
              color: "rgba(192,192,208,0.6)",
              textDecoration: "none",
            }}
          >
            ← 後台首頁
          </Link>
        </div>

        <h1
          className="text-gold-gradient"
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 24,
            marginBottom: 16,
          }}
        >
          使用者管理
        </h1>

        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋 email(部分匹配,例如 gmail / heron)"
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(212,168,85,0.3)",
            background: "rgba(13,13,43,0.5)",
            color: "#e8e8f0",
            fontSize: 14,
            outline: "none",
            marginBottom: 16,
            boxSizing: "border-box",
          }}
        />

        {error && (
          <div
            style={{
              padding: 12,
              marginBottom: 16,
              borderRadius: 8,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.4)",
              color: "#fca5a5",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {loading && (
          <div style={{ color: "rgba(192,192,208,0.5)", fontSize: 12, marginBottom: 12 }}>
            載入中…
          </div>
        )}

        <div
          className="mystic-card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "rgba(212,168,85,0.06)",
                  fontSize: 11,
                  color: "rgba(192,192,208,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                <th style={{ padding: "10px 14px", textAlign: "left" }}>Email</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>顯示名</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>語系</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>註冊</th>
                <th style={{ padding: "10px 14px", textAlign: "left" }}>上次登入</th>
                <th style={{ padding: "10px 14px", textAlign: "center" }}>Admin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr
                  key={u.id}
                  style={{
                    borderTop: "1px solid rgba(192,192,208,0.08)",
                    fontSize: 13,
                    color: "rgba(232,232,240,0.85)",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    window.location.href = `/admin/users/${u.id}`;
                  }}
                >
                  <td style={{ padding: "10px 14px" }}>
                    <Link
                      href={`/admin/users/${u.id}`}
                      style={{ color: "#d4a855", textDecoration: "none" }}
                    >
                      {u.email ?? "(未設定)"}
                    </Link>
                  </td>
                  <td style={{ padding: "10px 14px" }}>{u.display_name ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}>{u.preferred_locale ?? "—"}</td>
                  <td style={{ padding: "10px 14px", color: "rgba(192,192,208,0.6)" }}>
                    {new Date(u.signed_up_at).toLocaleDateString("zh-TW")}
                  </td>
                  <td style={{ padding: "10px 14px", color: "rgba(192,192,208,0.6)" }}>
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleDateString("zh-TW")
                      : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    {u.is_admin ? "✓" : ""}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: 32,
                      textAlign: "center",
                      color: "rgba(192,192,208,0.4)",
                      fontSize: 13,
                    }}
                  >
                    沒有結果
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
