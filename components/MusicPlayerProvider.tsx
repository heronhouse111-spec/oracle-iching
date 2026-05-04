"use client";

/**
 * 全站音樂播放器 — Phase 27 / 28
 *
 * 設計重點:
 *   1. 整個 APP 只有 ONE <audio> 元素,放在 root layout 裡 ──
 *      切頁面也不會中斷,跨頁面持續播放(BGM 場景的關鍵)。
 *   2. 用 Context 暴露 play(track, queue?) / pause / next / prev / setVolume / cycleLoopMode。
 *   3. 三種 loop 模式:
 *        - "one":同首循環(預設,真 audio.loop=true)
 *        - "all":播完換下一首(到尾循環回 queue 開頭)
 *        - "off":播完停止
 *   4. 完成播放(>= 80%)會發 'music:completed' event,可作播放統計。
 *
 * 對 page 端使用範例:
 *   const tracks = [...visible tracks...];
 *   player.play(tracks[i], tracks);  // 播第 i 首,設整個 queue
 *   player.next();                   // 下一首
 *   player.prev();                   // 上一首
 *   player.cycleLoopMode();          // 切 one → all → off → one
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

export interface PlayerTrack {
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

export type LoopMode = "off" | "one" | "all";

interface MusicPlayerContextType {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  loopMode: LoopMode;
  /** 播放一首。可選 queue 傳入「上下文清單」,prev/next 會在 queue 裡跳。
   *  不傳 queue 時,queue = [track](單曲模式,prev/next 等於原地)。 */
  play: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  cycleLoopMode: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

export function useMusicPlayer(): MusicPlayerContextType {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  }
  return ctx;
}

const LOOP_CYCLE: LoopMode[] = ["one", "all", "off"];

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);
  const [loopMode, setLoopMode] = useState<LoopMode>("one");
  const completedRef = useRef(false);

  const currentTrack: PlayerTrack | null =
    queueIndex >= 0 && queueIndex < queue.length ? queue[queueIndex] : null;

  const playAt = useCallback(
    (index: number, q: PlayerTrack[]) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (index < 0 || index >= q.length) return;

      const track = q[index];
      completedRef.current = false;
      setQueue(q);
      setQueueIndex(index);

      audio.src = track.audioUrl;
      audio.volume = volume;
      // loop="one" 時讓 audio 自循環;"all"/"off" 由 onEnded 處理
      audio.loop = loopMode === "one";
      audio.currentTime = 0;
      audio.play().catch((err) => {
        console.warn("[player] play failed:", err);
      });
    },
    [volume, loopMode],
  );

  const play = useCallback(
    (track: PlayerTrack, newQueue?: PlayerTrack[]) => {
      const audio = audioRef.current;
      if (!audio) return;

      const q = newQueue && newQueue.length > 0 ? newQueue : [track];
      const index = Math.max(
        0,
        q.findIndex((t) => t.id === track.id),
      );

      // 同首正在播 → toggle pause/resume,不重新載入
      if (currentTrack?.id === track.id && audio.src) {
        if (audio.paused) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
        // 若 queue 內容變了仍要更新(用戶切到不同 page 又播同首)
        if (newQueue) {
          setQueue(q);
          setQueueIndex(index);
        }
        return;
      }

      playAt(index, q);
    },
    [currentTrack, playAt],
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
    setQueue([]);
    setQueueIndex(-1);
    setIsPlaying(false);
    completedRef.current = false;
  }, []);

  const next = useCallback(() => {
    if (queue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      // 已到 queue 尾
      if (loopMode === "all") {
        nextIdx = 0;
      } else {
        return; // off / one(one 不會走到這 — onEnded 不會 fire 因為 audio.loop=true)
      }
    }
    playAt(nextIdx, queue);
  }, [queue, queueIndex, loopMode, playAt]);

  const prev = useCallback(() => {
    if (queue.length === 0) return;
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      if (loopMode === "all") {
        prevIdx = queue.length - 1;
      } else {
        prevIdx = 0; // off / one:停在第一首
      }
    }
    playAt(prevIdx, queue);
  }, [queue, queueIndex, loopMode, playAt]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const cycleLoopMode = useCallback(() => {
    setLoopMode((prev) => {
      const idx = LOOP_CYCLE.indexOf(prev);
      const nextMode = LOOP_CYCLE[(idx + 1) % LOOP_CYCLE.length];
      // audio.loop 跟著切 — "one" 時讓 native loop 接管,其他靠 onEnded
      if (audioRef.current) {
        audioRef.current.loop = nextMode === "one";
      }
      return nextMode;
    });
  }, []);

  // audio element 的事件同步到 React state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      // loopMode === "one" 時 audio.loop=true,native 自處理,onEnded 不 fire
      // 走到這裡只剩 "all" 跟 "off"
      if (loopMode === "all") {
        // 用 setTimeout 避開 onEnded 內直接 play 的 race
        setTimeout(() => next(), 0);
      } else {
        setIsPlaying(false);
      }
    };
    const onTimeUpdate = () => {
      if (completedRef.current) return;
      if (!currentTrack?.durationSeconds) return;
      const threshold = currentTrack.durationSeconds * 0.8;
      if (audio.currentTime >= threshold) {
        completedRef.current = true;
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
  }, [currentTrack, loopMode, next]);

  const value = useMemo<MusicPlayerContextType>(
    () => ({
      currentTrack,
      queue,
      queueIndex,
      isPlaying,
      volume,
      loopMode,
      play,
      pause,
      stop,
      next,
      prev,
      setVolume,
      cycleLoopMode,
    }),
    [currentTrack, queue, queueIndex, isPlaying, volume, loopMode, play, pause, stop, next, prev, setVolume, cycleLoopMode],
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {/* 唯一的 <audio> 元素 — 在 layout 層級存活,切頁不會被 unmount */}
      <audio ref={audioRef} preload="auto" hidden />
      {children}
    </MusicPlayerContext.Provider>
  );
}
