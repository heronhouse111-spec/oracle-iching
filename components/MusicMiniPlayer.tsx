"use client";

/**
 * 底部音樂控制條 — Phase 28(Spotify-style,易問配色)
 *
 * 兩段式 UI:
 *   1. 底部 bar(永遠顯示):全寬 fixed,內容置中對齊 Header 寬度
 *      - 進度條(可點/拖)
 *      - 縮圖 + 標題 / 創作者
 *      - 上一首 / 播放暫停 / 下一首
 *      - "▴" 展開更多按鈕
 *   2. 抽屜 drawer(點 ▴ 展開):額外控制
 *      - 音量 slider
 *      - Loop 三段切換
 *      - 關閉 (X)
 *
 * iOS PWA / Android TWA:bottom 留 safe-area-inset-bottom 給 home indicator。
 *
 * currentTrack === null 時整個 component render null,不佔空間。
 */

import { useState, useRef, useCallback } from "react";
import { useMusicPlayer } from "@/components/MusicPlayerProvider";
import { useLanguage } from "@/i18n/LanguageContext";

const BAR_HEIGHT = 64;
const MAX_INNER_WIDTH = 640;

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function MusicMiniPlayer() {
  const {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    play,
    pause,
    stop,
    next,
    prev,
    volume,
    setVolume,
    loopMode,
    cycleLoopMode,
    currentTime,
    duration,
    seekTo,
  } = useMusicPlayer();
  const { t } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const handleTogglePlay = useCallback(() => {
    if (!currentTrack) return;
    if (isPlaying) pause();
    else play(currentTrack);
  }, [currentTrack, isPlaying, play, pause]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressBarRef.current || duration <= 0) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      seekTo(Math.max(0, Math.min(1, ratio)) * duration);
    },
    [duration, seekTo],
  );

  // 用戶要求:任何頁面都要看得到 bar,無論是否有 currentTrack。
  // 沒 track 時 bar 顯示 placeholder,引導去 /music。
  const hasTrack = !!currentTrack;
  const progress = duration > 0 ? currentTime / duration : 0;
  const hasQueue = queue.length > 1;
  const loopIcon = loopMode === "one" ? "🔂" : loopMode === "all" ? "🔁" : "↻";
  const loopLabel =
    loopMode === "one"
      ? t("單曲循環", "Loop one", "1 曲リピート", "한 곡 반복")
      : loopMode === "all"
        ? t("循環整列", "Loop all", "全曲リピート", "전체 반복")
        : t("不循環", "No loop", "リピートなし", "반복 없음");

  return (
    <>
      {/* ── 抽屜:點 ▴ 展開,出現在 bar 上方 ────────── */}
      {drawerOpen && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: `calc(${BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
            zIndex: 99,
            background: "linear-gradient(180deg, rgba(20,20,40,0.97), rgba(15,15,30,0.97))",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: "1px solid rgba(212,168,85,0.2)",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              maxWidth: MAX_INNER_WIDTH,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            {/* Loop */}
            <button
              onClick={cycleLoopMode}
              aria-label={loopLabel}
              title={loopLabel}
              style={{
                minWidth: 36,
                height: 36,
                padding: "0 10px",
                borderRadius: 18,
                background: loopMode === "off" ? "transparent" : "rgba(212,168,85,0.15)",
                border: "1px solid rgba(212,168,85,0.4)",
                color: loopMode === "off" ? "rgba(192,192,208,0.5)" : "#d4a855",
                fontSize: 15,
                cursor: "pointer",
                fontFamily: "inherit",
                lineHeight: 1,
              }}
            >
              {loopIcon}
            </button>

            {/* 音量 */}
            <span style={{ fontSize: 14, color: "rgba(192,192,208,0.6)" }}>🔊</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              aria-label={t("音量", "Volume", "音量", "음량")}
              style={{ flex: 1, accentColor: "#d4a855" }}
            />
            <span
              style={{
                fontSize: 11,
                color: "rgba(192,192,208,0.6)",
                minWidth: 28,
                textAlign: "right",
              }}
            >
              {Math.round(volume * 100)}
            </span>
          </div>
        </div>
      )}

      {/* ── 底部 bar ────────────────────────────── */}
      <div
        role="region"
        aria-label={t("音樂播放器", "Music player", "音楽プレーヤー", "음악 플레이어")}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          background: "linear-gradient(180deg, rgba(20,20,40,0.96), rgba(10,10,26,0.98))",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderTop: "1px solid rgba(212,168,85,0.25)",
          paddingBottom: "env(safe-area-inset-bottom)",
          // 上方陰影製造浮起效果
          boxShadow: "0 -4px 16px rgba(0,0,0,0.4)",
        }}
      >
        {/* 進度條(可點)*/}
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          aria-label={t("播放進度", "Progress", "進行状況", "진행")}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime}
          style={{
            position: "relative",
            height: 3,
            width: "100%",
            background: "rgba(192,192,208,0.15)",
            cursor: duration > 0 ? "pointer" : "default",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, #d4a855, #f0d78c)",
              transition: "width 0.15s linear",
            }}
          />
        </div>

        {/* bar 主體 */}
        <div
          style={{
            maxWidth: MAX_INNER_WIDTH,
            margin: "0 auto",
            height: BAR_HEIGHT,
            paddingLeft: "max(12px, env(safe-area-inset-left))",
            paddingRight: "max(12px, env(safe-area-inset-right))",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* 縮圖(emoji 圓) */}
          <div
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 10,
              background: "linear-gradient(135deg, rgba(212,168,85,0.25), rgba(240,215,140,0.12))",
              border: "1px solid rgba(212,168,85,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "inline-block",
                animation: isPlaying ? "music-spin 8s linear infinite" : "none",
              }}
            >
              {currentTrack?.categoryEmoji ?? "🎵"}
            </span>
          </div>

          {/* 標題 + 創作者(可滑動截斷) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.3,
              }}
            >
              {currentTrack?.title ?? t("載入中…", "Loading…", "読み込み中…", "로딩 중…")}
            </div>
            <div
              style={{
                color: "rgba(192,192,208,0.65)",
                fontSize: 11,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.3,
                marginTop: 2,
              }}
            >
              {hasTrack
                ? currentTrack?.creatorDisplayName ?? t("平台官方", "Official", "公式", "공식")
                : t("準備中", "Preparing", "準備中", "준비 중")}
              {hasQueue && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  · {queueIndex + 1}/{queue.length}
                </span>
              )}
              {hasTrack && duration > 0 && (
                <span style={{ marginLeft: 6, opacity: 0.55 }}>
                  · {fmtTime(currentTime)} / {fmtTime(duration)}
                </span>
              )}
            </div>
          </div>

          {/* 上一首 */}
          <button
            onClick={prev}
            disabled={!hasQueue}
            aria-label={t("上一首", "Previous", "前へ", "이전")}
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: "50%",
              background: "transparent",
              border: "none",
              color: hasQueue ? "#d4a855" : "rgba(192,192,208,0.25)",
              fontSize: 16,
              cursor: hasQueue ? "pointer" : "not-allowed",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ⏮
          </button>

          {/* 播放 / 暫停(主按鈕,稍大) */}
          <button
            onClick={handleTogglePlay}
            disabled={!hasTrack}
            aria-label={isPlaying ? t("暫停", "Pause", "一時停止", "일시정지") : t("播放", "Play", "再生", "재생")}
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: "50%",
              background: hasTrack
                ? "linear-gradient(135deg, #d4a855, #f0d78c)"
                : "rgba(212,168,85,0.2)",
              border: "none",
              color: hasTrack ? "#0a0a1a" : "rgba(192,192,208,0.4)",
              fontSize: 14,
              cursor: hasTrack ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              boxShadow: hasTrack ? "0 2px 8px rgba(212,168,85,0.4)" : "none",
            }}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          {/* 下一首 */}
          <button
            onClick={next}
            disabled={!hasQueue}
            aria-label={t("下一首", "Next", "次へ", "다음")}
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: "50%",
              background: "transparent",
              border: "none",
              color: hasQueue ? "#d4a855" : "rgba(192,192,208,0.25)",
              fontSize: 16,
              cursor: hasQueue ? "pointer" : "not-allowed",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ⏭
          </button>

          {/* 展開抽屜(▾ 收 / ▴ 展) */}
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? t("收合更多", "Collapse", "折りたたむ", "접기") : t("更多控制", "More controls", "その他", "더보기")}
            title={drawerOpen ? t("收合", "Collapse", "折りたたむ", "접기") : t("更多", "More", "その他", "더보기")}
            style={{
              width: 28,
              height: 28,
              flexShrink: 0,
              borderRadius: "50%",
              background: "transparent",
              border: "1px solid rgba(192,192,208,0.25)",
              color: "rgba(192,192,208,0.7)",
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            {drawerOpen ? "▾" : "▴"}
          </button>
        </div>

        <style jsx>{`
          @keyframes music-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
}
