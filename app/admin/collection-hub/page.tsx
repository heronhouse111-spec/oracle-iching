"use client";

/**
 * /admin/collection-hub — 收藏中心(/collection)頁面文案管理
 *
 * 每筆 row 一個區塊,4 語系 (zh/en/ja/ko) × (title/body) 共 8 個欄位。
 * 「⚡ 自動翻譯」按鈕從 zh 一鍵生 en/ja/ko(預設只填空欄,點 [全部覆寫] 才會覆蓋既有翻譯)。
 *
 * 不能新增 / 刪除 row — 只能編輯既有,因為 layout 是寫死在 /collection/page.tsx 的。
 */

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";

interface HubItem {
  id: string;
  section: string;
  title_zh: string | null;
  title_en: string | null;
  title_ja: string | null;
  title_ko: string | null;
  body_zh: string | null;
  body_en: string | null;
  body_ja: string | null;
  body_ko: string | null;
  link_href: string | null;
  image_slot: string | null;
  sort_order: number;
  active: boolean;
  updated_at: string;
}

const SECTION_LABEL: Record<string, string> = {
  page: "📌 頁面標題",
  card: "🃏 兩張 hero 卡",
  cta: "🚪 未登入 CTA",
  rule: "📋 收集規則",
  milestones: "🎯 里程碑區塊",
  footer: "📝 底部提醒",
};

export default function AdminCollectionHubPage() {
  const [items, setItems] = useState<HubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<HubItem> & { dirty: boolean; saving: boolean; msg: string | null; translating: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/collection-hub", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/?redirect=/admin/collection-hub";
        return;
      }
      if (!res.ok) {
        setError(`載入失敗:HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      const list: HubItem[] = json.items ?? [];
      setItems(list);
      const next: typeof drafts = {};
      for (const i of list) {
        next[i.id] = {
          title_zh: i.title_zh,
          title_en: i.title_en,
          title_ja: i.title_ja,
          title_ko: i.title_ko,
          body_zh: i.body_zh,
          body_en: i.body_en,
          body_ja: i.body_ja,
          body_ko: i.body_ko,
          active: i.active,
          dirty: false,
          saving: false,
          translating: false,
          msg: null,
        };
      }
      setDrafts(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (id: string, field: keyof HubItem, value: unknown) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value, dirty: true, msg: null },
    }));
  };

  const handleSave = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    setDrafts((prev) => ({ ...prev, [id]: { ...d, saving: true, msg: null } }));
    try {
      const res = await fetch("/api/admin/collection-hub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          titleZh: d.title_zh,
          titleEn: d.title_en,
          titleJa: d.title_ja,
          titleKo: d.title_ko,
          bodyZh: d.body_zh,
          bodyEn: d.body_en,
          bodyJa: d.body_ja,
          bodyKo: d.body_ko,
          active: d.active,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(json.detail) ? json.detail.join(", ") : (json.detail ?? json.error);
        setDrafts((prev) => ({ ...prev, [id]: { ...d, saving: false, msg: `❌ ${detail}` } }));
        return;
      }
      await load();
    } catch (e) {
      setDrafts((prev) => ({
        ...prev,
        [id]: { ...d, saving: false, msg: `❌ ${e instanceof Error ? e.message : String(e)}` },
      }));
    }
  };

  const handleTranslate = async (id: string, mode: "missing-only" | "all") => {
    const d = drafts[id];
    if (!d) return;
    if (d.dirty) {
      if (!confirm("有尚未儲存的變更 — 自動翻譯會用 DB 裡的 zh 而不是你目前編輯的 zh,要繼續嗎?(建議先儲存)")) {
        return;
      }
    }
    setDrafts((prev) => ({ ...prev, [id]: { ...d, translating: true, msg: null } }));
    try {
      const res = await fetch(`/api/admin/collection-hub/translate?id=${encodeURIComponent(id)}&mode=${mode}`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        setDrafts((prev) => ({
          ...prev,
          [id]: { ...d, translating: false, msg: `❌ ${json.detail ?? json.error}` },
        }));
        return;
      }
      await load();
      const langsLabel = (json.translated as string[])?.join(", ") || "(無)";
      setDrafts((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          translating: false,
          msg: `✓ 已翻譯 ${langsLabel}${json.errors?.length > 0 ? ` · ❌ ${json.errors.length} 失敗` : ""}`,
        },
      }));
    } catch (e) {
      setDrafts((prev) => ({
        ...prev,
        [id]: { ...d, translating: false, msg: `❌ ${e instanceof Error ? e.message : String(e)}` },
      }));
    }
  };

  // group by section for display
  const grouped = items.reduce<Record<string, HubItem[]>>((acc, c) => {
    (acc[c.section] = acc[c.section] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <Header />
      <main
        style={{
          paddingTop: 24,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, color: "#d4a855", fontFamily: "'Noto Serif TC', serif", marginBottom: 4 }}>
            ✦ 收藏中心文案
          </h1>
          <p style={{ color: "rgba(192,192,208,0.65)", fontSize: 12, lineHeight: 1.7 }}>
            管理 <code>/collection</code> 頁面所有文案 — hero card 標題、收集規則、CTA、底部提醒。
            改動立即生效(public API 是 no-store)。
            <br />
            ⚡ <strong>自動翻譯</strong>:從 zh 一鍵翻 en/ja/ko。預設「只填空欄」(已有翻譯不動),
            按 [全部覆寫] 才會強制覆蓋。改完 zh 建議先 [儲存] 再點翻譯,否則翻譯會用 DB 裡的舊 zh。
          </p>
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 8, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.4)", color: "#fca5a5", marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "rgba(192,192,208,0.4)" }}>載入中…</div>
        ) : (
          Object.entries(grouped).map(([section, list]) => (
            <section key={section} style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, color: "#d4a855", marginBottom: 10, paddingLeft: 4 }}>
                {SECTION_LABEL[section] ?? section}
              </h2>
              {list.map((item) => {
                const d = drafts[item.id];
                if (!d) return null;
                return (
                  <div key={item.id} className="mystic-card" style={{ padding: 16, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <code style={{ fontSize: 11, color: "rgba(212,168,85,0.85)" }}>{item.id}</code>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <label style={{ fontSize: 11, color: "rgba(192,192,208,0.6)", display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={d.active ?? true}
                            onChange={(e) => update(item.id, "active", e.target.checked)}
                          />
                          啟用
                        </label>
                        <button
                          onClick={() => handleTranslate(item.id, "missing-only")}
                          disabled={d.translating || !item.title_zh && !item.body_zh}
                          style={chip("#fde68a", "rgba(212,168,85,0.4)")}
                        >
                          {d.translating ? "翻譯中…" : "⚡ 自動翻譯空欄"}
                        </button>
                        <button
                          onClick={() => handleTranslate(item.id, "all")}
                          disabled={d.translating || !item.title_zh && !item.body_zh}
                          style={chip("rgba(192,192,208,0.7)", "rgba(192,192,208,0.3)")}
                        >
                          全部覆寫
                        </button>
                        <button
                          onClick={() => handleSave(item.id)}
                          disabled={!d.dirty || d.saving}
                          style={{
                            padding: "5px 14px",
                            fontSize: 11,
                            borderRadius: 9999,
                            border: d.dirty ? "1px solid #d4a855" : "1px solid rgba(192,192,208,0.2)",
                            background: d.dirty ? "linear-gradient(135deg,#d4a855,#f0d78c)" : "transparent",
                            color: d.dirty ? "#0a0a1a" : "rgba(192,192,208,0.5)",
                            cursor: d.dirty && !d.saving ? "pointer" : "default",
                            fontWeight: d.dirty ? 700 : 400,
                          }}
                        >
                          {d.saving ? "儲存中…" : d.dirty ? "儲存" : "已存"}
                        </button>
                      </div>
                    </div>

                    {d.msg && (
                      <div
                        style={{
                          fontSize: 11,
                          padding: 6,
                          borderRadius: 4,
                          background: d.msg.startsWith("✓") ? "rgba(110,231,183,0.08)" : "rgba(248,113,113,0.08)",
                          color: d.msg.startsWith("✓") ? "#6ee7b7" : "#fca5a5",
                          marginBottom: 10,
                        }}
                      >
                        {d.msg}
                      </div>
                    )}

                    {/* Title 4 語系 */}
                    {(item.title_zh !== null || item.title_en !== null) && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: "rgba(212,168,85,0.6)", marginBottom: 3 }}>標題 (title)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          <Field lang="zh" value={d.title_zh ?? ""} onChange={(v) => update(item.id, "title_zh", v)} />
                          <Field lang="en" value={d.title_en ?? ""} onChange={(v) => update(item.id, "title_en", v)} />
                          <Field lang="ja" value={d.title_ja ?? ""} onChange={(v) => update(item.id, "title_ja", v)} />
                          <Field lang="ko" value={d.title_ko ?? ""} onChange={(v) => update(item.id, "title_ko", v)} />
                        </div>
                      </div>
                    )}

                    {/* Body 4 語系 */}
                    {(item.body_zh !== null || item.body_en !== null) && (
                      <div>
                        <div style={{ fontSize: 10, color: "rgba(212,168,85,0.6)", marginBottom: 3 }}>內文 (body)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          <FieldArea lang="zh" value={d.body_zh ?? ""} onChange={(v) => update(item.id, "body_zh", v)} />
                          <FieldArea lang="en" value={d.body_en ?? ""} onChange={(v) => update(item.id, "body_en", v)} />
                          <FieldArea lang="ja" value={d.body_ja ?? ""} onChange={(v) => update(item.id, "body_ja", v)} />
                          <FieldArea lang="ko" value={d.body_ko ?? ""} onChange={(v) => update(item.id, "body_ko", v)} />
                        </div>
                      </div>
                    )}

                    {(item.link_href || item.image_slot) && (
                      <div style={{ fontSize: 10, color: "rgba(192,192,208,0.4)", marginTop: 8, paddingTop: 8, borderTop: "1px dashed rgba(212,168,85,0.1)" }}>
                        {item.link_href && <span>連結:<code>{item.link_href}</code></span>}
                        {item.link_href && item.image_slot && " · "}
                        {item.image_slot && <span>圖 slot:<code>{item.image_slot}</code></span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))
        )}
      </main>
    </div>
  );
}

function chip(color: string, border: string): React.CSSProperties {
  return {
    padding: "5px 10px",
    fontSize: 11,
    borderRadius: 9999,
    border: `1px solid ${border}`,
    background: "transparent",
    color,
    cursor: "pointer",
  };
}

function Field({ lang, value, onChange }: { lang: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(192,192,208,0.4)", marginBottom: 2 }}>{lang}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: 4,
          border: "1px solid rgba(212,168,85,0.2)",
          background: "rgba(13,13,43,0.5)",
          color: "#e8e8f0",
          fontSize: 12,
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function FieldArea({ lang, value, onChange }: { lang: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: "rgba(192,192,208,0.4)", marginBottom: 2 }}>{lang}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: 4,
          border: "1px solid rgba(212,168,85,0.2)",
          background: "rgba(13,13,43,0.5)",
          color: "#e8e8f0",
          fontSize: 12,
          fontFamily: "inherit",
          boxSizing: "border-box",
          resize: "vertical",
        }}
      />
    </div>
  );
}
