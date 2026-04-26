"use client";

/**
 * /admin/pricing — 編輯加購方案 + 訂閱方案
 *
 * 修改後 60 秒內生效(public /api/pricing 有 60s cache)。
 *
 * ⚠ 必看警告:Play Console SKU 價格無法從這裡同步,改完 web 價格後
 * 必須手動到 Play Console 把 SKU 價也改一致,否則 TWA app 內 Play Billing
 * 顯示的價格跟 web 不符,違反 Google Play 反導向政策。
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";

interface CreditPack {
  id: string;
  credits: number;
  bonus_credits: number;
  price_twd: number;
  price_usd: number | null;
  highlighted: boolean;
  active: boolean;
  display_order: number;
  zh_label: string | null;
  en_label: string | null;
  play_sku_id: string | null;
  notes: string | null;
}

interface SubscriptionPlan {
  id: string;
  price_twd: number;
  price_usd: number | null;
  amortize_months: number;
  monthly_credits: number;
  highlighted: boolean;
  active: boolean;
  display_order: number;
  zh_label: string | null;
  en_label: string | null;
  play_sku_id: string | null;
  ecpay_period_type: "M" | "Y" | null;
  ecpay_frequency: number | null;
  ecpay_exec_times: number | null;
  notes: string | null;
}

export default function AdminPricingPage() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pricing", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/?redirect=/admin/pricing";
        return;
      }
      const data = await res.json();
      setPacks(data.packs);
      setPlans(data.plans);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePack = async (id: string, changes: Partial<CreditPack>) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/pricing/credit-packs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.detail ?? j.error);
        return;
      }
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const savePlan = async (id: string, changes: Partial<SubscriptionPlan>) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/pricing/subscription-plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.detail ?? j.error);
        return;
      }
      await load();
    } finally {
      setSavingId(null);
    }
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
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 24, marginTop: 16, marginBottom: 12 }}
        >
          方案 / 點數金額
        </h1>

        {/* Play Console 同步警告 */}
        <div
          style={{
            padding: 14,
            marginBottom: 20,
            borderRadius: 10,
            background: "rgba(255,176,72,0.1)",
            border: "1px solid rgba(255,176,72,0.4)",
            color: "#ffd99a",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Play Console SKU 必須手動同步</div>
          這裡改 web 價格(綠界結帳會即時生效),但 Android app 內走 Play Billing 的價格鎖在 Play Console SKU 上。
          價格改完後必須到{" "}
          <a
            href="https://play.google.com/console"
            target="_blank"
            rel="noopener"
            style={{ color: "#ffd99a", textDecoration: "underline" }}
          >
            Play Console
          </a>{" "}
          把對應 SKU 的價格也改成一致,否則 TWA 用戶看到的價格跟 web 不一樣,違反 Google Play anti-steering 政策。
        </div>

        {loading && <div style={{ color: "rgba(192,192,208,0.5)" }}>載入中…</div>}

        {/* ── 加購方案 ── */}
        <h2 style={{ fontSize: 16, color: "#d4a855", marginTop: 8, marginBottom: 12 }}>加購點數方案</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {packs.map((p) => (
            <PackEditor
              key={p.id}
              pack={p}
              onSave={(changes) => savePack(p.id, changes)}
              busy={savingId === p.id}
            />
          ))}
        </div>

        {/* ── 訂閱方案 ── */}
        <h2 style={{ fontSize: 16, color: "#d4a855", marginTop: 8, marginBottom: 12 }}>訂閱方案</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {plans.map((p) => (
            <PlanEditor
              key={p.id}
              plan={p}
              onSave={(changes) => savePlan(p.id, changes)}
              busy={savingId === p.id}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

// ──────── PackEditor 子元件 ────────
function PackEditor({
  pack,
  onSave,
  busy,
}: {
  pack: CreditPack;
  onSave: (changes: Partial<CreditPack>) => void;
  busy: boolean;
}) {
  const [credits, setCredits] = useState(pack.credits);
  const [bonus, setBonus] = useState(pack.bonus_credits);
  const [twd, setTwd] = useState(pack.price_twd);
  const [usd, setUsd] = useState(pack.price_usd ?? "");
  const [zh, setZh] = useState(pack.zh_label ?? "");
  const [en, setEn] = useState(pack.en_label ?? "");
  const [active, setActive] = useState(pack.active);
  const [highlighted, setHighlighted] = useState(pack.highlighted);

  const dirty =
    credits !== pack.credits ||
    bonus !== pack.bonus_credits ||
    twd !== pack.price_twd ||
    String(usd) !== String(pack.price_usd ?? "") ||
    zh !== (pack.zh_label ?? "") ||
    en !== (pack.en_label ?? "") ||
    active !== pack.active ||
    highlighted !== pack.highlighted;

  return (
    <div className="mystic-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: "#d4a855" }}>
          {pack.id} {pack.play_sku_id ? `· Play SKU: ${pack.play_sku_id}` : ""}
        </div>
        <div style={{ fontSize: 11, color: pack.active ? "#6ee7b7" : "rgba(192,192,208,0.4)" }}>
          {pack.active ? "上架中" : "已下架"}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
        <Field label="基本點數" type="number" value={credits} onChange={(v) => setCredits(parseInt(v) || 0)} />
        <Field label="贈送點數" type="number" value={bonus} onChange={(v) => setBonus(parseInt(v) || 0)} />
        <Field label="NT$" type="number" value={twd} onChange={(v) => setTwd(parseInt(v) || 0)} />
        <Field label="USD" type="text" value={usd} onChange={(v) => setUsd(v)} placeholder="(可空)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Field label="中文標籤" type="text" value={zh} onChange={(v) => setZh(v)} />
        <Field label="英文標籤" type="text" value={en} onChange={(v) => setEn(v)} />
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "center" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          上架
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <input
            type="checkbox"
            checked={highlighted}
            onChange={(e) => setHighlighted(e.target.checked)}
          />
          標示「最划算」
        </label>
        <button
          onClick={() =>
            onSave({
              credits,
              bonus_credits: bonus,
              price_twd: twd,
              price_usd: usd === "" ? null : Number(usd),
              zh_label: zh,
              en_label: en,
              active,
              highlighted,
            })
          }
          disabled={!dirty || busy}
          className="btn-gold"
          style={{
            marginLeft: "auto",
            padding: "6px 16px",
            fontSize: 12,
            opacity: dirty && !busy ? 1 : 0.4,
            cursor: dirty && !busy ? "pointer" : "not-allowed",
          }}
        >
          {busy ? "存中…" : "儲存"}
        </button>
      </div>
    </div>
  );
}

// ──────── PlanEditor 子元件 ────────
function PlanEditor({
  plan,
  onSave,
  busy,
}: {
  plan: SubscriptionPlan;
  onSave: (changes: Partial<SubscriptionPlan>) => void;
  busy: boolean;
}) {
  const [twd, setTwd] = useState(plan.price_twd);
  const [usd, setUsd] = useState(plan.price_usd ?? "");
  const [credits, setCredits] = useState(plan.monthly_credits);
  const [zh, setZh] = useState(plan.zh_label ?? "");
  const [en, setEn] = useState(plan.en_label ?? "");
  const [active, setActive] = useState(plan.active);
  const [highlighted, setHighlighted] = useState(plan.highlighted);

  const dirty =
    twd !== plan.price_twd ||
    String(usd) !== String(plan.price_usd ?? "") ||
    credits !== plan.monthly_credits ||
    zh !== (plan.zh_label ?? "") ||
    en !== (plan.en_label ?? "") ||
    active !== plan.active ||
    highlighted !== plan.highlighted;

  return (
    <div className="mystic-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontFamily: "monospace", fontSize: 12, color: "#d4a855" }}>
          {plan.id} · {plan.amortize_months} 個月期 · ECPay {plan.ecpay_period_type}/{plan.ecpay_frequency}
          {plan.play_sku_id ? ` · Play SKU: ${plan.play_sku_id}` : ""}
        </div>
        <div style={{ fontSize: 11, color: plan.active ? "#6ee7b7" : "rgba(192,192,208,0.4)" }}>
          {plan.active ? "上架中" : "已下架"}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
        <Field label="NT$" type="number" value={twd} onChange={(v) => setTwd(parseInt(v) || 0)} />
        <Field label="USD" type="text" value={usd} onChange={(v) => setUsd(v)} placeholder="(可空)" />
        <Field
          label="每月補點"
          type="number"
          value={credits}
          onChange={(v) => setCredits(parseInt(v) || 0)}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <Field label="中文標籤" type="text" value={zh} onChange={(v) => setZh(v)} />
        <Field label="英文標籤" type="text" value={en} onChange={(v) => setEn(v)} />
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 4, alignItems: "center" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          上架
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <input
            type="checkbox"
            checked={highlighted}
            onChange={(e) => setHighlighted(e.target.checked)}
          />
          推薦
        </label>
        <button
          onClick={() =>
            onSave({
              price_twd: twd,
              price_usd: usd === "" ? null : Number(usd),
              monthly_credits: credits,
              zh_label: zh,
              en_label: en,
              active,
              highlighted,
            })
          }
          disabled={!dirty || busy}
          className="btn-gold"
          style={{
            marginLeft: "auto",
            padding: "6px 16px",
            fontSize: 12,
            opacity: dirty && !busy ? 1 : 0.4,
            cursor: dirty && !busy ? "pointer" : "not-allowed",
          }}
        >
          {busy ? "存中…" : "儲存"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 10, color: "rgba(192,192,208,0.6)", textTransform: "uppercase" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "8px 10px",
          marginTop: 4,
          borderRadius: 6,
          border: "1px solid rgba(212,168,85,0.3)",
          background: "rgba(13,13,43,0.5)",
          color: "#e8e8f0",
          fontSize: 13,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
