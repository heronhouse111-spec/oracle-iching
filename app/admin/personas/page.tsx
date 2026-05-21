"use client";

/**
 * /admin/personas — 占卜師管理
 *
 * 左側列表(包含停用),右側 form。新增 / 編輯 / 刪除 / 上傳圖片 / 切 tier(鎖)。
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

type System = "iching" | "tarot" | "any";
type Tier = "free" | "premium";

interface Persona {
  id: string;
  system: System;
  tier: Tier;
  active: boolean;
  sort_order: number;
  emoji: string | null;
  image_url: string | null;
  name_zh: string;
  name_en: string;
  name_ja: string | null;
  name_ko: string | null;
  tagline_zh: string;
  tagline_en: string;
  tagline_ja: string | null;
  tagline_ko: string | null;
  prompt_zh: string;
  prompt_en: string;
}

interface Draft {
  id: string;
  system: System;
  tier: Tier;
  active: boolean;
  sortOrder: number;
  emoji: string;
  imageUrl: string;
  nameZh: string;
  nameEn: string;
  nameJa: string;
  nameKo: string;
  taglineZh: string;
  taglineEn: string;
  taglineJa: string;
  taglineKo: string;
  promptZh: string;
  promptEn: string;
}

const blankDraft: Draft = {
  id: "",
  system: "tarot",
  tier: "free",
  active: true,
  sortOrder: 100,
  emoji: "",
  imageUrl: "",
  nameZh: "",
  nameEn: "",
  nameJa: "",
  nameKo: "",
  taglineZh: "",
  taglineEn: "",
  taglineJa: "",
  taglineKo: "",
  promptZh: "",
  promptEn: "",
};

function rowToDraft(p: Persona): Draft {
  return {
    id: p.id,
    system: p.system,
    tier: p.tier,
    active: p.active,
    sortOrder: p.sort_order,
    emoji: p.emoji ?? "",
    imageUrl: p.image_url ?? "",
    nameZh: p.name_zh,
    nameEn: p.name_en,
    nameJa: p.name_ja ?? "",
    nameKo: p.name_ko ?? "",
    taglineZh: p.tagline_zh,
    taglineEn: p.tagline_en,
    taglineJa: p.tagline_ja ?? "",
    taglineKo: p.tagline_ko ?? "",
    promptZh: p.prompt_zh,
    promptEn: p.prompt_en,
  };
}

export default function AdminPersonasPage() {
  const [items, setItems] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/personas", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/personas";
        return;
      }
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { personas: Persona[] };
      setItems(data.personas);
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
    setIsNew(true);
    setEditingId(null);
    setDraft({ ...blankDraft });
  };

  const startEdit = (p: Persona) => {
    setIsNew(false);
    setEditingId(p.id);
    setDraft(rowToDraft(p));
  };

  const cancel = () => {
    setEditingId(null);
    setIsNew(false);
    setDraft(blankDraft);
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "personas");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json()) as { detail?: string; error?: string };
        alert(`上傳失敗:${j.detail ?? j.error ?? res.status}`);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      setDraft((d) => ({ ...d, imageUrl: url }));
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (busy) return;

    // 基本驗證
    const required = ["nameZh", "nameEn", "taglineZh", "taglineEn", "promptZh", "promptEn"] as const;
    for (const f of required) {
      if (!draft[f]?.trim()) {
        alert(`${f} 為必填`);
        return;
      }
    }
    if (isNew && !/^[a-z][a-z0-9-]{1,30}$/.test(draft.id)) {
      alert("id 必須是小寫字母 / 數字 / 連字號,2-31 字");
      return;
    }

    const payload = {
      ...(isNew ? { id: draft.id } : {}),
      system: draft.system,
      tier: draft.tier,
      active: draft.active,
      sortOrder: draft.sortOrder,
      emoji: draft.emoji || null,
      imageUrl: draft.imageUrl || null,
      nameZh: draft.nameZh,
      nameEn: draft.nameEn,
      nameJa: draft.nameJa || null,
      nameKo: draft.nameKo || null,
      taglineZh: draft.taglineZh,
      taglineEn: draft.taglineEn,
      taglineJa: draft.taglineJa || null,
      taglineKo: draft.taglineKo || null,
      promptZh: draft.promptZh,
      promptEn: draft.promptEn,
    };

    setBusy(true);
    try {
      const res = isNew
        ? await fetch("/api/admin/personas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/personas/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const j = (await res.json()) as { detail?: string; error?: string };
        alert(`儲存失敗:${j.detail ?? j.error ?? res.status}`);
        return;
      }
      cancel();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`確定刪除 ${id}?(不可還原)`)) return;
    const res = await fetch(`/api/admin/personas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(`刪除失敗:${res.status}`);
      return;
    }
    if (editingId === id) cancel();
    await load();
  };

  const toggleActive = async (p: Persona) => {
    await fetch(`/api/admin/personas/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    await load();
  };

  const editing = isNew || editingId !== null;

  return (
    <div className="min-h-screen">
      <Header />
      <main
        style={{
          paddingTop: 88,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link
            href="/admin"
            style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", textDecoration: "none" }}
          >
            ← 後台首頁
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 18,
          }}
        >
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 24 }}
          >
            占卜師管理
          </h1>
          <button onClick={startNew} className="btn-gold" style={{ padding: "8px 18px", fontSize: 13 }}>
            + 新增占卜師
          </button>
        </div>

        {loading && <div style={{ color: "rgba(192,192,208,0.5)" }}>載入中…</div>}
        {error && (
          <div
            style={{
              padding: 12,
              border: "1px solid rgba(248,113,113,0.4)",
              background: "rgba(248,113,113,0.08)",
              borderRadius: 8,
              color: "#fca5a5",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: editing ? "320px 1fr" : "1fr", gap: 16 }}>
          {/* ── 列表 ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((p) => (
              <div
                key={p.id}
                onClick={() => startEdit(p)}
                className="mystic-card"
                style={{
                  padding: 12,
                  cursor: "pointer",
                  opacity: p.active ? 1 : 0.5,
                  borderColor:
                    editingId === p.id
                      ? "rgba(212,168,85,0.7)"
                      : "rgba(212,168,85,0.18)",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt=""
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "rgba(212,168,85,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      {p.emoji || "?"}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e8f0" }}>
                      {p.name_zh}
                      <span style={{ color: "rgba(192,192,208,0.5)", fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                        {p.name_en}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4, fontSize: 10 }}>
                      <span style={badgeStyle(p.system === "iching" ? "#7de8b3" : p.system === "tarot" ? "#d4a855" : "#bbb")}>
                        {p.system}
                      </span>
                      <span style={badgeStyle(p.tier === "premium" ? "#fcb454" : "#9aa0a8")}>
                        {p.tier === "premium" ? "🔒 premium" : "free"}
                      </span>
                      {!p.active && <span style={badgeStyle("#fca5a5")}>停用</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleActive(p);
                    }}
                    style={smallBtnStyle}
                  >
                    {p.active ? "停用" : "啟用"}
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && !loading && (
              <div
                className="mystic-card"
                style={{ padding: 24, textAlign: "center", color: "rgba(192,192,208,0.4)", fontSize: 13 }}
              >
                尚無占卜師(SQL migration 跑了嗎?)
              </div>
            )}
          </div>

          {/* ── Form(編輯 / 新增時才顯示) ── */}
          {editing && (
            <div className="mystic-card" style={{ padding: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 14,
                }}
              >
                <h2 style={{ fontSize: 16, color: "#d4a855", margin: 0 }}>
                  {isNew ? "新增占卜師" : `編輯:${draft.nameZh || draft.id}`}
                </h2>
                <div style={{ display: "flex", gap: 6 }}>
                  {!isNew && (
                    <button
                      onClick={() => editingId && handleDelete(editingId)}
                      style={{
                        ...smallBtnStyle,
                        borderColor: "rgba(248,113,113,0.4)",
                        color: "#fca5a5",
                        background: "rgba(248,113,113,0.08)",
                      }}
                    >
                      刪除
                    </button>
                  )}
                  <button onClick={cancel} style={smallBtnStyle}>
                    取消
                  </button>
                </div>
              </div>

              {/* 圖像上傳 + emoji fallback */}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  marginBottom: 14,
                  paddingBottom: 14,
                  borderBottom: "1px solid rgba(212,168,85,0.1)",
                }}
              >
                {draft.imageUrl ? (
                  <img
                    src={draft.imageUrl}
                    alt=""
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "1px solid rgba(212,168,85,0.4)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      background: "rgba(212,168,85,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 32,
                      border: "1px dashed rgba(212,168,85,0.3)",
                    }}
                  >
                    {draft.emoji || "?"}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, color: "rgba(192,192,208,0.6)", marginBottom: 4 }}>
                    大頭照(優先顯示。沒上傳就用 emoji)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                    style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}
                  />
                  {uploading && (
                    <div style={{ fontSize: 11, color: "#d4a855", marginTop: 4 }}>上傳中…</div>
                  )}
                  {draft.imageUrl && (
                    <div style={{ fontSize: 11, marginTop: 6 }}>
                      <button
                        onClick={() => setDraft((d) => ({ ...d, imageUrl: "" }))}
                        style={{
                          background: "none",
                          border: "none",
                          color: "rgba(248,113,113,0.8)",
                          textDecoration: "underline",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: 11,
                        }}
                      >
                        移除圖片
                      </button>
                    </div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <label style={labelStyle}>Fallback Emoji</label>
                    <input
                      value={draft.emoji}
                      onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                      placeholder="🌙"
                      style={{ ...inputStyle, width: 80 }}
                    />
                  </div>
                </div>
              </div>

              {/* 基本欄位 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>ID *</label>
                  <input
                    value={draft.id}
                    onChange={(e) => isNew && setDraft({ ...draft, id: e.target.value })}
                    disabled={!isNew}
                    placeholder="zhuge-liang"
                    style={{ ...inputStyle, opacity: isNew ? 1 : 0.5 }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>系統</label>
                  <select
                    value={draft.system}
                    onChange={(e) =>
                      setDraft({ ...draft, system: e.target.value as System })
                    }
                    style={inputStyle}
                  >
                    <option value="tarot">塔羅</option>
                    <option value="iching">易經</option>
                    <option value="any">通用</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>權限</label>
                  <select
                    value={draft.tier}
                    onChange={(e) => setDraft({ ...draft, tier: e.target.value as Tier })}
                    style={inputStyle}
                  >
                    <option value="free">free</option>
                    <option value="premium">premium(訂閱限定)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>排序(數字小的優先)</label>
                  <input
                    type="number"
                    value={draft.sortOrder}
                    onChange={(e) =>
                      setDraft({ ...draft, sortOrder: parseInt(e.target.value, 10) || 0 })
                    }
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <label style={{ ...labelStyle, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                      style={{ marginRight: 6 }}
                    />
                    啟用(顯示給訪客)
                  </label>
                </div>
              </div>

              {/* 名稱 4 語 */}
              <Section title="名稱 (4 語)">
                <Grid4>
                  <FieldInput
                    label="繁中 *"
                    value={draft.nameZh}
                    onChange={(v) => setDraft({ ...draft, nameZh: v })}
                    placeholder="伏羲"
                  />
                  <FieldInput
                    label="英文 *"
                    value={draft.nameEn}
                    onChange={(v) => setDraft({ ...draft, nameEn: v })}
                    placeholder="Fu Xi"
                  />
                  <FieldInput
                    label="日"
                    value={draft.nameJa}
                    onChange={(v) => setDraft({ ...draft, nameJa: v })}
                    placeholder="伏羲"
                  />
                  <FieldInput
                    label="韓"
                    value={draft.nameKo}
                    onChange={(v) => setDraft({ ...draft, nameKo: v })}
                    placeholder="복희"
                  />
                </Grid4>
              </Section>

              {/* 簡介 4 語 */}
              <Section title="簡介 (4 語)">
                <Grid4>
                  <FieldInput
                    label="繁中 *"
                    value={draft.taglineZh}
                    onChange={(v) => setDraft({ ...draft, taglineZh: v })}
                    placeholder="創卦聖人・宇宙視角"
                  />
                  <FieldInput
                    label="英文 *"
                    value={draft.taglineEn}
                    onChange={(v) => setDraft({ ...draft, taglineEn: v })}
                  />
                  <FieldInput
                    label="日"
                    value={draft.taglineJa}
                    onChange={(v) => setDraft({ ...draft, taglineJa: v })}
                  />
                  <FieldInput
                    label="韓"
                    value={draft.taglineKo}
                    onChange={(v) => setDraft({ ...draft, taglineKo: v })}
                  />
                </Grid4>
              </Section>

              {/* AI Prompt(只繁中 + 英;由 API 端依使用者 locale 取對應) */}
              <Section title="AI 個人風格 Prompt(影響回答口吻)">
                <div>
                  <label style={labelStyle}>繁中 *</label>
                  <textarea
                    value={draft.promptZh}
                    onChange={(e) => setDraft({ ...draft, promptZh: e.target.value })}
                    rows={4}
                    placeholder="個人風格:你是 ..."
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginTop: 8 }}>
                  <label style={labelStyle}>英文 *</label>
                  <textarea
                    value={draft.promptEn}
                    onChange={(e) => setDraft({ ...draft, promptEn: e.target.value })}
                    rows={4}
                    placeholder="Style: You are ..."
                    style={inputStyle}
                  />
                </div>
              </Section>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  onClick={handleSave}
                  disabled={busy}
                  className="btn-gold"
                  style={{ padding: "10px 24px", fontSize: 13, opacity: busy ? 0.5 : 1 }}
                >
                  {busy ? "儲存中…" : isNew ? "建立" : "儲存變更"}
                </button>
                <button onClick={cancel} style={smallBtnStyle}>
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Building blocks ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 14,
        paddingBottom: 14,
        borderBottom: "1px solid rgba(212,168,85,0.1)",
      }}
    >
      <div style={{ fontSize: 12, color: "rgba(212,168,85,0.7)", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function Grid4({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>;
}
function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "rgba(192,192,208,0.6)",
  marginBottom: 3,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid rgba(212,168,85,0.25)",
  background: "rgba(13,13,43,0.5)",
  color: "#e8e8f0",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
const smallBtnStyle: React.CSSProperties = {
  padding: "5px 12px",
  fontSize: 11,
  borderRadius: 6,
  border: "1px solid rgba(212,168,85,0.3)",
  background: "rgba(212,168,85,0.06)",
  color: "#d4a855",
  cursor: "pointer",
  fontFamily: "inherit",
};
const badgeStyle = (color: string): React.CSSProperties => ({
  padding: "2px 6px",
  borderRadius: 4,
  background: `${color}22`,
  color,
  fontSize: 10,
  fontWeight: 600,
});
