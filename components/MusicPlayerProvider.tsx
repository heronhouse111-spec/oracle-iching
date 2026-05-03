"use client";

/**
 * 全站音樂播放器 — Phase 27
 *
 * 設計重點:
 *   1. 整個 APP 只有 ONE <audio> 元素,放在 root layout 裡 ──
 *      切頁面也不會中斷,跨頁面持續播放(BGM 場景的關鍵)。
 *   2. 用 Context 暴露 play(track) / pause() / setVolume / current track。
 *   3. <audio> 預設 loop,讓 BGM 自動循環直到使用者切歌。
 *   4. 完成播放(>= 80%)會發 'music:completed' event,
 *      collect/play 統計用 — 但實際 hit /api/music/play 由呼叫端決定。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

interface PlayerTrack {
  id: string;
  title: string;
  audioUrl: string;
  /** 顯示用 — UI 拿來標 emoji */
  categoryEmoji?: string;
  /** UGC 創作者顯示名稱;平台種子歌可帶 '平台官方' */
  creatorDisplayName?: string | null;
  /** 秒數 — 用來判斷「是否聽完」的閾值 */
  durationSeconds?: number;
}

interface MusicPlayerContextType {
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  volume: number;
  /** 播放某首(若已是同首,toggle play/pause)。新曲會自動 reset position 並 loop。 */
  play: (track: PlayerTrack) => void;
  /** 暫停。再 play 同一首會從停的位置續播。 */
  pause: () => void;
  /** 完全停止 + 收 mini player */
  stop: () => void;
  setVolume: (v: number) => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

export function useMusicPlayer(): MusicPlayerContextType {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  }
  return ctx;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);
  const completedRef = useRef(false); // 同一首只發一次 completed event

  const play = useCallback(
    (track: PlayerTrack) => {
      const audio = audioRef.current;
      if (!audio) return;

      // 若同首正在播 → toggle pause/resume,不重新載入
      if (currentTrack?.id === track.id) {
        if (audio.paused) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
        return;
      }

      // 切到新曲:reset
      completedRef.current = false;
      setCurrentTrack(track);
      audio.src = track.audioUrl;
      audio.volume = volume;
      audio.loop = true;
      audio.currentTime = 0;
      audio.play().catch((err) => {
        console.warn("[player] play failed:", err);
      });
    },
    [currentTrack, volume],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    completedRef.current = false;
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  // 把 audio element 的 play/pause/timeupdate 同步到 React state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      if (completedRef.current) return;
      if (!currentTrack?.durationSeconds) return;
      const threshold = currentTrack.durationSeconds * 0.8;
      if (audio.currentTime >= threshold) {
        completedRef.current = true;
        // 發出全站事件 — /api/music/play 監聽
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("music:completed", { detail: { trackId: currentTrack.id } }),
          );
        }
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [currentTrack]);

  const value = useMemo<MusicPlayerContextType>(
    () => ({ currentTrack, isPlaying, volume, play, pause, stop, setVolume }),
    [currentTrack, isPlaying, volume, play, pause, stop, setVolume],
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {/* 唯一的 <audio> 元素 — 在 layout 層級存活,切頁不會被 unmount */}
      <audio ref={audioRef} preload="auto" hidden />
      {children}
    </MusicPlayerContext.Provider>
  );
}
