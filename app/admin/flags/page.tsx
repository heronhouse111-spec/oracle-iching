"use client";

/**
 * /admin/flags — Feature flags toggle 頁
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface Flag {
  key: string;
  enabled: boolean;
  description: string | null;
  payload: Record<string, unknown> | null;
  updated_at: string;
}

export default function AdminFlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flags", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/flags";
        return;
      }
      const data = (await res.json()) as { flags: Flag[] };
      setFlags(data.flags);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (key: string, current: boolean) => {
    const res = await fetch("/api/admin/flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, enabled: !current }),
    });
    if (!res.ok) {
      const j = await res.json();
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
          maxWidth: 900,
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
          Feature Flags
        </h1>
        <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginBottom: 24 }}>
          切換功能開關。改動 60 秒內生效(server cache)。
        </p>

        {loading && <div style={{ color: "rgba(192,192,208,0.5)" }}>載入中…</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {flags.map((f) => (
            <div
              key={f.key}
              className="mystic-card"
              style={{
                padding: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "monospace", fontSize: 13, color: "#d4a855", marginBottom: 4 }}>
                  {f.key}
                </div>
                <div style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}>
                  {f.description ?? "(無描述)"}
                </div>
                <div style={{ fontSize: 10, color: "rgba(192,192,208,0.4)", marginTop: 6 }}>
                  上次更新:{new Date(f.updated_at).toLocaleString("zh-TW")}
                </div>
              </div>
              <button
                onClick={() => toggle(f.key, f.enabled)}
                style={{
                  padding: "8px 18px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 9999,
                  border: `1px solid ${f.enabled ? "rgba(110,231,183,0.5)" : "rgba(192,192,208,0.3)"}`,
                  background: f.enabled ? "rgba(110,231,183,0.12)" : "rgba(192,192,208,0.05)",
                  color: f.enabled ? "#6ee7b7" : "rgba(192,192,208,0.7)",
                  cursor: "pointer",
                  minWidth: 90,
                }}
              >
                {f.enabled ? "ON" : "OFF"}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
