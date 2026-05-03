"use client";

/**
 * 右下角浮動 mini player。currentTrack === null 時 render null(不佔空間)。
 * 切頁時不會中斷,因為 <audio> 在 PlayerProvider 裡持續存在。
 */

import { useMusicPlayer } from "@/components/MusicPlayerProvider";
import { useLanguage } from "@/i18n/LanguageContext";

export default function MusicMiniPlayer() {
  const { currentTrack, isPlaying, play, pause, stop, volume, setVolume } = useMusicPlayer();
  const { t } = useLanguage();

  if (!currentTrack) return null;

  const handleToggle = () => {
    if (isPlaying) pause();
    else play(currentTrack);
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 100,
        background: "linear-gradient(135deg, rgba(20,20,40,0.95), rgba(15,15,30,0.95))",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(212,168,85,0.4)",
        borderRadius: 14,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: "calc(100vw - 32px)",
        width: 320,
      }}
    >
      <button
        onClick={handleToggle}
        aria-label={isPlaying ? t("暫停", "Pause", "一時停止", "일시정지") : t("播放", "Play", "再生", "재생")}
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #d4a855, #f0d78c)",
          border: "none",
          color: "#0a0a1a",
          fontSize: 14,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
          </div>
        )}
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        aria-label={t("音量", "Volume", "音量", "음량")}
        style={{
          width: 60,
          flexShrink: 0,
          accentColor: "#d4a855",
        }}
      />

      <button
        onClick={stop}
        aria-label={t("關閉", "Close", "閉じる", "닫기")}
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          borderRadius: "50%",
          background: "transparent",
          border: "1px solid rgba(192,192,208,0.3)",
          color: "rgba(192,192,208,0.7)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
}
