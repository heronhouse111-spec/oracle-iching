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
  pickTitle,
} from "@/lib/music/types";

interface FreeTrack {
  id: string;
  title: string;
  title_translations: Record<string, string> | null;
  category_id: MusicCategoryId;
  storage_path: string;
  duration_seconds: number;
  creator_display_name: string | null;
}

interface RankedTrack {
  id: string;
  title: string;
  title_translations: Record<string, string> | null;
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

  const playTrack = (track: { id: string; title: string; title_translations?: Record<string, string> | null; storage_path: string; category_id: MusicCategoryId; duration_seconds: number; creator_display_name?: string | null }) => {
    player.play({
      id: track.id,
      title: pickTitle(track, locale),
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
                  title={pickTitle(tr, locale)}
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
                        title={pickTitle(tr, locale)}
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
  const { trackId, rank, title, categoryId, creatorName, isSeed, collectCount, isPlaying, isFree, onPlay, onCollect, isCollecting, t } = props;
  const [showReport, setShowReport] = useState(false);
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
        <>
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
          <button
            onClick={() => setShowReport(true)}
            aria-label={t("檢舉", "Report", "通報", "신고")}
            title={t("檢舉這首歌", "Report this track", "この曲を通報", "신고")}
            style={{
              width: 24,
              height: 24,
              flexShrink: 0,
              borderRadius: 9999,
              background: "transparent",
              border: "1px solid rgba(192,192,208,0.2)",
              color: "rgba(192,192,208,0.5)",
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ⋯
          </button>
        </>
      ) : null}
      {showReport && (
        <ReportModal
          trackId={trackId}
          title={title}
          onClose={() => setShowReport(false)}
          t={t}
        />
      )}
    </div>
  );
}

function ReportModal({
  trackId,
  title,
  onClose,
  t,
}: {
  trackId: string;
  title: string;
  onClose: () => void;
  t: (zh: string, en: string, ja?: string, ko?: string) => string;
}) {
  const [reason, setReason] = useState<string>("inappropriate");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const REASONS = [
    { id: "inappropriate", label: t("內容不雅 / 違規", "Inappropriate", "不適切", "부적절") },
    { id: "spam", label: t("垃圾 / 灌水", "Spam", "スパム", "스팸") },
    { id: "copyright", label: t("抄襲 / 著作權", "Copyright", "著作権", "저작권") },
    { id: "low_quality", label: t("品質太差", "Low quality", "低品質", "낮은 품질") },
    { id: "other", label: t("其他", "Other", "その他", "기타") },
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/music/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicId: trackId, reason, notes: notes.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        alert(t("請先登入", "Please sign in", "ログインしてください", "로그인 필요"));
        return;
      }
      if (res.status === 429) {
        alert(t("你最近 24 小時已檢舉過", "Already reported in last 24h", "24時間以内に通報済", "24시간 이내 신고됨"));
        return;
      }
      if (!res.ok) {
        alert(data.message || t("檢舉失敗", "Report failed", "通報失敗", "신고 실패"));
        return;
      }
      alert(
        t(
          `檢舉已送出${data.autoFlagged ? "(已自動標記等審核)" : ""}`,
          `Reported${data.autoFlagged ? " (auto-flagged for review)" : ""}`,
          `通報を送信${data.autoFlagged ? "(自動フラグ)" : ""}`,
          `신고됨${data.autoFlagged ? "(자동 플래그)" : ""}`,
        ),
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(20,20,40,0.98)",
          border: "1px solid rgba(212,168,85,0.4)",
          borderRadius: 14,
          padding: 20,
          maxWidth: 400,
          width: "100%",
        }}
      >
        <h3 style={{ color: "#fff", fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>
          {t("檢舉這首歌", "Report this track", "この曲を通報", "이 곡 신고")}
        </h3>
        <p style={{ color: "rgba(192,192,208,0.7)", fontSize: 12, margin: "0 0 14px" }}>
          {title}
        </p>
        <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
          {REASONS.map((r) => (
            <label
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: reason === r.id ? "rgba(212,168,85,0.12)" : "transparent",
                border: reason === r.id ? "1px solid rgba(212,168,85,0.4)" : "1px solid rgba(192,192,208,0.15)",
                borderRadius: 8,
                cursor: "pointer",
                color: "#fff",
                fontSize: 13,
              }}
            >
              <input
                type="radio"
                name="report-reason"
                value={r.id}
                checked={reason === r.id}
                onChange={(e) => setReason(e.target.value)}
                style={{ accentColor: "#d4a855" }}
              />
              {r.label}
            </label>
          ))}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
          placeholder={t("補充說明(可選)", "Optional notes", "補足(任意)", "추가 설명(선택)")}
          rows={2}
          style={{
            width: "100%",
            padding: "8px 10px",
            fontSize: 13,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(212,168,85,0.3)",
            borderRadius: 8,
            color: "#fff",
            outline: "none",
            fontFamily: "inherit",
            resize: "vertical",
            marginBottom: 14,
          }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "transparent",
              border: "1px solid rgba(192,192,208,0.3)",
              borderRadius: 8,
              color: "#c0c0d0",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("取消", "Cancel", "キャンセル", "취소")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "8px 16px",
              background: "linear-gradient(135deg, #d4a855, #f0d78c)",
              border: "none",
              borderRadius: 8,
              color: "#0a0a1a",
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting ? "wait" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {submitting ? t("送出中…", "Sending…", "送信中…", "전송 중…") : t("送出檢舉", "Submit", "送信", "제출")}
          </button>
        </div>
      </div>
    </div>
  );
}
