"use client";

/**
 * /admin/collection-milestones — 卡牌收集里程碑配置
 *
 * 左側列表(分易經 / 塔羅 + 顯示停用),右側 form。新增 / 編輯 / 刪除 / 啟停。
 *
 * 重要:改 reward / threshold 對「已領舊獎勵的 user」不會自動補差額 —
 *       collection_milestones 表的 PK 防重複。請在「上線時就慎選 reward」。
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

type CollectionType = "iching" | "tarot";
type Kind = "distinct_count" | "subkind_full";

interface Milestone {
  id: string;
  collection_type: CollectionType;
  kind: Kind;
  threshold: number;
  param: string | null;
  reward_credits: number;
  label_zh: string;
  label_en: string;
  label_ja: string | null;
  label_ko: string | null;
  sort_order: number;
  active: boolean;
}

interface Draft {
  id: string;
  collectionType: CollectionType;
  kind: Kind;
  threshold: number;
  param: string;
  rewardCredits: number;
  labelZh: string;
  labelEn: string;
  labelJa: string;
  labelKo: string;
  sortOrder: number;
  active: boolean;
}

const blankDraft: Draft = {
  id: "",
  collectionType: "iching",
  kind: "distinct_count",
  threshold: 10,
  param: "",
  rewardCredits: 10,
  labelZh: "",
  labelEn: "",
  labelJa: "",
  labelKo: "",
  sortOrder: 100,
  active: true,
};

function rowToDraft(m: Milestone): Draft {
  return {
    id: m.id,
    collectionType: m.collection_type,
    kind: m.kind,
    threshold: m.threshold,
    param: m.param ?? "",
    rewardCredits: m.reward_credits,
    labelZh: m.label_zh,
    labelEn: m.label_en,
    labelJa: m.label_ja ?? "",
    labelKo: m.label_ko ?? "",
    sortOrder: m.sort_order,
    active: m.active,
  };
}

export default function AdminMilestonesPage() {
  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/collection-milestones", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        window.location.href = `/?redirect=/admin/collection-milestones`;
        return;
      }
      if (!res.ok) {
        setError(`載入失敗:HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      setItems(json.milestones ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setEditing(null);
    setDraft(blankDraft);
    setMsg(null);
  };

  const startEdit = (m: Milestone) => {
    setEditing(m.id);
    setDraft(rowToDraft(m));
    setMsg(null);
  };

  const handleSave = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/collection-milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({
          kind: "err",
          text: Array.isArray(json.detail) ? json.detail.join(", ") : (json.detail ?? json.error ?? `HTTP ${res.status}`),
        });
        return;
      }
      setMsg({ kind: "ok", text: editing ? "已更新" : "已新增" });
      await load();
      if (!editing) {
        // 新增成功後 → 切到「編輯該筆」狀態
        setEditing(draft.id);
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`確定刪除里程碑「${id}」?\n注意:會 CASCADE 刪掉所有 user 的領取紀錄(已發出的 credits 不會回收)。\n建議改用「停用 active=false」而非刪除。`)) return;
    const res = await fetch(`/api/admin/collection-milestones/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.detail ?? j.error ?? `HTTP ${res.status}`);
      return;
    }
    if (editing === id) startNew();
    await load();
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main
        style={{
          paddingTop: 24,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, color: "#d4a855", fontFamily: "'Noto Serif TC', serif" }}>
            🎯 卡牌收集里程碑
          </h1>
          <button
            onClick={startNew}
            className="btn-gold"
            style={{ padding: "8px 18px", fontSize: 13 }}
          >
            ＋ 新增里程碑
          </button>
        </div>

        <p style={{ color: "rgba(192,192,208,0.7)", fontSize: 12, marginBottom: 16, lineHeight: 1.7 }}>
          ⚠️ 改 reward / threshold 對「已領舊獎勵的 user」不會自動補差額。建議「停用」而非刪除舊里程碑。
          所有變更都進 <Link href="/admin/audit-log" style={{ color: "#d4a855" }}>audit log</Link>。
        </p>

        {error && (
          <div style={{ padding: 12, borderRadius: 8, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.4)", color: "#fca5a5", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) 1fr", gap: 16 }}>
          {/* ── 左側列表 ── */}
          <div className="mystic-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(192,192,208,0.08)", fontSize: 13, color: "#d4a855" }}>
              全部里程碑 ({items.length})
            </div>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "rgba(192,192,208,0.4)" }}>載入中…</div>
            ) : (
              <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {(["iching", "tarot"] as const).map((tt) => {
                  const group = items.filter((m) => m.collection_type === tt);
                  if (group.length === 0) return null;
                  return (
                    <div key={tt}>
                      <div
                        style={{
                          padding: "6px 14px",
                          fontSize: 11,
                          color: "rgba(192,192,208,0.5)",
                          background: "rgba(212,168,85,0.04)",
                          borderTop: "1px solid rgba(192,192,208,0.06)",
                          borderBottom: "1px solid rgba(192,192,208,0.06)",
                        }}
                      >
                        {tt === "iching" ? "易經" : "塔羅"}
                      </div>
                      {group.map((m) => {
                        const active = editing === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => startEdit(m)}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "10px 14px",
                              textAlign: "left",
                              background: active ? "rgba(212,168,85,0.15)" : "transparent",
                              borderLeft: active ? "3px solid #d4a855" : "3px solid transparent",
                              border: "none",
                              borderBottom: "1px solid rgba(192,192,208,0.04)",
                              cursor: "pointer",
                              color: m.active ? "#e8e8f0" : "rgba(192,192,208,0.4)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                              <span style={{ fontWeight: 600 }}>{m.label_zh}</span>
                              <span style={{ color: "#fde68a", fontSize: 11 }}>+{m.reward_credits}✦</span>
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(192,192,208,0.5)", marginTop: 2 }}>
                              {m.id} · {m.kind === "distinct_count" ? `≥${m.threshold} 張` : `${m.param}=${m.threshold}`}
                              {!m.active && " · ⏸ 停用"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", color: "rgba(192,192,208,0.4)", fontSize: 13 }}>
                    尚無里程碑配置
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 右側 form ── */}
          <div className="mystic-card" style={{ padding: 18 }}>
            <h2 style={{ fontSize: 14, color: "#d4a855", marginBottom: 12 }}>
              {editing ? `編輯:${editing}` : "新增里程碑"}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <Field label="ID(英數+底線+橫線,2-41字)" required>
                <input
                  type="text"
                  value={draft.id}
                  onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                  disabled={!!editing}
                  placeholder="e.g. iching_25"
                  style={inputStyle}
                />
              </Field>
              <Field label="排序(小→大)">
                <input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: parseInt(e.target.value, 10) || 0 })}
                  style={inputStyle}
                />
              </Field>
              <Field label="收集類型" required>
                <select
                  value={draft.collectionType}
                  onChange={(e) => setDraft({ ...draft, collectionType: e.target.value as CollectionType })}
                  style={inputStyle}
                >
                  <option value="iching">易經 (iching)</option>
                  <option value="tarot">塔羅 (tarot)</option>
                </select>
              </Field>
              <Field label="判定方式" required>
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}
                  style={inputStyle}
                >
                  <option value="distinct_count">distinct_count(收齊 N 張)</option>
                  <option value="subkind_full">subkind_full(某花色全收;限塔羅)</option>
                </select>
              </Field>
              <Field label="閾值(N)" required>
                <input
                  type="number"
                  value={draft.threshold}
                  min={1}
                  onChange={(e) => setDraft({ ...draft, threshold: parseInt(e.target.value, 10) || 1 })}
                  style={inputStyle}
                />
              </Field>
              <Field label={draft.kind === "subkind_full" ? "花色 (param)" : "param(本 kind 不需要)"}>
                <select
                  value={draft.param}
                  onChange={(e) => setDraft({ ...draft, param: e.target.value })}
                  disabled={draft.kind !== "subkind_full"}
                  style={{ ...inputStyle, opacity: draft.kind !== "subkind_full" ? 0.4 : 1 }}
                >
                  <option value="">—</option>
                  <option value="major">major(大阿爾克那)</option>
                  <option value="wands">wands(權杖)</option>
                  <option value="cups">cups(聖杯)</option>
                  <option value="swords">swords(寶劍)</option>
                  <option value="pentacles">pentacles(錢幣)</option>
                </select>
              </Field>
              <Field label="獎勵 credits" required>
                <input
                  type="number"
                  value={draft.rewardCredits}
                  min={0}
                  onChange={(e) => setDraft({ ...draft, rewardCredits: parseInt(e.target.value, 10) || 0 })}
                  style={inputStyle}
                />
              </Field>
              <Field label="啟用">
                <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  />
                  <span style={{ fontSize: 13, color: "#e8e8f0" }}>active</span>
                </label>
              </Field>
            </div>

            <div style={{ marginBottom: 8, fontSize: 11, color: "rgba(192,192,208,0.5)" }}>
              標籤(label,4 語系):
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <Field label="zh-TW" required>
                <input type="text" value={draft.labelZh} onChange={(e) => setDraft({ ...draft, labelZh: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="en" required>
                <input type="text" value={draft.labelEn} onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="ja(可空)">
                <input type="text" value={draft.labelJa} onChange={(e) => setDraft({ ...draft, labelJa: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="ko(可空)">
                <input type="text" value={draft.labelKo} onChange={(e) => setDraft({ ...draft, labelKo: e.target.value })} style={inputStyle} />
              </Field>
            </div>

            {msg && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: msg.kind === "ok" ? "rgba(110,231,183,0.08)" : "rgba(248,113,113,0.08)",
                  border: `1px solid ${msg.kind === "ok" ? "rgba(110,231,183,0.4)" : "rgba(248,113,113,0.4)"}`,
                  color: msg.kind === "ok" ? "#6ee7b7" : "#fca5a5",
                  fontSize: 12,
                  marginBottom: 12,
                }}
              >
                {msg.text}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
              {editing ? (
                <button
                  onClick={() => handleDelete(editing)}
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    borderRadius: 9999,
                    border: "1px solid rgba(248,113,113,0.5)",
                    background: "rgba(248,113,113,0.1)",
                    color: "#fca5a5",
                    cursor: "pointer",
                  }}
                >
                  🗑 刪除
                </button>
              ) : (
                <span />
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={startNew}
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    borderRadius: 9999,
                    border: "1px solid rgba(192,192,208,0.3)",
                    background: "none",
                    color: "rgba(192,192,208,0.8)",
                    cursor: "pointer",
                  }}
                >
                  清空表單
                </button>
                <button
                  onClick={handleSave}
                  disabled={busy}
                  className="btn-gold"
                  style={{ padding: "8px 18px", fontSize: 13, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}
                >
                  {busy ? "儲存中…" : editing ? "更新" : "新增"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── 小 helpers ───
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid rgba(212,168,85,0.3)",
  background: "rgba(13,13,43,0.5)",
  color: "#e8e8f0",
  fontSize: 13,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 3 }}>
        {label}
        {required && <span style={{ color: "#fca5a5", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
