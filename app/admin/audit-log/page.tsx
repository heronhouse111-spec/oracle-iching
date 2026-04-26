"use client";

/**
 * /admin/audit-log — admin 操作 audit log 查看頁
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface AuditEntry {
  id: number;
  actor_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actor) params.set("actor", actor);
      if (action) params.set("action", action);
      params.set("limit", "200");
      const res = await fetch(`/api/admin/audit-log?${params}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/audit-log";
        return;
      }
      const data = (await res.json()) as { entries: AuditEntry[] };
      setEntries(data.entries);
    } finally {
      setLoading(false);
    }
  }, [actor, action]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16, marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 24, margin: 0 }}
          >
            操作審計記錄
          </h1>
          <a
            href="/api/admin/export?type=audit"
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 9999,
              border: "1px solid rgba(212,168,85,0.4)",
              color: "#d4a855",
              textDecoration: "none",
            }}
          >
            ⬇ 匯出 CSV
          </a>
        </div>

        {/* ── 篩選 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <input
            type="text"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="操作者 email 部分匹配(例如:heron)"
            style={inputStyle}
          />
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="動作關鍵字(credits / pricing / promo / ban)"
            style={inputStyle}
          />
        </div>

        {loading && <div style={{ color: "rgba(192,192,208,0.5)" }}>載入中…</div>}

        <div className="mystic-card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "rgba(212,168,85,0.06)", color: "rgba(192,192,208,0.7)" }}>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>時間</th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>操作者</th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>動作</th>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>對象</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <>
                  <tr key={e.id} style={{ borderTop: "1px solid rgba(192,192,208,0.08)" }}>
                    <td style={{ padding: "8px 12px", color: "rgba(192,192,208,0.6)", whiteSpace: "nowrap" }}>
                      {new Date(e.created_at).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "medium" })}
                    </td>
                    <td style={{ padding: "8px 12px", color: "rgba(232,232,240,0.85)" }}>
                      {e.actor_email}
                    </td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "#d4a855" }}>
                      {e.action}
                    </td>
                    <td style={{ padding: "8px 12px", color: "rgba(192,192,208,0.7)" }}>
                      {e.target_type ? `${e.target_type}:${e.target_id ?? ""}` : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <button
                        onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                        style={{
                          padding: "3px 10px",
                          fontSize: 11,
                          borderRadius: 6,
                          border: "1px solid rgba(192,192,208,0.2)",
                          background: "transparent",
                          color: "rgba(192,192,208,0.7)",
                          cursor: "pointer",
                        }}
                      >
                        {expanded === e.id ? "收起" : "詳情"}
                      </button>
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr key={`${e.id}-detail`} style={{ background: "rgba(13,13,43,0.5)" }}>
                      <td colSpan={5} style={{ padding: 12 }}>
                        <pre
                          style={{
                            margin: 0,
                            fontSize: 11,
                            color: "rgba(192,192,208,0.8)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            fontFamily: "monospace",
                          }}
                        >
                          {JSON.stringify(e.payload, null, 2)}
                          {e.ip_address && `\n\nIP: ${e.ip_address}`}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "rgba(192,192,208,0.4)" }}>
                    無記錄
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(212,168,85,0.3)",
  background: "rgba(13,13,43,0.5)",
  color: "#e8e8f0",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};
