"use client";

/**
 * /admin/music — 音樂後台儀表板
 *
 * 三大區塊:
 *   1. 上方統計卡(今日生成/收藏、累計收益、待處理檢舉、flagged 數)
 *   2. 待審查 tab(預設):flagged 歌列表 + 對應檢舉,每首可
 *      「通過(還原)」或「下架(退所有買家 + 沒收創作者)」
 *   3. Top 創作者 / Top 歌曲 tab:純排行 ref
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Stats {
  todayGenerations: number;
  todayCollections: number;
  totalCollections: number;
  totalRevenuePoints: number;
  totalCreatorEarnings: number;
  platformNetPoints: number;
  flaggedTracks: number;
  pendingReports: number;
  topCreators: { creator_id: string; creator_display_name: string; total: number }[];
  topTracks: {
    id: string;
    title: string;
    creator_display_name: string;
    category_id: string;
    collect_count: number;
    creator_earnings_total: number;
  }[];
}

interface FlaggedReport {
  id: string;
  music_id: string;
  reporter_id: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
}

interface FlaggedTrack {
  id: string;
  title: string;
  creator_id: string | null;
  creator_display_name: string | null;
  prompt: string;
  category_id: string;
  storage_path: string;
  duration_seconds: number;
  visibility: string;
  moderation_status: string;
  collect_count: number;
  creator_earnings_total: number;
  published_at: string | null;
  created_at: string;
  audio_url: string;
  reports: FlaggedReport[];
}

type Tab = "moderation" | "creators" | "tracks";

export default function AdminMusicPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [flagged, setFlagged] = useState<FlaggedTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("moderation");
  const [actingId, setActingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([
        fetch("/api/admin/music/stats", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/music/moderation", { cache: "no-store" }).then((r) =>
          r.json(),
        ),
      ]);
      setStats(s as Stats);
      setFlagged(m.flagged ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDecide = async (
    musicId: string,
    decision: "approve" | "takedown",
  ) => {
    let reason: string | null = null;
    if (decision === "takedown") {
      const input = prompt("下架理由(可留空,會記在 audit log):");
      if (input === null) return; // 取消
      reason = input.trim() || null;
      if (
        !confirm(
          "確定下架?會自動退所有買家 20 點、從創作者已賺扣回。動作不可逆。",
        )
      ) {
        return;
      }
    } else {
      if (!confirm("還原為通過?所有 pending 檢舉會被標為「已審查不採取行動」。")) {
        return;
      }
    }

    setActingId(musicId);
    try {
      const res = await fetch("/api/admin/music/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicId, decision, reason }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`失敗:${j.detail ?? j.error ?? res.statusText}`);
        return;
      }
      await refresh();
    } finally {
      setActingId(null);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        🎵 音樂後台
      </h1>

      {/* 統計卡 */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <StatCard label="今日生成" value={String(stats.todayGenerations)} />
          <StatCard label="今日收藏" value={String(stats.todayCollections)} />
          <StatCard label="累計收藏" value={String(stats.totalCollections)} />
          <StatCard
            label="累計買家付出"
            value={`${stats.totalRevenuePoints} pt`}
          />
          <StatCard
            label="累計創作者收益"
            value={`${stats.totalCreatorEarnings} pt`}
          />
          <StatCard
            label="平台淨收"
            value={`${stats.platformNetPoints} pt`}
            highlight
          />
          <StatCard
            label="待處理檢舉"
            value={String(stats.pendingReports)}
            warn={stats.pendingReports > 0}
          />
          <StatCard
            label="Flagged 歌"
            value={String(stats.flaggedTracks)}
            warn={stats.flaggedTracks > 0}
          />
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "rgba(0,0,0,0.04)",
          padding: 4,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <TabBtn active={tab === "moderation"} onClick={() => setTab("moderation")}>
          {`待審查 (${flagged.length})`}
        </TabBtn>
        <TabBtn active={tab === "creators"} onClick={() => setTab("creators")}>
          Top 創作者
        </TabBtn>
        <TabBtn active={tab === "tracks"} onClick={() => setTab("tracks")}>
          Top 歌曲
        </TabBtn>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#888", padding: 40 }}>
          載入中…
        </div>
      ) : tab === "moderation" ? (
        <ModerationList
          flagged={flagged}
          onDecide={handleDecide}
          actingId={actingId}
        />
      ) : tab === "creators" ? (
        <TopCreatorsList creators={stats?.topCreators ?? []} />
      ) : (
        <TopTracksList tracks={stats?.topTracks ?? []} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  const bg = warn
    ? "rgba(231,76,60,0.08)"
    : highlight
      ? "rgba(212,168,85,0.08)"
      : "rgba(0,0,0,0.03)";
  const border = warn
    ? "rgba(231,76,60,0.4)"
    : highlight
      ? "rgba(212,168,85,0.4)"
      : "rgba(0,0,0,0.08)";
  const valueColor = warn ? "#c0392b" : highlight ? "#a47a3a" : "#222";
  return (
    <div
      style={{
        padding: "12px 14px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
      }}
    >
      <div style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: valueColor }}>
        {value}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 12px",
        background: active ? "#fff" : "transparent",
        border: active ? "1px solid rgba(0,0,0,0.1)" : "1px solid transparent",
        borderRadius: 6,
        color: active ? "#222" : "#666",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function ModerationList({
  flagged,
  onDecide,
  actingId,
}: {
  flagged: FlaggedTrack[];
  onDecide: (id: string, d: "approve" | "takedown") => void;
  actingId: string | null;
}) {
  if (flagged.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "#888",
          background: "rgba(0,0,0,0.02)",
          borderRadius: 10,
        }}
      >
        ✓ 目前沒有待審查的歌
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {flagged.map((track) => (
        <div
          key={track.id}
          style={{
            padding: 16,
            background: "#fff",
            border: "1px solid rgba(231,76,60,0.3)",
            borderLeft: "4px solid #e74c3c",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <audio
              controls
              src={track.audio_url}
              style={{ width: 240, flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                  {track.title}
                </h3>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "#e74c3c",
                    color: "#fff",
                  }}
                >
                  FLAGGED
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                {track.creator_id ? (
                  <Link
                    href={`/music/creator/${track.creator_id}`}
                    target="_blank"
                    style={{ color: "#a47a3a", textDecoration: "none" }}
                  >
                    {track.creator_display_name ?? "(未命名)"}
                  </Link>
                ) : (
                  track.creator_display_name ?? "(平台種子)"
                )}{" "}
                · {track.category_id} · 收藏 {track.collect_count} · 賺 +
                {track.creator_earnings_total} pt
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#888",
                  background: "rgba(0,0,0,0.03)",
                  padding: "6px 8px",
                  borderRadius: 6,
                  marginBottom: 8,
                }}
              >
                <strong>Prompt:</strong> {track.prompt}
              </div>
              <details>
                <summary style={{ fontSize: 12, color: "#666", cursor: "pointer" }}>
                  {track.reports.length} 筆檢舉
                </summary>
                <ul
                  style={{
                    margin: "6px 0 0",
                    padding: 0,
                    listStyle: "none",
                    fontSize: 11,
                  }}
                >
                  {track.reports.map((r) => (
                    <li
                      key={r.id}
                      style={{
                        padding: "6px 8px",
                        background: "rgba(0,0,0,0.03)",
                        borderRadius: 4,
                        marginBottom: 4,
                      }}
                    >
                      <div>
                        <strong>{r.reason}</strong> · {r.status}
                      </div>
                      {r.notes && <div style={{ color: "#666" }}>{r.notes}</div>}
                      <div style={{ color: "#999", fontSize: 10 }}>
                        {new Date(r.created_at).toLocaleString("zh-TW")}
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => onDecide(track.id, "approve")}
              disabled={actingId === track.id}
              style={{
                padding: "8px 16px",
                background: "#fff",
                border: "1px solid #2ecc71",
                color: "#27ae60",
                borderRadius: 6,
                cursor: actingId === track.id ? "wait" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              ✓ 通過(還原)
            </button>
            <button
              onClick={() => onDecide(track.id, "takedown")}
              disabled={actingId === track.id}
              style={{
                padding: "8px 16px",
                background: "#e74c3c",
                border: "none",
                color: "#fff",
                borderRadius: 6,
                cursor: actingId === track.id ? "wait" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              ✕ 下架(退款 + 沒收)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopCreatorsList({
  creators,
}: {
  creators: { creator_id: string; creator_display_name: string; total: number }[];
}) {
  if (creators.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "#888",
          background: "rgba(0,0,0,0.02)",
          borderRadius: 10,
        }}
      >
        還沒有創作者賺到收益
      </div>
    );
  }
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <thead>
        <tr style={{ background: "rgba(0,0,0,0.03)" }}>
          <th style={th}>#</th>
          <th style={th}>創作者</th>
          <th style={{ ...th, textAlign: "right" }}>累計收益</th>
        </tr>
      </thead>
      <tbody>
        {creators.map((c, i) => (
          <tr key={c.creator_id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <td style={td}>{i + 1}</td>
            <td style={td}>
              <Link
                href={`/music/creator/${c.creator_id}`}
                target="_blank"
                style={{ color: "#a47a3a", textDecoration: "none" }}
              >
                {c.creator_display_name}
              </Link>
            </td>
            <td style={{ ...td, textAlign: "right", color: "#a47a3a", fontWeight: 700 }}>
              +{c.total} pt
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TopTracksList({
  tracks,
}: {
  tracks: Stats["topTracks"];
}) {
  if (tracks.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "#888",
          background: "rgba(0,0,0,0.02)",
          borderRadius: 10,
        }}
      >
        還沒有歌被收藏
      </div>
    );
  }
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <thead>
        <tr style={{ background: "rgba(0,0,0,0.03)" }}>
          <th style={th}>#</th>
          <th style={th}>歌名</th>
          <th style={th}>創作者</th>
          <th style={th}>分類</th>
          <th style={{ ...th, textAlign: "right" }}>收藏</th>
          <th style={{ ...th, textAlign: "right" }}>創作者賺</th>
        </tr>
      </thead>
      <tbody>
        {tracks.map((t, i) => (
          <tr key={t.id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            <td style={td}>{i + 1}</td>
            <td style={td}>{t.title}</td>
            <td style={td}>{t.creator_display_name}</td>
            <td style={td}>{t.category_id}</td>
            <td style={{ ...td, textAlign: "right" }}>{t.collect_count}</td>
            <td style={{ ...td, textAlign: "right", color: "#a47a3a" }}>
              +{t.creator_earnings_total} pt
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const th: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 12,
  color: "#666",
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
};
