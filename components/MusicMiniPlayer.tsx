"use client";

/**
 * 右下角浮動 mini player(Phase 28 升級版)
 *
 * 兩種狀態:
 *   - 收合(默認):48x48 圓形按鈕,顯示 ▶/⏸ 圖示
 *   - 展開(hover or tap):完整控制條,prev / play / next / volume / loop / close
 *
 * Hover 邏輯(桌面):onMouseEnter 展開,onMouseLeave 收合
 * Tap 邏輯(行動裝置):點圓按鈕切換 expanded state
 *
 * currentTrack === null 時整個 component render null。
 */

import { useEffect, useRef, useState } from "react";
import { useMusicPlayer } from "@/components/MusicPlayerProvider";
import { useLanguage } from "@/i18n/LanguageContext";

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
  } = useMusicPlayer();
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const collapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 切歌時暫時展開讓用戶看到新 track,3 秒後 auto-收合(若 mouse 不在上面)
  useEffect(() => {
    if (!currentTrack) return;
    setExpanded(true);
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => setExpanded(false), 3000);
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, [currentTrack?.id]);

  if (!currentTrack) return null;

  const handleToggle = () => {
    if (isPlaying) pause();
    else play(currentTrack);
  };

  const handleMouseEnter = () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    setExpanded(true);
  };

  const handleMouseLeave = () => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => setExpanded(false), 800);
  };

  const hasQueue = queue.length > 1;
  const canPrev = hasQueue;
  const canNext = hasQueue;

  // Loop icon + 標題
  const loopIcon = loopMode === "one" ? "🔂" : loopMode === "all" ? "🔁" : "↻";
  const loopLabel =
    loopMode === "one"
      ? t("單曲循環", "Loop one", "1 曲リピート", "한 곡 반복")
      : loopMode === "all"
        ? t("循環整列", "Loop all", "全曲リピート", "전체 반복")
        : t("不循環", "No loop", "リピートなし", "반복 없음");

  // 收合狀態:48x48 圓按鈕
  if (!expanded) {
    return (
      <button
        onMouseEnter={handleMouseEnter}
        onClick={() => setExpanded(true)}
        aria-label={t("展開音樂控制器", "Expand music player", "音楽プレーヤーを展開", "음악 플레이어 펼치기")}
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 100,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(212,168,85,0.95), rgba(240,215,140,0.95))",
          border: "2px solid rgba(255,255,255,0.2)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 4px rgba(212,168,85,0.15)",
          color: "#0a0a1a",
          fontSize: 20,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "inherit",
          padding: 0,
          transition: "transform 0.2s",
        }}
      >
        {/* 旋轉中的播放動畫(優化:只用一個 emoji,簡單) */}
        <span
          style={{
            display: "inline-block",
            animation: isPlaying ? "music-spin 8s linear infinite" : "none",
          }}
        >
          {currentTrack.categoryEmoji ?? "🎵"}
        </span>
        <style jsx>{`
          @keyframes music-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </button>
    );
  }

  // 展開狀態:完整控制器
  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 100,
        background: "linear-gradient(135deg, rgba(20,20,40,0.97), rgba(15,15,30,0.97))",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(212,168,85,0.4)",
        borderRadius: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: "calc(100vw - 32px)",
        width: 360,
      }}
    >
      {/* 第一列:標題 + close */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
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
            {currentTrack.categoryEmoji ? `${currentTrack.categoryEmoji} ` : ""}
            {currentTrack.title}
          </div>
          {currentTrack.creatorDisplayName && (
            <div
              style={{
                color: "rgba(192,192,208,0.7)",
                fontSize: 11,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentTrack.creatorDisplayName}
              {hasQueue && (
                <span style={{ marginLeft: 6, opacity: 0.6 }}>
                  · {queueIndex + 1} / {queue.length}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={stop}
          aria-label={t("關閉", "Close", "閉じる", "닫기")}
          style={{
            width: 24,
            height: 24,
            flexShrink: 0,
            borderRadius: "50%",
            background: "transparent",
            border: "1px solid rgba(192,192,208,0.3)",
            color: "rgba(192,192,208,0.7)",
            fontSize: 12,
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* 第二列:prev / play / next / loop */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <button
          onClick={prev}
          disabled={!canPrev}
          aria-label={t("上一首", "Previous", "前へ", "이전")}
          title={t("上一首", "Previous", "前へ", "이전")}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "transparent",
            border: "1px solid rgba(212,168,85,0.3)",
            color: canPrev ? "#d4a855" : "rgba(192,192,208,0.3)",
            fontSize: 14,
            cursor: canPrev ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ⏮
        </button>

        <button
          onClick={handleToggle}
          aria-label={isPlaying ? t("暫停", "Pause", "一時停止", "일시정지") : t("播放", "Play", "再生", "재생")}
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #d4a855, #f0d78c)",
            border: "none",
            color: "#0a0a1a",
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <button
          onClick={next}
          disabled={!canNext}
          aria-label={t("下一首", "Next", "次へ", "다음")}
          title={t("下一首", "Next", "次へ", "다음")}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "transparent",
            border: "1px solid rgba(212,168,85,0.3)",
            color: canNext ? "#d4a855" : "rgba(192,192,208,0.3)",
            fontSize: 14,
            cursor: canNext ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ⏭
        </button>

        <div style={{ width: 1, height: 22, background: "rgba(192,192,208,0.2)", margin: "0 4px" }} />

        <button
          onClick={cycleLoopMode}
          aria-label={loopLabel}
          title={loopLabel}
          style={{
            minWidth: 32,
            height: 32,
            padding: "0 8px",
            borderRadius: 16,
            background:
              loopMode === "off" ? "transparent" : "rgba(212,168,85,0.15)",
            border: "1px solid rgba(212,168,85,0.3)",
            color: loopMode === "off" ? "rgba(192,192,208,0.5)" : "#d4a855",
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
            lineHeight: 1,
          }}
        >
          {loopIcon}
        </button>
      </div>

      {/* 第三列:音量 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, color: "rgba(192,192,208,0.6)" }}>🔊</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          aria-label={t("音量", "Volume", "音量", "음량")}
          style={{
            flex: 1,
            accentColor: "#d4a855",
          }}
        />
        <span style={{ fontSize: 11, color: "rgba(192,192,208,0.5)", minWidth: 28, textAlign: "right" }}>
          {Math.round(volume * 100)}
        </span>
      </div>
    </div>
  );
}
