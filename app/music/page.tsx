"use client";

/**
 * /music — 排行榜 + 探索頁
 *
 * 三大區塊:
 *   1. 永久免費 2 首(任何人 0 點播放)
 *   2. 6 個主題榜各 Top 10(20 點收藏一首,訂閱戶 16 點)
 *   3. 動作:創作新音樂、我的音樂
 *
 * 公開閱讀,不用登入。但收藏需要登入 + 點數。
 */

import { useEffect, useState, useCallback } from "react";
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
  CATEGORY_META,
  categoryEmoji,
  categoryLabel,
  buildAudioUrl,
} from "@/lib/music/types";

interface FreeTrack {
  id: string;
  title: string;
  category_id: MusicCategoryId;
  storage_path: string;
  duration_seconds: number;
  creator_display_name: string | null;
}

interface RankedTrack {
  id: string;
  title: string;
  category_id: MusicCategoryId;
  storage_path: string;
  duration_seconds: number;
  creator_display_name: string | null;
  is_seed: boolean;
  collect_count: number;
  rank_in_category: number;
  payout_tier: "top10" | "top50" | "top100" | "long_tail";
}

export default function MusicLeaderboardPage() {
  const { locale, t } = useLanguage();
  const player = useMusicPlayer();

  const [free, setFree] = useState<FreeTrack[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, RankedTrack[]>>({});
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [rankingDate, setRankingDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MusicCategoryId | "all">("all");
  const [collectingId, setCollectingId] = useState<string | null>(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/music/leaderboard", { cache: "no-store" });
      const data = await res.json();
      setFree(data.free ?? []);
      setByCategory(data.byCategory ?? {});
      setSupabaseUrl(data.supabaseUrl ?? "");
      setRankingDate(data.rankingDate ?? null);
    } catch (e) {
      console.error("[leaderboard]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const playTrack = (track: { id: string; title: string; storage_path: string; category_id: MusicCategoryId; duration_seconds: number; creator_display_name?: string | null }) => {
    player.play({
      id: track.id,
      title: track.title,
      audioUrl: buildAudioUrl(supabaseUrl, track.storage_path),
      categoryEmoji: categoryEmoji(track.category_id),
      creatorDisplayName: track.creator_display_name ?? null,
      durationSeconds: track.duration_seconds,
    });
  };

  const handleCollect = async (musicId: string) => {
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
        alert(j.message || t("收藏失敗", "Collect failed", "収集に失敗", "수집 실패"));
        return;
      }
      const data = await res.json();
      notifyCreditsChanged();
      alert(
        t(
          `已收藏!花了 ${data.cost} 點,創作者收到 ${data.creator_payout} 點(${data.creator_tier})`,
          `Collected! Spent ${data.cost} pt, creator earned ${data.creator_payout} pt (${data.creator_tier})`,
          `収集しました!${data.cost} ポイント支払い、創作者に ${data.creator_payout} ポイント`,
          `수집됨! ${data.cost} 포인트 사용, 창작자에게 ${data.creator_payout} 포인트`,
        ),
      );
    } finally {
      setCollectingId(null);
    }
  };

  const visibleCategories =
    activeCategory === "all"
      ? CATEGORY_META.map((c) => c.id)
      : [activeCategory];

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80, paddingBottom: 120 }}>
      <Header />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 26, fontWeight: 700, margin: 0 }}
          >
            {t("背景音樂", "Background Music", "背景音楽", "배경음악")}
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginTop: 6 }}>
            {t(
              "免費聆聽 · 用 20 點(訂閱戶 16 點)永久收藏喜愛的歌",
              "Free to play · Collect favorites for 20 pt (subs 16)",
              "無料再生 · 20 ポイントで永久収集(サブ 16)",
              "무료 재생 · 20 포인트로 영구 수집(구독자 16)",
            )}
          </p>
        </div>

        {/* 動作列 */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 18 }}>
          <Link
            href="/music/generate"
            style={{
              padding: "8px 16px",
              background: "linear-gradient(135deg, #d4a855, #f0d78c)",
              color: "#0a0a1a",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("✦ 創作 100 點", "✦ Create 100pt", "✦ 作成 100 ポイント", "✦ 만들기 100 포인트")}
          </Link>
          <Link
            href="/music/my"
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: "1px solid rgba(212,168,85,0.4)",
              color: "#d4a855",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("🎵 我的音樂", "🎵 My music", "🎵 マイミュージック", "🎵 내 음악")}
          </Link>
        </div>

        {/* 免費試聽區 */}
        {free.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2
              style={{
                color: "#d4a855",
                fontSize: 14,
                fontWeight: 700,
                margin: "0 0 8px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              🎁 {t("永久免費", "Always Free", "永久無料", "영구 무료")}
            </h2>
            <div style={{ display: "grid", gap: 8 }}>
              {free.map((tr) => (
                <TrackRow
                  key={tr.id}
                  trackId={tr.id}
                  title={tr.title}
                  categoryId={tr.category_id}
                  durationSeconds={tr.duration_seconds}
                  creatorName={tr.creator_display_name ?? t("平台官方", "Official", "公式", "공식")}
                  isPlaying={player.currentTrack?.id === tr.id && player.isPlaying}
                  onPlay={() =>
                    playTrack({ ...tr })
                  }
                  isFree
                  locale={locale}
                  t={t}
                />
              ))}
            </div>
          </section>
        )}

        {/* 主題切換器 */}
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 14,
            padding: 6,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 12,
          }}
        >
          <ChipButton
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          >
            {t("全部", "All", "全部", "전체")}
          </ChipButton>
          {CATEGORY_META.map((c) => (
            <ChipButton
              key={c.id}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
            >
              {c.emoji} {categoryLabel(c.id, locale)}
            </ChipButton>
          ))}
        </div>

        {!rankingDate && !loading && (
          <div
            style={{
              padding: "8px 14px",
              background: "rgba(212,168,85,0.06)",
              border: "1px solid rgba(212,168,85,0.2)",
              borderRadius: 8,
              fontSize: 11,
              color: "rgba(212,168,85,0.8)",
              marginBottom: 12,
            }}
          >
            {t(
              "今日排名快照尚未生成,顯示的是依收藏數的暫時排序",
              "Today's snapshot pending — showing fallback by collect count",
              "本日のスナップショット未生成 — 収集数で仮ソート",
              "오늘 스냅샷 미생성 — 수집 수 기준 임시 정렬",
            )}
          </div>
        )}

        {/* 主題榜 */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#c0c0d0", padding: "40px 0" }}>
            {t("載入中…", "Loading…", "読み込み中…", "로딩 중…")}
          </div>
        ) : (
          visibleCategories.map((catId) => {
            const tracks = byCategory[catId] ?? [];
            const meta = CATEGORY_META.find((c) => c.id === catId)!;
            return (
              <section key={catId} style={{ marginBottom: 24 }}>
                <h2
                  style={{
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    margin: "0 0 8px",
                  }}
                >
                  {meta.emoji} {categoryLabel(catId, locale)}
                </h2>
                {tracks.length === 0 ? (
                  <div
                    style={{
                      color: "rgba(192,192,208,0.5)",
                      fontSize: 12,
                      padding: "10px 14px",
                      background: "rgba(255,255,255,0.02)",
                      borderRadius: 8,
                    }}
                  >
                    {t(
                      "這個主題還沒有作品,要不要當第一位創作者?",
                      "No tracks yet — be the first creator?",
                      "まだ作品なし — 最初の創作者になりませんか?",
                      "아직 작품 없음 — 첫 창작자가 되어보세요",
                    )}
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {tracks.map((tr) => (
                      <TrackRow
                        key={tr.id}
                        trackId={tr.id}
                        rank={tr.rank_in_category}
                        title={tr.title}
                        categoryId={tr.category_id}
                        durationSeconds={tr.duration_seconds}
                        creatorName={tr.creator_display_name ?? t("匿名", "Anonymous", "匿名", "익명")}
                        isSeed={tr.is_seed}
                        collectCount={tr.collect_count}
                        isPlaying={player.currentTrack?.id === tr.id && player.isPlaying}
                        onPlay={() => playTrack(tr)}
                        onCollect={() => handleCollect(tr.id)}
                        isCollecting={collectingId === tr.id}
                        locale={locale}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
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

function ChipButton({
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
        padding: "6px 12px",
        background: active ? "rgba(212,168,85,0.18)" : "transparent",
        border: active ? "1px solid rgba(212,168,85,0.5)" : "1px solid transparent",
        borderRadius: 9999,
        color: active ? "#d4a855" : "#c0c0d0",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function TrackRow(props: {
  trackId: string;
  rank?: number;
  title: string;
  categoryId: MusicCategoryId;
  durationSeconds: number;
  creatorName: string;
  isSeed?: boolean;
  collectCount?: number;
  isPlaying: boolean;
  isFree?: boolean;
  onPlay: () => void;
  onCollect?: () => void;
  isCollecting?: boolean;
  locale: "zh" | "en" | "ja" | "ko";
  t: (zh: string, en: string, ja?: string, ko?: string) => string;
}) {
  const { rank, title, categoryId, creatorName, isSeed, collectCount, isPlaying, isFree, onPlay, onCollect, isCollecting, t } = props;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(212,168,85,0.15)",
        borderRadius: 10,
      }}
    >
      {typeof rank === "number" && (
        <div
          style={{
            flexShrink: 0,
            width: 22,
            textAlign: "center",
            color: rank <= 3 ? "#d4a855" : "rgba(192,192,208,0.6)",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {rank}
        </div>
      )}

      <button
        onClick={onPlay}
        aria-label={isPlaying ? "Pause" : "Play"}
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
        {isPlaying ? "⏸" : "▶"}
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
          {categoryEmoji(categoryId)} {title}
        </div>
        <div style={{ color: "rgba(192,192,208,0.6)", fontSize: 11 }}>
          {creatorName}
          {isSeed && (
            <span style={{ marginLeft: 6, color: "rgba(212,168,85,0.7)" }}>
              · {t("平台種子", "Seed", "シード", "시드")}
            </span>
          )}
          {typeof collectCount === "number" && collectCount > 0 && (
            <span style={{ marginLeft: 6 }}>
              · {t(`${collectCount} 收藏`, `${collectCount} collects`, `${collectCount} 収集`, `${collectCount} 수집`)}
            </span>
          )}
        </div>
      </div>

      {isFree ? (
        <span
          style={{
            fontSize: 10,
            padding: "3px 8px",
            borderRadius: 9999,
            background: "rgba(40,200,120,0.15)",
            color: "#28c878",
            border: "1px solid rgba(40,200,120,0.4)",
            flexShrink: 0,
          }}
        >
          FREE
        </span>
      ) : onCollect ? (
        <button
          onClick={onCollect}
          disabled={isCollecting}
          style={{
            padding: "6px 10px",
            background: "rgba(212,168,85,0.12)",
            border: "1px solid rgba(212,168,85,0.4)",
            borderRadius: 8,
            color: "#d4a855",
            fontSize: 11,
            fontWeight: 600,
            cursor: isCollecting ? "wait" : "pointer",
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          {isCollecting ? t("…", "…", "…", "…") : t("20pt 收藏", "20pt", "20pt 収集", "20pt 수집")}
        </button>
      ) : null}
    </div>
  );
}
