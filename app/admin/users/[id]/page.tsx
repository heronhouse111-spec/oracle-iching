"use client";

/**
 * /admin/users/[id] — 使用者詳情頁(含補/扣點操作)
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import { hexagrams } from "@/data/hexagrams";
import { tarotDeck } from "@/data/tarot";

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

interface CollectionData {
  iching: { ownedIds: string[]; count: number; total: number };
  tarot: { ownedIds: string[]; count: number; total: number };
  milestones: Array<{ milestone_id: string; reward_credits: number; granted_at: string }>;
  milestoneConfigs: Array<{
    id: string;
    collection_type: "iching" | "tarot";
    label_zh: string;
    reward_credits: number;
    threshold: number;
    kind: string;
  }>;
}

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

  // 卡牌收藏 + 贈卡 modal state
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [grantCardOpen, setGrantCardOpen] = useState(false);
  const [grantCardType, setGrantCardType] = useState<"iching" | "tarot">("iching");
  const [grantCardId, setGrantCardId] = useState("1");
  const [grantCardReason, setGrantCardReason] = useState("");
  const [grantCardBusy, setGrantCardBusy] = useState(false);
  const [grantCardError, setGrantCardError] = useState<string | null>(null);
  const [grantCardSuccess, setGrantCardSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detailRes, collRes] = await Promise.all([
        fetch(`/api/admin/users/${id}`, { cache: "no-store" }),
        fetch(`/api/admin/users/${id}/collection`, { cache: "no-store" }),
      ]);
      if (detailRes.status === 401) {
        window.location.href = `/?redirect=/admin/users/${id}`;
        return;
      }
      if (!detailRes.ok) {
        setError(`載入失敗:HTTP ${detailRes.status}`);
        return;
      }
      const json = (await detailRes.json()) as UserDetail;
      setData(json);
      if (collRes.ok) {
        setCollection((await collRes.json()) as CollectionData);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGrantCard = async () => {
    setGrantCardError(null);
    setGrantCardSuccess(null);
    if (grantCardReason.trim().length < 4) {
      setGrantCardError("原因至少 4 個字");
      return;
    }
    if (!grantCardId.trim()) {
      setGrantCardError("請選擇卡牌");
      return;
    }
    setGrantCardBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/grant-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionType: grantCardType,
          cardId: grantCardId.trim(),
          reason: grantCardReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGrantCardError(json.detail?.join?.(", ") ?? json.error ?? `HTTP ${res.status}`);
        return;
      }
      setGrantCardSuccess(
        json.isNew
          ? `已新贈卡。該 user ${grantCardType} 已收 ${json.distinctCount} 張。`
          : `卡片已存在(累計次數 +1)。該 user ${grantCardType} 共 ${json.distinctCount} 張。`,
      );
      setGrantCardReason("");
      await load();
    } catch (e) {
      setGrantCardError(e instanceof Error ? e.message : String(e));
    } finally {
      setGrantCardBusy(false);
    }
  };

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
                        {data.subscription.plan === "monthly" ? "月訂閱" : data.subscription.plan === "yearly" ? "年訂閱" : data.subscription.plan}
                        ({data.subscription.provider})
                      </span>
                    )}
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

            {/* ─── 卡牌收藏 ─── */}
            <div
              className="mystic-card"
              style={{ padding: 0, marginBottom: 16, overflow: "hidden" }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(192,192,208,0.08)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <h2 style={{ fontSize: 14, color: "#d4a855" }}>卡牌收藏</h2>
                <button
                  onClick={() => setGrantCardOpen(true)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12,
                    borderRadius: 9999,
                    border: "1px solid rgba(212,168,85,0.5)",
                    background: "rgba(212,168,85,0.1)",
                    color: "#d4a855",
                    cursor: "pointer",
                  }}
                >
                  🎁 手動贈卡
                </button>
              </div>
              {!collection ? (
                <div style={{ padding: 24, textAlign: "center", color: "rgba(192,192,208,0.4)", fontSize: 13 }}>
                  載入中…
                </div>
              ) : (
                <div style={{ padding: 16 }}>
                  {(["iching", "tarot"] as const).map((kind) => {
                    const c = collection[kind];
                    const pct = c.total > 0 ? Math.round((c.count / c.total) * 100) : 0;
                    const earnedIds = new Set(collection.milestones.map((m) => m.milestone_id));
                    const kindMilestones = collection.milestoneConfigs.filter(
                      (m) => m.collection_type === kind,
                    );
                    return (
                      <div key={kind} style={{ marginBottom: 16 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontSize: 13, color: "#e8e8f0" }}>
                            {kind === "iching" ? "易經 64 卦" : "塔羅 78 張"}
                          </span>
                          <span style={{ fontSize: 12, color: "#fde68a" }}>
                            {c.count} / {c.total} ({pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 9999,
                            background: "rgba(255,255,255,0.06)",
                            overflow: "hidden",
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: "linear-gradient(90deg, #d4a855, #fde68a)",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {kindMilestones.map((m) => {
                            const earned = earnedIds.has(m.id);
                            return (
                              <span
                                key={m.id}
                                style={{
                                  fontSize: 10,
                                  padding: "2px 8px",
                                  borderRadius: 9999,
                                  background: earned
                                    ? "rgba(110,231,183,0.12)"
                                    : "rgba(255,255,255,0.04)",
                                  border: `1px solid ${earned ? "rgba(110,231,183,0.4)" : "rgba(212,168,85,0.2)"}`,
                                  color: earned ? "#6ee7b7" : "rgba(192,192,208,0.6)",
                                }}
                                title={`+${m.reward_credits} ✦`}
                              >
                                {earned ? "✓ " : ""}
                                {m.label_zh}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
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

        {/* ─── Grant Card modal ─── */}
        {grantCardOpen && (
          <div
            onClick={() => setGrantCardOpen(false)}
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
                style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 18, marginBottom: 12 }}
              >
                🎁 手動贈卡(客服救人專用)
              </h3>
              <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginBottom: 16 }}>
                只記入收藏,**不觸發里程碑獎勵**(防止刷獎)。所有操作會留 audit log。
              </p>

              <label style={{ display: "block", color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 4 }}>
                類型
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["iching", "tarot"] as const).map((tt) => (
                  <button
                    key={tt}
                    onClick={() => {
                      setGrantCardType(tt);
                      setGrantCardId(tt === "iching" ? "1" : tarotDeck[0].id);
                    }}
                    style={{
                      flex: 1,
                      padding: "8px",
                      borderRadius: 8,
                      border:
                        grantCardType === tt
                          ? "1px solid #d4a855"
                          : "1px solid rgba(212,168,85,0.2)",
                      background:
                        grantCardType === tt ? "rgba(212,168,85,0.15)" : "transparent",
                      color: grantCardType === tt ? "#fde68a" : "rgba(192,192,208,0.7)",
                      fontSize: 13,
                      cursor: "pointer",
                      fontWeight: grantCardType === tt ? 600 : 400,
                    }}
                  >
                    {tt === "iching" ? "易經卦象" : "塔羅牌"}
                  </button>
                ))}
              </div>

              <label style={{ display: "block", color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 4 }}>
                {grantCardType === "iching" ? "卦號(1-64)" : "塔羅牌"}
              </label>
              {grantCardType === "iching" ? (
                <select
                  value={grantCardId}
                  onChange={(e) => setGrantCardId(e.target.value)}
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
                >
                  {hexagrams.map((h) => (
                    <option key={h.number} value={String(h.number)}>
                      第 {h.number} 卦 — {h.nameZh} ({h.nameEn.split(" ")[0]})
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={grantCardId}
                  onChange={(e) => setGrantCardId(e.target.value)}
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
                >
                  {tarotDeck.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.suit}] {c.nameZh} — {c.nameEn}
                    </option>
                  ))}
                </select>
              )}

              <label style={{ display: "block", color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 4 }}>
                原因(必填,≥4 字)
              </label>
              <textarea
                value={grantCardReason}
                onChange={(e) => setGrantCardReason(e.target.value)}
                rows={3}
                placeholder="例如:用戶反映抽到此卦但收藏沒記到 → 補入"
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

              {grantCardError && (
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
                  {grantCardError}
                </div>
              )}
              {grantCardSuccess && (
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
                  {grantCardSuccess}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setGrantCardOpen(false)}
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
                  onClick={handleGrantCard}
                  disabled={grantCardBusy}
                  className="btn-gold"
                  style={{
                    padding: "8px 18px",
                    fontSize: 13,
                    opacity: grantCardBusy ? 0.6 : 1,
                    cursor: grantCardBusy ? "wait" : "pointer",
                  }}
                >
                  {grantCardBusy ? "處理中…" : "確認贈卡"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
