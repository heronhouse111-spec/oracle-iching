"use client";

/**
 * /admin/users/[id] — 使用者詳情頁(含補/扣點操作)
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "@/components/Header";

interface UserDetail {
  profile: {
    id: string;
    email: string | null;
    signed_up_at: string;
    last_sign_in_at: string | null;
    display_name: string | null;
    preferred_locale: string | null;
    is_admin: boolean | null;
    credits_balance: number;
    credits_refills_at: string | null;
    role?: "user" | "support" | "admin" | "super_admin";
    banned?: boolean;
    banned_reason?: string | null;
    banned_at?: string | null;
  };
  subscription: {
    plan: string;
    status: string;
    started_at: string;
    expires_at: string | null;
    provider: string;
    is_active: boolean;
  } | null;
  divinations: Array<{
    id: string;
    question: string;
    category: string;
    hexagram_number: number;
    locale: string;
    divine_type: string;
    created_at: string;
  }>;
  grants: Array<{
    id: number;
    delta: number;
    balance_after: number;
    reason: string;
    granted_by_email: string;
    related_order_mtn: string | null;
    created_at: string;
  }>;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** 把 ISO 字串轉成 <input type="datetime-local"> 接受的本地時間值(yyyy-MM-ddTHH:mm) */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SUB_PLAN_LABEL: Record<string, string> = {
  monthly: "月訂閱",
  yearly: "年訂閱",
  lifetime: "終身",
};

const SUB_STATUS_LABEL: Record<string, string> = {
  free: "免費",
  active: "訂閱中",
  canceled: "已取消(未到期)",
  expired: "已過期",
};

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // grant modal state
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantDelta, setGrantDelta] = useState("100");
  const [grantReason, setGrantReason] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  // ban modal state
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banBusy, setBanBusy] = useState(false);

  // subscription modal state
  const [subOpen, setSubOpen] = useState(false);
  const [subAction, setSubAction] = useState<
    "activate" | "cancel" | "expire" | "clear"
  >("activate");
  const [subPlan, setSubPlan] = useState<"monthly" | "yearly" | "lifetime">(
    "monthly",
  );
  const [subExpiresAt, setSubExpiresAt] = useState("");
  const [subReason, setSubReason] = useState("");
  const [subBusy, setSubBusy] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = `/?redirect=/admin/users/${id}`;
        return;
      }
      if (!res.ok) {
        setError(`載入失敗:HTTP ${res.status}`);
        return;
      }
      const json = (await res.json()) as UserDetail;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBan = async () => {
    if (banReason.trim().length < 4) {
      alert("封鎖原因至少 4 字");
      return;
    }
    setBanBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason.trim() }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.detail ?? j.error);
        return;
      }
      setBanOpen(false);
      setBanReason("");
      await load();
    } finally {
      setBanBusy(false);
    }
  };

  const handleUnban = async () => {
    if (!confirm("確定解除封鎖?")) return;
    const res = await fetch(`/api/admin/users/${id}/ban`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json();
      alert(j.detail ?? j.error);
      return;
    }
    await load();
  };

  const openSubModal = () => {
    // 預設動作:目前仍在有效期 → cancel,否則 → activate
    const current = data?.subscription;
    const stillValid =
      !!current &&
      (current.status === "active" || current.status === "canceled") &&
      (!current.expires_at || new Date(current.expires_at).getTime() > Date.now());
    if (stillValid && current?.expires_at) {
      setSubAction("cancel");
      setSubExpiresAt(toLocalInputValue(current.expires_at));
    } else {
      setSubAction("activate");
      setSubExpiresAt(toLocalInputValue(addDays(new Date(), 30).toISOString()));
    }
    setSubPlan(
      (current?.plan as "monthly" | "yearly" | "lifetime") ?? "monthly",
    );
    setSubReason("");
    setSubError(null);
    setSubOpen(true);
  };

  const handleSubmitSub = async () => {
    setSubError(null);
    if (subReason.trim().length < 4) {
      setSubError("原因至少 4 字");
      return;
    }
    const payload: Record<string, unknown> = {
      action: subAction,
      reason: subReason.trim(),
    };
    if (subAction === "activate") {
      if (!subExpiresAt) {
        setSubError("請指定到期日");
        return;
      }
      const expIso = new Date(subExpiresAt).toISOString();
      if (new Date(expIso).getTime() <= Date.now()) {
        setSubError("到期日必須是未來時間");
        return;
      }
      payload.plan = subPlan;
      payload.expiresAt = expIso;
    } else if (subAction === "cancel" && subExpiresAt) {
      payload.expiresAt = new Date(subExpiresAt).toISOString();
    }
    setSubBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) {
        setSubError(j.detail ?? j.error ?? `HTTP ${res.status}`);
        return;
      }
      setSubOpen(false);
      await load();
    } catch (e) {
      setSubError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubBusy(false);
    }
  };

  const handleGrant = async () => {
    setGrantError(null);
    setGrantSuccess(null);
    const delta = parseInt(grantDelta, 10);
    if (!Number.isFinite(delta) || delta === 0) {
      setGrantError("delta 必須是非零整數");
      return;
    }
    if (Math.abs(delta) > 10000) {
      setGrantError("|delta| 不能超過 10000(安全限制)");
      return;
    }
    if (grantReason.trim().length < 4) {
      setGrantError("原因至少 4 個字");
      return;
    }
    setGrantBusy(true);
    try {
      const res = await fetch(`/api/admin/credits/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: id,
          delta,
          reason: grantReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGrantError(json.detail ?? json.error ?? `HTTP ${res.status}`);
        return;
      }
      setGrantSuccess(
        `已${delta > 0 ? "補" : "扣"} ${Math.abs(delta)} 點。新餘額:${json.newBalance}`,
      );
      setGrantDelta("100");
      setGrantReason("");
      // refresh
      await load();
    } catch (e) {
      setGrantError(e instanceof Error ? e.message : String(e));
    } finally {
      setGrantBusy(false);
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Link
            href="/admin/users"
            style={{
              fontSize: 12,
              color: "rgba(192,192,208,0.6)",
              textDecoration: "none",
            }}
          >
            ← 使用者列表
          </Link>
        </div>

        {loading && (
          <div style={{ color: "rgba(192,192,208,0.5)" }}>載入中…</div>
        )}

        {error && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.4)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        {data && (
          <>
            {/* ─── Profile + Action ─── */}
            <div
              className="mystic-card"
              style={{ padding: 24, marginBottom: 16 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h1
                    style={{
                      fontFamily: "'Noto Serif TC', serif",
                      fontSize: 22,
                      color: "#d4a855",
                      marginBottom: 4,
                    }}
                  >
                    {data.profile.display_name ?? "(未設定名稱)"}
                  </h1>
                  <div style={{ color: "rgba(192,192,208,0.7)", fontSize: 13 }}>
                    {data.profile.email}
                  </div>
                  <div style={{ color: "rgba(192,192,208,0.5)", fontSize: 11, marginTop: 6 }}>
                    UID: <code>{data.profile.id}</code>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, fontSize: 11, flexWrap: "wrap" }}>
                    {data.profile.role && data.profile.role !== "user" && (
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 9999,
                          background: "rgba(212,168,85,0.15)",
                          border: "1px solid rgba(212,168,85,0.4)",
                          color: "#d4a855",
                          textTransform: "uppercase",
                        }}
                      >
                        {data.profile.role}
                      </span>
                    )}
                    {data.profile.banned && (
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 9999,
                          background: "rgba(248,113,113,0.15)",
                          border: "1px solid rgba(248,113,113,0.4)",
                          color: "#fca5a5",
                        }}
                        title={data.profile.banned_reason ?? ""}
                      >
                        🚫 BANNED
                      </span>
                    )}
                    {data.subscription?.is_active && (
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 9999,
                          background: "rgba(110,231,183,0.12)",
                          border: "1px solid rgba(110,231,183,0.4)",
                          color: "#6ee7b7",
                        }}
                      >
                        {SUB_PLAN_LABEL[data.subscription.plan] ?? data.subscription.plan}
                        ({data.subscription.provider})
                      </span>
                    )}
                  </div>
                  {/* 訂閱詳情 + 編輯按鈕 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 12,
                      fontSize: 12,
                      color: "rgba(192,192,208,0.7)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ color: "rgba(192,192,208,0.5)" }}>訂閱:</span>
                    <span>
                      {data.subscription
                        ? `${SUB_STATUS_LABEL[data.subscription.status] ?? data.subscription.status} · ${SUB_PLAN_LABEL[data.subscription.plan] ?? data.subscription.plan}`
                        : "—"}
                    </span>
                    {data.subscription?.expires_at && (
                      <span style={{ color: "rgba(192,192,208,0.5)" }}>
                        到期 {new Date(data.subscription.expires_at).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    )}
                    <button
                      onClick={openSubModal}
                      style={{
                        padding: "3px 10px",
                        fontSize: 11,
                        borderRadius: 9999,
                        border: "1px solid rgba(212,168,85,0.4)",
                        background: "rgba(212,168,85,0.08)",
                        color: "#d4a855",
                        cursor: "pointer",
                      }}
                    >
                      變更訂閱
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "rgba(192,192,208,0.5)", fontSize: 11 }}>目前餘額</div>
                  <div
                    style={{
                      fontFamily: "'Noto Serif TC', serif",
                      fontSize: 36,
                      fontWeight: 700,
                      color: "#d4a855",
                    }}
                  >
                    ✦ {data.profile.credits_balance}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => setGrantOpen(true)}
                      className="btn-gold"
                      style={{ padding: "8px 18px", fontSize: 13 }}
                    >
                      補 / 扣點
                    </button>
                    {data.profile.banned ? (
                      <button
                        onClick={handleUnban}
                        style={{
                          padding: "8px 18px",
                          fontSize: 13,
                          borderRadius: 9999,
                          border: "1px solid rgba(110,231,183,0.4)",
                          background: "rgba(110,231,183,0.08)",
                          color: "#6ee7b7",
                          cursor: "pointer",
                        }}
                      >
                        解封
                      </button>
                    ) : (
                      <button
                        onClick={() => setBanOpen(true)}
                        style={{
                          padding: "8px 18px",
                          fontSize: 13,
                          borderRadius: 9999,
                          border: "1px solid rgba(248,113,113,0.4)",
                          background: "rgba(248,113,113,0.08)",
                          color: "#fca5a5",
                          cursor: "pointer",
                        }}
                      >
                        🚫 封鎖
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Divinations history ─── */}
            <div
              className="mystic-card"
              style={{ padding: 0, marginBottom: 16, overflow: "hidden" }}
            >
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(192,192,208,0.08)" }}>
                <h2 style={{ fontSize: 14, color: "#d4a855" }}>近期占卜(最新 20 筆)</h2>
              </div>
              {data.divinations.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "rgba(192,192,208,0.4)", fontSize: 13 }}>
                  尚無占卜記錄
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "rgba(212,168,85,0.04)", color: "rgba(192,192,208,0.6)" }}>
                      <th style={{ padding: "8px 14px", textAlign: "left" }}>類別</th>
                      <th style={{ padding: "8px 14px", textAlign: "left" }}>類型</th>
                      <th style={{ padding: "8px 14px", textAlign: "left" }}>卦象</th>
                      <th style={{ padding: "8px 14px", textAlign: "left" }}>問題</th>
                      <th style={{ padding: "8px 14px", textAlign: "left" }}>時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.divinations.map((d) => (
                      <tr key={d.id} style={{ borderTop: "1px solid rgba(192,192,208,0.06)" }}>
                        <td style={{ padding: "8px 14px" }}>{d.category}</td>
                        <td style={{ padding: "8px 14px" }}>{d.divine_type}</td>
                        <td style={{ padding: "8px 14px" }}>{d.hexagram_number || "—"}</td>
                        <td
                          style={{
                            padding: "8px 14px",
                            maxWidth: 300,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {d.question}
                        </td>
                        <td style={{ padding: "8px 14px", color: "rgba(192,192,208,0.5)" }}>
                          {new Date(d.created_at).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ─── Credit grants log ─── */}
            <div
              className="mystic-card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(192,192,208,0.08)" }}>
                <h2 style={{ fontSize: 14, color: "#d4a855" }}>補/扣點記錄(最新 20 筆)</h2>
              </div>
              {data.grants.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "rgba(192,192,208,0.4)", fontSize: 13 }}>
                  尚無補扣點記錄
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "rgba(212,168,85,0.04)", color: "rgba(192,192,208,0.6)" }}>
                      <th style={{ padding: "8px 14px", textAlign: "right" }}>變動</th>
                      <th style={{ padding: "8px 14px", textAlign: "right" }}>事後餘額</th>
                      <th style={{ padding: "8px 14px", textAlign: "left" }}>原因</th>
                      <th style={{ padding: "8px 14px", textAlign: "left" }}>操作者</th>
                      <th style={{ padding: "8px 14px", textAlign: "left" }}>時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.grants.map((g) => (
                      <tr key={g.id} style={{ borderTop: "1px solid rgba(192,192,208,0.06)" }}>
                        <td
                          style={{
                            padding: "8px 14px",
                            textAlign: "right",
                            fontWeight: 600,
                            color: g.delta > 0 ? "#6ee7b7" : "#fca5a5",
                          }}
                        >
                          {g.delta > 0 ? "+" : ""}
                          {g.delta}
                        </td>
                        <td style={{ padding: "8px 14px", textAlign: "right" }}>{g.balance_after}</td>
                        <td style={{ padding: "8px 14px" }}>{g.reason}</td>
                        <td style={{ padding: "8px 14px", color: "rgba(192,192,208,0.6)" }}>
                          {g.granted_by_email}
                        </td>
                        <td style={{ padding: "8px 14px", color: "rgba(192,192,208,0.5)" }}>
                          {new Date(g.created_at).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ─── Grant modal ─── */}
        {grantOpen && (
          <div
            onClick={() => setGrantOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="mystic-card"
              style={{ padding: 24, maxWidth: 420, width: "100%" }}
            >
              <h3
                className="text-gold-gradient"
                style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 18, marginBottom: 12 }}
              >
                補 / 扣點
              </h3>
              <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginBottom: 16 }}>
                正數補,負數扣。範圍 ±10000。所有操作會留 audit log。
              </p>

              <label style={{ display: "block", color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 4 }}>
                變動點數(delta)
              </label>
              <input
                type="number"
                value={grantDelta}
                onChange={(e) => setGrantDelta(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(212,168,85,0.3)",
                  background: "rgba(13,13,43,0.5)",
                  color: "#e8e8f0",
                  fontSize: 14,
                  marginBottom: 12,
                  boxSizing: "border-box",
                }}
              />

              <label style={{ display: "block", color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 4 }}>
                原因(必填,≥4 字)
              </label>
              <textarea
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                rows={3}
                placeholder="例如:退款補償:訂單 ORC2026..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(212,168,85,0.3)",
                  background: "rgba(13,13,43,0.5)",
                  color: "#e8e8f0",
                  fontSize: 13,
                  resize: "none",
                  marginBottom: 12,
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />

              {grantError && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.4)",
                    color: "#fca5a5",
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  {grantError}
                </div>
              )}

              {grantSuccess && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    background: "rgba(110,231,183,0.08)",
                    border: "1px solid rgba(110,231,183,0.4)",
                    color: "#6ee7b7",
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  {grantSuccess}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setGrantOpen(false)}
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
                  關閉
                </button>
                <button
                  onClick={handleGrant}
                  disabled={grantBusy}
                  className="btn-gold"
                  style={{
                    padding: "8px 18px",
                    fontSize: 13,
                    opacity: grantBusy ? 0.6 : 1,
                    cursor: grantBusy ? "wait" : "pointer",
                  }}
                >
                  {grantBusy ? "處理中…" : "確認執行"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Subscription modal ─── */}
        {subOpen && (
          <div
            onClick={() => setSubOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="mystic-card"
              style={{ padding: 24, maxWidth: 460, width: "100%" }}
            >
              <h3
                className="text-gold-gradient"
                style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 18, marginBottom: 8 }}
              >
                變更訂閱狀態
              </h3>
              <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginBottom: 16 }}>
                目前:
                {data?.subscription
                  ? `${SUB_STATUS_LABEL[data.subscription.status] ?? data.subscription.status} · ${SUB_PLAN_LABEL[data.subscription.plan] ?? data.subscription.plan}${data.subscription.expires_at ? ` · 到期 ${new Date(data.subscription.expires_at).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}` : ""}`
                  : "免費"}
              </p>

              <label style={{ display: "block", color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 6 }}>
                操作
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {(
                  [
                    { v: "activate", label: "啟用 / 延長", color: "#6ee7b7" },
                    { v: "cancel", label: "取消(保留至到期)", color: "#fbbf24" },
                    { v: "expire", label: "立即終止", color: "#fca5a5" },
                    { v: "clear", label: "清除為免費", color: "rgba(192,192,208,0.8)" },
                  ] as const
                ).map((opt) => {
                  const active = subAction === opt.v;
                  return (
                    <button
                      key={opt.v}
                      onClick={() => setSubAction(opt.v)}
                      style={{
                        padding: "8px 10px",
                        fontSize: 12,
                        borderRadius: 8,
                        border: `1px solid ${active ? opt.color : "rgba(192,192,208,0.2)"}`,
                        background: active ? `${opt.color}1a` : "rgba(13,13,43,0.4)",
                        color: active ? opt.color : "rgba(192,192,208,0.7)",
                        cursor: "pointer",
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {subAction === "activate" && (
                <>
                  <label style={{ display: "block", color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 4 }}>
                    方案
                  </label>
                  <select
                    value={subPlan}
                    onChange={(e) => setSubPlan(e.target.value as "monthly" | "yearly" | "lifetime")}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(212,168,85,0.3)",
                      background: "rgba(13,13,43,0.5)",
                      color: "#e8e8f0",
                      fontSize: 13,
                      marginBottom: 12,
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="monthly">月訂閱</option>
                    <option value="yearly">年訂閱</option>
                    <option value="lifetime">終身</option>
                  </select>
                </>
              )}

              {(subAction === "activate" || subAction === "cancel") && (
                <>
                  <label
                    style={{
                      display: "block",
                      color: "rgba(192,192,208,0.7)",
                      fontSize: 11,
                      marginBottom: 4,
                    }}
                  >
                    到期日{subAction === "cancel" ? "(可調整,留空保留現值)" : ""}
                  </label>
                  <input
                    type="datetime-local"
                    value={subExpiresAt}
                    onChange={(e) => setSubExpiresAt(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(212,168,85,0.3)",
                      background: "rgba(13,13,43,0.5)",
                      color: "#e8e8f0",
                      fontSize: 13,
                      marginBottom: 8,
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                    {[
                      { label: "+30 天", days: 30 },
                      { label: "+90 天", days: 90 },
                      { label: "+1 年", days: 365 },
                    ].map((q) => (
                      <button
                        key={q.label}
                        onClick={() =>
                          setSubExpiresAt(
                            toLocalInputValue(addDays(new Date(), q.days).toISOString()),
                          )
                        }
                        style={{
                          padding: "4px 10px",
                          fontSize: 11,
                          borderRadius: 9999,
                          border: "1px solid rgba(192,192,208,0.2)",
                          background: "rgba(13,13,43,0.4)",
                          color: "rgba(192,192,208,0.7)",
                          cursor: "pointer",
                        }}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <label style={{ display: "block", color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 4 }}>
                原因(必填,≥4 字)
              </label>
              <textarea
                value={subReason}
                onChange={(e) => setSubReason(e.target.value)}
                rows={2}
                placeholder="例如:客服補償、推廣方案、退款處理"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(212,168,85,0.3)",
                  background: "rgba(13,13,43,0.5)",
                  color: "#e8e8f0",
                  fontSize: 13,
                  resize: "none",
                  marginBottom: 12,
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />

              {subError && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.4)",
                    color: "#fca5a5",
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  {subError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setSubOpen(false)}
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
                  取消
                </button>
                <button
                  onClick={handleSubmitSub}
                  disabled={subBusy}
                  className="btn-gold"
                  style={{
                    padding: "8px 18px",
                    fontSize: 13,
                    opacity: subBusy ? 0.6 : 1,
                    cursor: subBusy ? "wait" : "pointer",
                  }}
                >
                  {subBusy ? "處理中…" : "確認執行"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Ban modal ─── */}
        {banOpen && (
          <div
            onClick={() => setBanOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(4px)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="mystic-card"
              style={{ padding: 24, maxWidth: 420, width: "100%" }}
            >
              <h3 style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 18, color: "#fca5a5", marginBottom: 12 }}>
                🚫 封鎖使用者
              </h3>
              <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginBottom: 16 }}>
                封鎖後該帳號無法占卜、無法購買點數 / 訂閱。可隨時解封。
                <br />
                ⚠ 不能封鎖 admin / support 角色帳號。
              </p>

              <label style={{ display: "block", color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 4 }}>
                封鎖原因(必填,≥4 字)
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
                placeholder="例如:濫用 AI、洗排行榜、客訴未處理"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(248,113,113,0.3)",
                  background: "rgba(13,13,43,0.5)",
                  color: "#e8e8f0",
                  fontSize: 13,
                  resize: "none",
                  marginBottom: 12,
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setBanOpen(false)}
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
                  取消
                </button>
                <button
                  onClick={handleBan}
                  disabled={banBusy}
                  style={{
                    padding: "8px 18px",
                    fontSize: 13,
                    borderRadius: 9999,
                    border: "1px solid rgba(248,113,113,0.5)",
                    background: "rgba(248,113,113,0.15)",
                    color: "#fca5a5",
                    cursor: banBusy ? "wait" : "pointer",
                    opacity: banBusy ? 0.6 : 1,
                    fontWeight: 600,
                  }}
                >
                  {banBusy ? "處理中…" : "確認封鎖"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
