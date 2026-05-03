"use client";

/**
 * /admin/credit-costs — 占卜成本(CREDIT_COSTS)即時調整
 *
 * 一張表 inline 編輯 amount + 啟停。改完點 [儲存] 立刻生效(後端清快取)。
 *
 * 注意:這頁只改現有 key 的 amount。新加的 cost key 必須先在
 *       lib/credits.ts CREDIT_COSTS + 各 route 程式碼裡使用,光在這裡新增 row 沒用。
 */

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import AdminNav from "@/components/admin/AdminNav";

interface CreditCost {
  id: string;
  amount: number;
  label_zh: string;
  label_en: string;
  description_zh: string | null;
  description_en: string | null;
  category: string;
  active: boolean;
  sort_order: number;
  updated_at: string;
}

interface RowDraft {
  amount: number;
  active: boolean;
  dirty: boolean;
  saving: boolean;
  error: string | null;
}

export default function AdminCreditCostsPage() {
  const [items, setItems] = useState<CreditCost[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/credit-costs", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        window.location.href = `/?redirect=/admin/credit-costs`;
        return;
      }
      if (!res.ok) {
        setError(`載入失敗:HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      const list: CreditCost[] = json.costs ?? [];
      setItems(list);
      // reset drafts to current DB values
      const next: Record<string, RowDraft> = {};
      for (const c of list) {
        next[c.id] = { amount: c.amount, active: c.active, dirty: false, saving: false, error: null };
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

  const handleAmountChange = (id: string, value: string) => {
    const n = parseInt(value, 10);
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], amount: Number.isFinite(n) ? n : 0, dirty: true, error: null },
    }));
  };

  const handleActiveChange = (id: string, val: boolean) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], active: val, dirty: true, error: null },
    }));
  };

  const handleSave = async (item: CreditCost) => {
    const draft = drafts[item.id];
    if (!draft) return;
    setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, saving: true, error: null } }));
    try {
      const res = await fetch("/api/admin/credit-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          amount: draft.amount,
          labelZh: item.label_zh,
          labelEn: item.label_en,
          descriptionZh: item.description_zh,
          descriptionEn: item.description_en,
          category: item.category,
          active: draft.active,
          sortOrder: item.sort_order,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(json.detail) ? json.detail.join(", ") : (json.detail ?? json.error);
        setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, saving: false, error: detail ?? `HTTP ${res.status}` } }));
        return;
      }
      // success — reload everything to get fresh updated_at
      await load();
    } catch (e) {
      setDrafts((prev) => ({
        ...prev,
        [item.id]: { ...draft, saving: false, error: e instanceof Error ? e.message : String(e) },
      }));
    }
  };

  // group by category for display
  const grouped = items.reduce<Record<string, CreditCost[]>>((acc, c) => {
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});

  const CATEGORY_LABEL: Record<string, string> = {
    iching: "🪙 易經",
    tarot: "🃏 塔羅",
    shared: "🔄 共用 / 加成",
    general: "其他",
  };

  return (
    <div className="min-h-screen">
      <Header />
      <AdminNav />
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
            ✦ 占卜點數成本
          </h1>
          <p style={{ color: "rgba(192,192,208,0.65)", fontSize: 12, lineHeight: 1.7 }}>
            DB 是 source of truth — 改完 60 秒內全 server 生效(本頁 [儲存] 會強制清快取立刻生效)。
            停用某項成本會自動 fallback 到 <code>lib/credits.ts CREDIT_COSTS</code> 的 hardcode 值。
            上限 1000 點/次 是安全閘,所有變更走 audit log。
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
          Object.entries(grouped).map(([cat, list]) => (
            <section key={cat} className="mystic-card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(192,192,208,0.08)", fontSize: 13, color: "#d4a855" }}>
                {CATEGORY_LABEL[cat] ?? cat}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(212,168,85,0.04)", color: "rgba(192,192,208,0.6)" }}>
                    <th style={th}>項目</th>
                    <th style={{ ...th, width: 80, textAlign: "right" }}>點數</th>
                    <th style={{ ...th, width: 60, textAlign: "center" }}>啟用</th>
                    <th style={{ ...th, width: 110, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const d = drafts[c.id];
                    if (!d) return null;
                    return (
                      <tr key={c.id} style={{ borderTop: "1px solid rgba(192,192,208,0.06)" }}>
                        <td style={{ ...td, lineHeight: 1.5 }}>
                          <div style={{ fontWeight: 600, color: "#e8e8f0" }}>{c.label_zh}</div>
                          <div style={{ color: "rgba(192,192,208,0.55)", fontSize: 11 }}>
                            <code style={{ color: "rgba(212,168,85,0.85)" }}>{c.id}</code>
                            {c.description_zh ? ` · ${c.description_zh}` : ""}
                          </div>
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <input
                            type="number"
                            value={d.amount}
                            min={0}
                            max={1000}
                            onChange={(e) => handleAmountChange(c.id, e.target.value)}
                            style={{
                              width: 72,
                              padding: "5px 8px",
                              borderRadius: 6,
                              border: "1px solid rgba(212,168,85,0.3)",
                              background: "rgba(13,13,43,0.5)",
                              color: d.dirty ? "#fde68a" : "#e8e8f0",
                              fontSize: 13,
                              textAlign: "right",
                              fontFamily: "inherit",
                            }}
                          />
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={d.active}
                            onChange={(e) => handleActiveChange(c.id, e.target.checked)}
                          />
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {d.error && (
                            <div style={{ color: "#fca5a5", fontSize: 10, marginBottom: 4 }}>{d.error}</div>
                          )}
                          <button
                            onClick={() => handleSave(c)}
                            disabled={!d.dirty || d.saving}
                            style={{
                              padding: "5px 12px",
                              fontSize: 11,
                              borderRadius: 9999,
                              border: d.dirty ? "1px solid #d4a855" : "1px solid rgba(192,192,208,0.2)",
                              background: d.dirty ? "linear-gradient(135deg, #d4a855, #f0d78c)" : "transparent",
                              color: d.dirty ? "#0a0a1a" : "rgba(192,192,208,0.5)",
                              cursor: d.dirty && !d.saving ? "pointer" : "default",
                              fontWeight: d.dirty ? 700 : 400,
                            }}
                          >
                            {d.saving ? "儲存中…" : d.dirty ? "儲存" : "已存"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))
        )}

        <p style={{ color: "rgba(192,192,208,0.4)", fontSize: 11, lineHeight: 1.6, marginTop: 16 }}>
          ※ 這頁不能新增 / 刪除 cost key — 程式碼端要對應加 <code>getCreditCost(&quot;NEW_KEY&quot;)</code> 才會生效,
          所以新 key 應該由 dev 加進 <code>lib/credits.ts CREDIT_COSTS</code> + 寫一支 SQL 增加 row,本頁僅供金額調整。
        </p>
      </main>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 14px",
  textAlign: "left",
  fontWeight: 500,
};
const td: React.CSSProperties = {
  padding: "10px 14px",
  verticalAlign: "middle",
};
