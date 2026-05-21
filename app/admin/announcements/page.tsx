"use client";

/**
 * /admin/announcements — 公告 CRUD 頁
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface Announcement {
  id: number;
  zh_text: string | null;
  en_text: string | null;
  link_url: string | null;
  severity: "info" | "warn" | "critical";
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  display_order: number;
  created_at: string;
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create form state
  const [zh, setZh] = useState("");
  const [en, setEn] = useState("");
  const [link, setLink] = useState("");
  const [severity, setSeverity] = useState<"info" | "warn" | "critical">("info");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/announcements", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/announcements";
        return;
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { announcements: Announcement[] };
      setItems(data.announcements);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zhText: zh || null,
          enText: en || null,
          linkUrl: link || null,
          severity,
          endsAt: endsAt || null,
          active: true,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.detail ?? j.error);
        return;
      }
      setZh("");
      setEn("");
      setLink("");
      setEndsAt("");
      setSeverity("info");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id: number, current: boolean) => {
    await fetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm("確定刪除這則公告?")) return;
    await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link
            href="/admin"
            style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", textDecoration: "none" }}
          >
            ← 後台首頁
          </Link>
        </div>

        <h1
          className="text-gold-gradient"
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 24, marginBottom: 16 }}
        >
          公告管理
        </h1>

        {/* ── 新增表單 ── */}
        <form
          onSubmit={handleCreate}
          className="mystic-card"
          style={{ padding: 20, marginBottom: 20 }}
        >
          <h2 style={{ fontSize: 14, color: "#d4a855", marginBottom: 14 }}>新增公告</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "rgba(192,192,208,0.6)" }}>中文內容</label>
              <textarea
                value={zh}
                onChange={(e) => setZh(e.target.value)}
                rows={2}
                placeholder="春節活動 8 折優惠"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "rgba(192,192,208,0.6)" }}>英文內容</label>
              <textarea
                value={en}
                onChange={(e) => setEn(e.target.value)}
                rows={2}
                placeholder="Lunar New Year 20% off"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "rgba(192,192,208,0.6)" }}>連結(可選)</label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "rgba(192,192,208,0.6)" }}>嚴重性</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as "info" | "warn" | "critical")}
                style={inputStyle}
              >
                <option value="info">info(金色)</option>
                <option value="warn">warn(橘色)</option>
                <option value="critical">critical(紅色)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "rgba(192,192,208,0.6)" }}>結束時間(可選)</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <button type="submit" disabled={busy} className="btn-gold" style={{ padding: "8px 18px", fontSize: 13 }}>
            {busy ? "建立中…" : "建立公告"}
          </button>
        </form>

        {/* ── 列表 ── */}
        {loading && <div style={{ color: "rgba(192,192,208,0.5)" }}>載入中…</div>}
        {error && <div style={{ color: "#fca5a5" }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((a) => (
            <div
              key={a.id}
              className="mystic-card"
              style={{
                padding: 16,
                opacity: a.active ? 1 : 0.5,
                borderColor:
                  a.severity === "critical"
                    ? "rgba(248,113,113,0.4)"
                    : a.severity === "warn"
                      ? "rgba(255,176,72,0.4)"
                      : "rgba(212,168,85,0.3)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, fontSize: 11, color: "rgba(192,192,208,0.5)", marginBottom: 6 }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        background:
                          a.severity === "critical"
                            ? "rgba(248,113,113,0.15)"
                            : a.severity === "warn"
                              ? "rgba(255,176,72,0.15)"
                              : "rgba(212,168,85,0.12)",
                      }}
                    >
                      {a.severity}
                    </span>
                    {!a.active && <span>(停用)</span>}
                    {a.ends_at && <span>結束:{new Date(a.ends_at).toLocaleString("zh-TW")}</span>}
                  </div>
                  {a.zh_text && (
                    <div style={{ fontSize: 13, color: "rgba(232,232,240,0.9)" }}>🇹🇼 {a.zh_text}</div>
                  )}
                  {a.en_text && (
                    <div style={{ fontSize: 13, color: "rgba(232,232,240,0.7)" }}>🇬🇧 {a.en_text}</div>
                  )}
                  {a.link_url && (
                    <div style={{ fontSize: 11, color: "rgba(192,192,208,0.5)", marginTop: 4 }}>
                      🔗 {a.link_url}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    onClick={() => toggleActive(a.id, a.active)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      borderRadius: 6,
                      border: "1px solid rgba(212,168,85,0.3)",
                      background: "rgba(212,168,85,0.06)",
                      color: "#d4a855",
                      cursor: "pointer",
                    }}
                  >
                    {a.active ? "停用" : "啟用"}
                  </button>
                  <button
                    onClick={() => remove(a.id)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      borderRadius: 6,
                      border: "1px solid rgba(248,113,113,0.4)",
                      background: "rgba(248,113,113,0.08)",
                      color: "#fca5a5",
                      cursor: "pointer",
                    }}
                  >
                    刪除
                  </button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && !loading && (
            <div className="mystic-card" style={{ padding: 32, textAlign: "center", color: "rgba(192,192,208,0.4)", fontSize: 13 }}>
              尚無公告
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(212,168,85,0.3)",
  background: "rgba(13,13,43,0.5)",
  color: "#e8e8f0",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  marginTop: 4,
  fontFamily: "inherit",
};
