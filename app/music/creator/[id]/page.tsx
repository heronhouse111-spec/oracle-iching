"use client";

/**
 * /music/creator/[id] — 創作者公開主頁
 *
 * 訪客看的是公開歌單 + 公開統計;創作者本人看自己的多了私人歌(可發布)+
 * 累計總收益顯示。
 */

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";
import { useMusicPlayer } from "@/components/MusicPlayerProvider";
import {
  type MusicCategoryId,
  type MusicVisibility,
  categoryEmoji,
  categoryLabel,
  buildAudioUrl,
  pickTitle,
} from "@/lib/music/types";

interface CreatorTrack {
  id: string;
  title: string;
  title_translations: Record<string, string> | null;
  category_id: MusicCategoryId;
  storage_path: string;
  duration_seconds: number;
  visibility: MusicVisibility;
  moderation_status: string;
  is_free: boolean;
  collect_count: number;
  creator_earnings_total: number;
  created_at: string;
  published_at: string | null;
}

interface CreatorData {
  creator: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  stats: {
    totalTracks: number;
    totalCollects: number;
    totalEarnings: number | null;
  };
  tracks: CreatorTrack[];
  viewerId: string | null;
  viewerCollectedIds: string[];
  supabaseUrl: string;
}

const PREVIEW_LIMIT_SECONDS = 15;

export default function CreatorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { locale, t } = useLanguage();
  const player = useMusicPlayer();

  const [data, setData] = useState<CreatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [previewToast, setPreviewToast] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/music/creator/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: CreatorData = await res.json();
      setData(json);
    } catch (e) {
      console.error("[creator]", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onPreviewEnded = () => {
      setPreviewToast(
        t(
          "試聽結束 · 收藏 20 點即可完整收聽 + 解鎖循環",
          "Preview ended · Collect for 20 credits to unlock full + loop",
          "試聴終了 · 20 ポイント収集で完全版",
          "체험 종료 · 20포인트 수집으로 전체",
        ),
      );
      setTimeout(() => setPreviewToast(null), 4000);
    };
    window.addEventListener("music:preview_ended", onPreviewEnded);
    return () => window.removeEventListener("music:preview_ended", onPreviewEnded);
  }, [t]);

  const handleFollowToggle = async () => {
    if (!data) return;
    if (!data.viewerId) {
      setLoginOpen(true);
      return;
    }
    setFollowLoading(true);
    try {
      const method = data.isFollowing ? "DELETE" : "POST";
      const res = await fetch("/api/music/follow", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: id }),
      });
      if (res.status === 401) {
        setLoginOpen(true);
        return;
      }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.message || t("追蹤失敗", "Follow failed", "フォロー失敗", "팔로우 실패"));
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: j.isFollowing,
              followerCount: j.followerCount,
            }
          : prev,
      );
    } finally {
      setFollowLoading(false);
    }
  };

  const handlePlay = (track: CreatorTrack) => {
    if (!data) return;
    const isCollected = data.viewerCollectedIds.includes(track.id);
    const previewLimit =
      track.is_free || data.isOwnProfile || isCollected
        ? undefined
        : PREVIEW_LIMIT_SECONDS;
    // queue = 此頁可見的所有 track
    const q = data.tracks.map((tr) => ({
      id: tr.id,
      title: pickTitle(tr, locale),
      audioUrl: buildAudioUrl(data.supabaseUrl, tr.storage_path),
      categoryEmoji: categoryEmoji(tr.category_id),
      creatorDisplayName: data.creator.displayName,
      durationSeconds: tr.duration_seconds,
      previewLimitSeconds:
        tr.is_free || data.isOwnProfile || data.viewerCollectedIds.includes(tr.id)
          ? undefined
          : PREVIEW_LIMIT_SECONDS,
    }));
    const idx = q.findIndex((t) => t.id === track.id);
    player.play(
      {
        ...q[idx],
        previewLimitSeconds: previewLimit,
      },
      q,
    );
  };

  const handleCollect = async (musicId: string) => {
    if (!data?.viewerId) {
      setLoginOpen(true);
      return;
    }
    setCollectingId(musicId);
    try {
      const res = await fetch("/api/music/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicId }),
      });
      if (res.status === 401) {
        setLoginOpen(true);
        return;
      }
      const insufficient = await parseInsufficientCredits(res);
      if (insufficient) {
        setCreditsModal({ open: true, required: insufficient.required });
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.message || t("收藏失敗", "Collect failed", "収集失敗", "수집 실패"));
        return;
      }
      const j = await res.json();
      notifyCreditsChanged();
      // 本地 mark 為已收藏
      setData((prev) =>
        prev
          ? {
              ...prev,
              viewerCollectedIds: [...prev.viewerCollectedIds, musicId],
            }
          : prev,
      );
      alert(
        t(
          `已收藏!花了 ${j.cost} 點。完整收聽 + 循環解鎖`,
          `Collected for ${j.cost} pt. Full + loop unlocked.`,
          `${j.cost} ポイントで収集!完全版 + ループ解禁`,
          `${j.cost}포인트로 수집! 전체 + 반복 해제`,
        ),
      );
    } finally {
      setCollectingId(null);
    }
  };

  if (loading) {
    return (
      <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
        <Header />
        <div style={{ textAlign: "center", color: "#c0c0d0", padding: 60 }}>
          {t("載入中…", "Loading…", "読み込み中…", "로딩 중…")}
        </div>
      </main>
    );
  }

  if (notFound || !data) {
    return (
      <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
        <Header />
        <div style={{ maxWidth: 480, margin: "60px auto", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <h2 style={{ color: "#fff", fontSize: 18, marginBottom: 8 }}>
            {t("找不到此創作者", "Creator not found", "創作者が見つかりません", "창작자를 찾을 수 없음")}
          </h2>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginBottom: 18 }}>
            {t(
              "這個帳號可能不存在,或創作者尚未公開任何作品",
              "Account may not exist, or creator hasn't published anything",
              "アカウントが存在しないか、まだ公開作品がありません",
              "계정이 없거나 공개 작품이 없습니다",
            )}
          </p>
          <Link
            href="/music"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "linear-gradient(135deg, #d4a855, #f0d78c)",
              color: "#0a0a1a",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("← 回排行榜", "← Back to leaderboard", "← ランキングへ", "← 랭킹으로")}
          </Link>
        </div>
      </main>
    );
  }

  const { creator, isOwnProfile, isFollowing, followerCount, stats, tracks } = data;
  const initial = (creator.displayName || "").charAt(0).toUpperCase() || "?";

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80, paddingBottom: 120 }}>
      <Header />

      {previewToast && (
        <div
          style={{
            position: "fixed",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 90,
            background: "linear-gradient(135deg, rgba(212,168,85,0.95), rgba(240,215,140,0.95))",
            color: "#0a0a1a",
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(212,168,85,0.4)",
            maxWidth: "calc(100vw - 32px)",
            textAlign: "center",
          }}
        >
          {previewToast}
        </div>
      )}

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
        {/* ── 創作者卡片 ────────────────────────── */}
        <div
          style={{
            padding: 24,
            background: "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(240,215,140,0.04))",
            border: "1px solid rgba(212,168,85,0.3)",
            borderRadius: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <div
              style={{
                width: 72,
                height: 72,
                flexShrink: 0,
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(212,168,85,0.4), rgba(240,215,140,0.2))",
                border: "2px solid rgba(212,168,85,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 28,
                fontWeight: 700,
                fontFamily: "'Noto Serif TC', serif",
              }}
            >
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1
                style={{
                  color: "#d4a855",
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 22,
                  fontWeight: 700,
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {creator.displayName || t("匿名創作者", "Anonymous", "匿名", "익명")}
              </h1>
              <div style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 4 }}>
                {t(
                  `${followerCount} 位追蹤者`,
                  `${followerCount} followers`,
                  `${followerCount} フォロワー`,
                  `${followerCount}명 팔로워`,
                )}
              </div>
            </div>
            {!isOwnProfile && (
              <button
                onClick={handleFollowToggle}
                disabled={followLoading}
                style={{
                  padding: "8px 16px",
                  flexShrink: 0,
                  background: isFollowing
                    ? "transparent"
                    : "linear-gradient(135deg, #d4a855, #f0d78c)",
                  border: isFollowing
                    ? "1px solid rgba(212,168,85,0.5)"
                    : "none",
                  borderRadius: 9999,
                  color: isFollowing ? "#d4a855" : "#0a0a1a",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: followLoading ? "wait" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {followLoading
                  ? "…"
                  : isFollowing
                    ? t("已追蹤", "Following", "フォロー中", "팔로우 중")
                    : t("+ 追蹤", "+ Follow", "+ フォロー", "+ 팔로우")}
              </button>
            )}
            {isOwnProfile && (
              <Link
                href="/account"
                style={{
                  padding: "8px 14px",
                  flexShrink: 0,
                  background: "transparent",
                  border: "1px solid rgba(212,168,85,0.4)",
                  borderRadius: 9999,
                  color: "#d4a855",
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                  fontFamily: "inherit",
                }}
              >
                {t("✎ 編輯", "✎ Edit", "✎ 編集", "✎ 편집")}
              </Link>
            )}
          </div>

          {/* 統計 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: stats.totalEarnings !== null ? "1fr 1fr 1fr" : "1fr 1fr",
              gap: 10,
            }}
          >
            <Stat
              label={t("公開作品", "Tracks", "公開作品", "공개 작품")}
              value={String(stats.totalTracks)}
            />
            <Stat
              label={t("總收藏", "Collects", "総収集", "총 수집")}
              value={String(stats.totalCollects)}
            />
            {stats.totalEarnings !== null && (
              <Stat
                label={t("累計收益", "Earnings", "累計収益", "누적 수익")}
                value={`+${stats.totalEarnings} pt`}
                gold
              />
            )}
          </div>
        </div>

        {/* ── 作品清單 ────────────────────────── */}
        <h2
          style={{
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            margin: "0 0 10px",
          }}
        >
          {t(
            isOwnProfile ? `所有作品 (${tracks.length})` : `公開作品 (${stats.totalTracks})`,
            isOwnProfile ? `All tracks (${tracks.length})` : `Public tracks (${stats.totalTracks})`,
            isOwnProfile ? `すべての作品 (${tracks.length})` : `公開作品 (${stats.totalTracks})`,
            isOwnProfile ? `모든 작품 (${tracks.length})` : `공개 작품 (${stats.totalTracks})`,
          )}
        </h2>

        {tracks.length === 0 ? (
          <div
            style={{
              color: "rgba(192,192,208,0.5)",
              fontSize: 13,
              textAlign: "center",
              padding: "40px 16px",
            }}
          >
            {isOwnProfile
              ? t(
                  "你還沒創作過音樂 — 從「創作音樂」開始",
                  "You haven't created any music yet",
                  "まだ音楽を作っていません",
                  "아직 만든 음악이 없습니다",
                )
              : t(
                  "這位創作者還沒公開任何作品",
                  "This creator hasn't published anything",
                  "まだ公開作品がありません",
                  "공개 작품이 없습니다",
                )}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {tracks.map((track) => {
              const isCollected = data.viewerCollectedIds.includes(track.id);
              const isCurrentTrack = player.currentTrack?.id === track.id;
              const isThisPlaying = isCurrentTrack && player.isPlaying;
              return (
                <div
                  key={track.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: isCurrentTrack
                      ? "rgba(212,168,85,0.10)"
                      : "rgba(255,255,255,0.03)",
                    border: isCurrentTrack
                      ? "1px solid rgba(212,168,85,0.4)"
                      : "1px solid rgba(212,168,85,0.15)",
                    borderRadius: 10,
                  }}
                >
                  <button
                    onClick={() => handlePlay(track)}
                    style={{
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                      border: "none",
                      color: "#0a0a1a",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {isThisPlaying ? "⏸" : "▶"}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {categoryEmoji(track.category_id)} {pickTitle(track, locale)}
                    </div>
                    <div style={{ color: "rgba(192,192,208,0.6)", fontSize: 11 }}>
                      {categoryLabel(track.category_id, locale)}
                      {track.collect_count > 0 && (
                        <span style={{ marginLeft: 6 }}>
                          · {t(`${track.collect_count} 收藏`, `${track.collect_count} collects`, `${track.collect_count} 収集`, `${track.collect_count} 수집`)}
                        </span>
                      )}
                      {isOwnProfile && track.creator_earnings_total > 0 && (
                        <span style={{ marginLeft: 6, color: "#d4a855" }}>
                          · +{track.creator_earnings_total} pt
                        </span>
                      )}
                      {isOwnProfile && track.visibility !== "public" && (
                        <span style={{ marginLeft: 6, color: "rgba(192,192,208,0.5)" }}>
                          · {track.visibility === "private"
                            ? t("私人", "Private", "プライベート", "비공개")
                            : t("已下架", "Removed", "削除", "삭제")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 右側徽章 / 按鈕 */}
                  {track.is_free ? (
                    <Badge color="green" label="FREE" />
                  ) : isOwnProfile ? (
                    <Badge color="purple" label={t("我的", "Mine", "自分", "내 곡")} />
                  ) : isCollected ? (
                    <Badge color="green" label={`✓ ${t("已收藏", "Collected", "収集済", "수집됨")}`} />
                  ) : (
                    <button
                      onClick={() => handleCollect(track.id)}
                      disabled={collectingId === track.id}
                      style={{
                        padding: "6px 10px",
                        background: "rgba(212,168,85,0.12)",
                        border: "1px solid rgba(212,168,85,0.4)",
                        borderRadius: 8,
                        color: "#d4a855",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: collectingId === track.id ? "wait" : "pointer",
                        fontFamily: "inherit",
                        flexShrink: 0,
                      }}
                    >
                      {collectingId === track.id ? "…" : t("20pt 收藏", "20pt", "20pt 収集", "20pt 수집")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LoginOptionsModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <InsufficientCreditsModal
        open={creditsModal.open}
        required={creditsModal.required}
        onClose={() => setCreditsModal({ open: false, required: 0 })}
      />
    </main>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 10,
        textAlign: "center",
      }}
    >
      <div
        style={{
          color: gold ? "#d4a855" : "#fff",
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "'Noto Serif TC', serif",
        }}
      >
        {value}
      </div>
      <div style={{ color: "rgba(192,192,208,0.6)", fontSize: 11, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function Badge({ color, label }: { color: "green" | "purple"; label: string }) {
  const palette =
    color === "green"
      ? { bg: "rgba(40,200,120,0.15)", fg: "#28c878", border: "rgba(40,200,120,0.4)" }
      : { bg: "rgba(139,92,246,0.15)", fg: "#c4b5fd", border: "rgba(139,92,246,0.4)" };
  return (
    <span
      style={{
        fontSize: 10,
        padding: "3px 8px",
        borderRadius: 9999,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}
