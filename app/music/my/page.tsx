"use client";

/**
 * /music/my — 我的音樂(我創作 + 我收藏)
 *
 * 兩個分頁:
 *   - 「我創作的」:列出我所有 generated_music(含 private)
 *     可以播放、發布到排行榜、看收益。創作者可下載自己的歌。
 *   - 「我收藏的」:列出 music_collections.user_id = me 的
 *     可以播放,不能下載(設計上的鎖)。
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import { useMusicPlayer } from "@/components/MusicPlayerProvider";
import {
  type MusicCategoryId,
  type MusicVisibility,
  CATEGORY_META,
  categoryEmoji,
  categoryLabel,
  buildAudioUrl,
  pickTitle,
} from "@/lib/music/types";

type Tab = "created" | "collected";

interface CreatedTrack {
  id: string;
  title: string;
  title_translations: Record<string, string> | null;
  category_id: MusicCategoryId;
  storage_path: string;
  duration_seconds: number;
  visibility: MusicVisibility;
  collect_count: number;
  creator_earnings_total: number;
  created_at: string;
  published_at: string | null;
}

interface CollectedTrack {
  music_id: string;
  collected_at: string;
  points_paid: number;
  generated_music: {
    id: string;
    title: string;
    title_translations: Record<string, string> | null;
    category_id: MusicCategoryId;
    storage_path: string;
    duration_seconds: number;
    creator_display_name: string | null;
  };
}

export default function MyMusicPage() {
  const { locale, t } = useLanguage();
  const player = useMusicPlayer();
  const [tab, setTab] = useState<Tab>("created");
  const [created, setCreated] = useState<CreatedTrack[]>([]);
  const [collected, setCollected] = useState<CollectedTrack[]>([]);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/music/my", { cache: "no-store" });
      if (res.status === 401) {
        setNeedLogin(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCreated(data.created ?? []);
      setCollected(data.collected ?? []);
      setSupabaseUrl(data.supabaseUrl ?? "");
    } catch (e) {
      console.error("[my-music]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handlePublish = async (musicId: string) => {
    setPublishingId(musicId);
    try {
      const res = await fetch("/api/music/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.message || t("發布失敗", "Publish failed", "公開失敗", "발행 실패"));
        return;
      }
      await refresh();
    } finally {
      setPublishingId(null);
    }
  };

  const handlePlayCreated = (track: CreatedTrack) => {
    player.play({
      id: track.id,
      title: pickTitle(track, locale),
      audioUrl: buildAudioUrl(supabaseUrl, track.storage_path),
      categoryEmoji: categoryEmoji(track.category_id),
      durationSeconds: track.duration_seconds,
    });
  };

  const handlePlayCollected = (item: CollectedTrack) => {
    const m = item.generated_music;
    player.play({
      id: m.id,
      title: pickTitle(m, locale),
      audioUrl: buildAudioUrl(supabaseUrl, m.storage_path),
      categoryEmoji: categoryEmoji(m.category_id),
      creatorDisplayName: m.creator_display_name,
      durationSeconds: m.duration_seconds,
    });
  };

  if (needLogin) {
    return (
      <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
        <Header />
        <div style={{ maxWidth: 600, margin: "60px auto", padding: 32, textAlign: "center" }}>
          <p style={{ color: "#c0c0d0", fontSize: 15, marginBottom: 18 }}>
            {t("請先登入查看你的音樂", "Please sign in to see your music", "ログインしてください", "로그인 후 확인하세요")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80, paddingBottom: 120 }}>
      <Header />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 26, fontWeight: 700, margin: 0 }}
          >
            {t("我的音樂", "My Music", "マイミュージック", "내 음악")}
          </h1>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "rgba(255,255,255,0.04)",
            padding: 4,
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          <TabButton active={tab === "created"} onClick={() => setTab("created")}>
            {t(`我創作的 (${created.length})`, `Created (${created.length})`, `作成 (${created.length})`, `만든 (${created.length})`)}
          </TabButton>
          <TabButton active={tab === "collected"} onClick={() => setTab("collected")}>
            {t(`我收藏的 (${collected.length})`, `Collected (${collected.length})`, `収集 (${collected.length})`, `수집 (${collected.length})`)}
          </TabButton>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "#c0c0d0", padding: "40px 0" }}>
            {t("載入中…", "Loading…", "読み込み中…", "로딩 중…")}
          </div>
        ) : tab === "created" ? (
          <CreatedList
            tracks={created}
            supabaseUrl={supabaseUrl}
            playerCurrentId={player.currentTrack?.id ?? null}
            isPlaying={player.isPlaying}
            onPlay={handlePlayCreated}
            onPublish={handlePublish}
            publishingId={publishingId}
            t={t}
            locale={locale}
          />
        ) : (
          <CollectedList
            items={collected}
            playerCurrentId={player.currentTrack?.id ?? null}
            isPlaying={player.isPlaying}
            onPlay={handlePlayCollected}
            t={t}
            locale={locale}
          />
        )}

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Link
            href="/music/generate"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              background: "linear-gradient(135deg, #d4a855, #f0d78c)",
              color: "#0a0a1a",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("✦ 創作新音樂", "✦ Create New", "✦ 新しく作る", "✦ 새로 만들기")}
          </Link>
          {" "}
          <Link
            href="/music"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              background: "transparent",
              border: "1px solid rgba(212,168,85,0.4)",
              color: "#d4a855",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              marginLeft: 8,
            }}
          >
            {t("🏆 排行榜", "🏆 Leaderboard", "🏆 ランキング", "🏆 랭킹")}
          </Link>
        </div>
      </div>
    </main>
  );
}

function TabButton({
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
        padding: "10px 12px",
        background: active ? "rgba(212,168,85,0.15)" : "transparent",
        border: active ? "1px solid rgba(212,168,85,0.4)" : "1px solid transparent",
        borderRadius: 8,
        color: active ? "#d4a855" : "#c0c0d0",
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

function CreatedList({
  tracks,
  supabaseUrl,
  playerCurrentId,
  isPlaying,
  onPlay,
  onPublish,
  publishingId,
  t,
  locale,
}: {
  tracks: CreatedTrack[];
  supabaseUrl: string;
  playerCurrentId: string | null;
  isPlaying: boolean;
  onPlay: (t: CreatedTrack) => void;
  onPublish: (id: string) => void;
  publishingId: string | null;
  t: (zh: string, en: string, ja?: string, ko?: string) => string;
  locale: "zh" | "en" | "ja" | "ko";
}) {
  if (tracks.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "rgba(192,192,208,0.6)", padding: "40px 16px" }}>
        {t(
          "你還沒有創作過音樂",
          "You haven't created any music yet",
          "まだ音楽を作っていません",
          "아직 만든 음악이 없습니다",
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {tracks.map((track) => (
        <CreatedRow
          key={track.id}
          track={track}
          supabaseUrl={supabaseUrl}
          isCurrent={playerCurrentId === track.id}
          isPlaying={isPlaying && playerCurrentId === track.id}
          onPlay={() => onPlay(track)}
          onPublish={() => onPublish(track.id)}
          isPublishing={publishingId === track.id}
          t={t}
          locale={locale}
        />
      ))}
    </div>
  );
}

function CreatedRow({
  track,
  supabaseUrl,
  isCurrent,
  isPlaying,
  onPlay,
  onPublish,
  isPublishing,
  t,
  locale,
}: {
  track: CreatedTrack;
  supabaseUrl: string;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onPublish: () => void;
  isPublishing: boolean;
  t: (zh: string, en: string, ja?: string, ko?: string) => string;
  locale: "zh" | "en" | "ja" | "ko";
}) {
  const isPublic = track.visibility === "public";
  const isRemoved =
    track.visibility === "removed_by_user" || track.visibility === "removed_by_moderation";
  const audioUrl = buildAudioUrl(supabaseUrl, track.storage_path);
  const displayTitle = pickTitle(track, locale);
  return (
    <div
      style={{
        padding: "12px 14px",
        background: isCurrent ? "rgba(212,168,85,0.10)" : "rgba(255,255,255,0.03)",
        border: isCurrent ? "1px solid rgba(212,168,85,0.4)" : "1px solid rgba(212,168,85,0.15)",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onPlay}
          aria-label={isPlaying ? t("暫停", "Pause", "一時停止", "일시정지") : t("播放", "Play", "再生", "재생")}
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #d4a855, #f0d78c)",
            border: "none",
            color: "#0a0a1a",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
            {categoryEmoji(track.category_id)} {displayTitle}
          </div>
          <div style={{ color: "rgba(192,192,208,0.6)", fontSize: 11 }}>
            {categoryLabel(track.category_id, locale)} · {track.duration_seconds}s
            {isPublic && (
              <>
                {" · "}
                {t(`收藏 ${track.collect_count} 次`, `${track.collect_count} collects`, `収集 ${track.collect_count} 回`, `${track.collect_count}회 수집`)}
                {track.creator_earnings_total > 0 && (
                  <>
                    {" · "}
                    <span style={{ color: "#d4a855" }}>
                      {t(`已賺 ${track.creator_earnings_total} 點`, `+${track.creator_earnings_total} earned`, `${track.creator_earnings_total} ポイント獲得`, `${track.creator_earnings_total} 포인트 획득`)}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            padding: "3px 8px",
            borderRadius: 9999,
            background: isPublic
              ? "rgba(40,200,120,0.15)"
              : isRemoved
                ? "rgba(231,76,60,0.15)"
                : "rgba(192,192,208,0.1)",
            color: isPublic ? "#28c878" : isRemoved ? "#ff8e7a" : "#c0c0d0",
            border: `1px solid ${isPublic ? "rgba(40,200,120,0.4)" : isRemoved ? "rgba(231,76,60,0.4)" : "rgba(192,192,208,0.3)"}`,
          }}
        >
          {isPublic
            ? t("公開", "Public", "公開", "공개")
            : isRemoved
              ? t("已下架", "Removed", "削除済", "삭제됨")
              : t("私人", "Private", "プライベート", "비공개")}
        </span>
      </div>

      {track.visibility === "private" && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={onPublish}
            disabled={isPublishing}
            style={{
              padding: "8px 14px",
              background: "rgba(212,168,85,0.15)",
              border: "1px solid rgba(212,168,85,0.4)",
              borderRadius: 8,
              color: "#d4a855",
              fontSize: 12,
              fontWeight: 600,
              cursor: isPublishing ? "wait" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {isPublishing
              ? t("發布中…", "Publishing…", "公開中…", "발행 중…")
              : t("📢 公開到排行榜", "📢 Publish", "📢 ランキングに公開", "📢 랭킹에 발행")}
          </button>
          <a
            href={audioUrl}
            download={`${displayTitle}.mp3`}
            style={{
              padding: "8px 14px",
              background: "transparent",
              border: "1px solid rgba(192,192,208,0.3)",
              borderRadius: 8,
              color: "#c0c0d0",
              fontSize: 12,
              fontWeight: 500,
              textDecoration: "none",
              fontFamily: "inherit",
            }}
          >
            {t("⬇ 下載", "⬇ Download", "⬇ ダウンロード", "⬇ 다운로드")}
          </a>
        </div>
      )}
      {isPublic && (
        <div style={{ marginTop: 10 }}>
          <a
            href={audioUrl}
            download={`${displayTitle}.mp3`}
            style={{
              padding: "8px 14px",
              background: "transparent",
              border: "1px solid rgba(192,192,208,0.3)",
              borderRadius: 8,
              color: "#c0c0d0",
              fontSize: 12,
              fontWeight: 500,
              textDecoration: "none",
              fontFamily: "inherit",
              display: "inline-block",
            }}
          >
            {t("⬇ 下載自己的", "⬇ Download own", "⬇ 自分の曲をダウンロード", "⬇ 내 곡 다운로드")}
          </a>
        </div>
      )}
    </div>
  );
}

function CollectedList({
  items,
  playerCurrentId,
  isPlaying,
  onPlay,
  t,
  locale,
}: {
  items: CollectedTrack[];
  playerCurrentId: string | null;
  isPlaying: boolean;
  onPlay: (t: CollectedTrack) => void;
  t: (zh: string, en: string, ja?: string, ko?: string) => string;
  locale: "zh" | "en" | "ja" | "ko";
}) {
  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "rgba(192,192,208,0.6)", padding: "40px 16px" }}>
        {t(
          "去排行榜逛逛,收藏喜歡的音樂",
          "Explore the leaderboard to collect tracks",
          "ランキングを見て音楽を集めよう",
          "랭킹에서 음악을 수집해 보세요",
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => {
        const m = item.generated_music;
        const isCurrent = playerCurrentId === m.id;
        const isThisPlaying = isPlaying && isCurrent;
        return (
          <div
            key={m.id}
            style={{
              padding: "12px 14px",
              background: isCurrent ? "rgba(212,168,85,0.10)" : "rgba(255,255,255,0.03)",
              border: isCurrent
                ? "1px solid rgba(212,168,85,0.4)"
                : "1px solid rgba(212,168,85,0.15)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              onClick={() => onPlay(item)}
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                border: "none",
                color: "#0a0a1a",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {isThisPlaying ? "⏸" : "▶"}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>
                {categoryEmoji(m.category_id)} {pickTitle(m, locale)}
              </div>
              <div style={{ color: "rgba(192,192,208,0.6)", fontSize: 11 }}>
                {m.creator_display_name ?? t("匿名", "Anonymous", "匿名", "익명")} ·{" "}
                {categoryLabel(m.category_id, locale)} · {item.points_paid} pt
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
