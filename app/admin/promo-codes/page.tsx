"use client";

/**
 * /admin/promo-codes — 促銷碼 CRUD
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed_amount" | "bonus_credits" | "free_period";
  discount_value: number;
  applies_to: string;
  usage_limit: number | null;
  per_user_limit: number;
  starts_at: string;
  expires_at: string | null;
  active: boolean;
  total_redemptions: number;
  notes: string | null;
}

const DISCOUNT_LABEL: Record<string, string> = {
  percentage: "折扣 %",
  fixed_amount: "固定折抵 NT$",
  bonus_credits: "加贈點數",
  free_period: "免費期(月)",
};

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);

  // create form
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<PromoCode["discount_type"]>("percentage");
  const [discountValue, setDiscountValue] = useState("10");
  const [appliesTo, setAppliesTo] = useState("all");
  const [usageLimit, setUsageLimit] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promo-codes", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/promo-codes";
        return;
      }
      const data = (await res.json()) as { codes: PromoCode[] };
      setCodes(data.codes);
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
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          description: description.trim() || null,
          discountType,
          discountValue: parseFloat(discountValue) || 0,
          appliesTo,
          usageLimit: usageLimit === "" ? null : parseInt(usageLimit, 10),
          perUserLimit: parseInt(perUserLimit, 10) || 1,
          expiresAt: expiresAt || null,
          active: true,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.detail ?? j.error);
        return;
      }
      setCode("");
      setDescription("");
      setExpiresAt("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id: number, current: boolean) => {
    await fetch(`/api/admin/promo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !current }),
    });
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm("確定刪除這張促銷碼?(已兌換的記錄會一併刪除)")) return;
    await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
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
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 24, marginTop: 16, marginBottom: 16 }}
        >
          促銷碼
        </h1>

        {/* ── 新增 ── */}
        <form onSubmit={handleCreate} className="mystic-card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, color: "#d4a855", marginBottom: 14 }}>新增促銷碼</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Field label="代碼(英數,自動轉大寫)">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LUNAR2026" style={inputStyle} required />
            </Field>
            <Field label="折扣類型">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as PromoCode["discount_type"])}
                style={inputStyle}
              >
                <option value="percentage">折扣百分比(數字 = 折幾%)</option>
                <option value="fixed_amount">固定金額折抵(NT$)</option>
                <option value="bonus_credits">加贈點數</option>
                <option value="free_period">免費期月數</option>
              </select>
            </Field>
            <Field label="折扣值">
              <input
                type="number"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <Field label="適用對象">
              <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} style={inputStyle}>
                <option value="all">全部</option>
                <option value="credit_pack">所有加購方案</option>
                <option value="subscription">所有訂閱方案</option>
                <option value="pack:pack_200">僅 pack_200</option>
                <option value="pack:pack_500">僅 pack_500</option>
                <option value="pack:pack_1200">僅 pack_1200</option>
                <option value="plan:monthly">僅月訂閱</option>
                <option value="plan:yearly">僅年訂閱</option>
              </select>
            </Field>
            <Field label="總使用上限(留空=無限)">
              <input type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="100" style={inputStyle} />
            </Field>
            <Field label="每位使用者上限">
              <input type="number" value={perUserLimit} onChange={(e) => setPerUserLimit(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
            <Field label="到期時間(可選)">
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="說明(內部用)">
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="春節活動" style={inputStyle} />
            </Field>
          </div>

          <button type="submit" disabled={busy} className="btn-gold" style={{ padding: "8px 18px", fontSize: 13 }}>
            {busy ? "建立中…" : "建立促銷碼"}
          </button>
        </form>

        {/* ── 列表 ── */}
        {loading ? (
          <div style={{ color: "rgba(192,192,208,0.5)" }}>載入中…</div>
        ) : (
          <div className="mystic-card" style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(212,168,85,0.06)", color: "rgba(192,192,208,0.7)" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>代碼</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>類型</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>值</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>適用</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>已用 / 上限</th>
                  <th style={{ padding: "10px 12px", textAlign: "left" }}>到期</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>狀態</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} style={{ borderTop: "1px solid rgba(192,192,208,0.08)" }}>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#d4a855" }}>{c.code}</td>
                    <td style={{ padding: "10px 12px" }}>{DISCOUNT_LABEL[c.discount_type]}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#6ee7b7" }}>{c.discount_value}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(192,192,208,0.6)" }}>{c.applies_to}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "rgba(192,192,208,0.7)" }}>
                      {c.total_redemptions}
                      {c.usage_limit ? ` / ${c.usage_limit}` : " /∞"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "rgba(192,192,208,0.6)" }}>
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString("zh-TW") : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <button
                        onClick={() => toggleActive(c.id, c.active)}
                        style={{
                          padding: "3px 10px",
                          fontSize: 11,
                          borderRadius: 9999,
                          border: `1px solid ${c.active ? "rgba(110,231,183,0.4)" : "rgba(192,192,208,0.2)"}`,
                          background: c.active ? "rgba(110,231,183,0.1)" : "transparent",
                          color: c.active ? "#6ee7b7" : "rgba(192,192,208,0.6)",
                          cursor: "pointer",
                        }}
                      >
                        {c.active ? "ON" : "OFF"}
                      </button>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}>
                      <button
                        onClick={() => remove(c.id)}
                        style={{
                          padding: "3px 10px",
                          fontSize: 11,
                          borderRadius: 6,
                          border: "1px solid rgba(248,113,113,0.4)",
                          background: "transparent",
                          color: "#fca5a5",
                          cursor: "pointer",
                        }}
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
                {codes.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "rgba(192,192,208,0.4)" }}>
                      尚無促銷碼
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid rgba(212,168,85,0.3)",
  background: "rgba(13,13,43,0.5)",
  color: "#e8e8f0",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  marginTop: 4,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "rgba(192,192,208,0.6)" }}>{label}</label>
      {children}
    </div>
  );
}
