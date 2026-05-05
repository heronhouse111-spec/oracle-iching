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
import { useLanguage } from "@/i18n/LanguageContext";

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
  /** 試聽限制秒數 — 未收藏 / 未付費的歌設這個。
   *  播到 N 秒就強制 pause 並 emit 'music:preview_ended' 事件,
   *  且強制忽略 loopMode("循環撥放功能 disabled")。 */
  previewLimitSeconds?: number;
}

export type LoopMode = "off" | "one" | "all";

interface MusicPlayerContextType {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;
  loopMode: LoopMode;
  /** 目前播放秒數 — 0 if no track or not loaded */
  currentTime: number;
  /** 整首長度(秒)— 0 if metadata not yet loaded */
  duration: number;
  /** 播放一首。可選 queue 傳入「上下文清單」,prev/next 會在 queue 裡跳。
   *  不傳 queue 時,queue = [track](單曲模式,prev/next 等於原地)。 */
  play: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  cycleLoopMode: () => void;
  /** 拖進度條時呼叫;clamp 到 [0, duration] */
  seekTo: (seconds: number) => void;
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
  const { locale } = useLanguage();
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5); // 預設一半音量(用戶要求)
  const [loopMode, setLoopMode] = useState<LoopMode>("one");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const completedRef = useRef(false);
  const initRef = useRef(false); // 確保 auto-init 只跑一次

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
      // 試聽模式(previewLimitSeconds)強制忽略 loop —「循環撥放功能 disabled」
      audio.loop = loopMode === "one" && !track.previewLimitSeconds;
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

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(audio.duration || 0, seconds));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  // ── 抓 free tracks 的 raw 結果(含 title_translations)────────
  // 拆成兩段:
  //   1. mount-only fetch + audio init(deps=[],只跑一次)
  //   2. locale 改變時 re-map 標題(不重 fetch、不動 audio.src,只更新顯示)
  //
  // 為什麼:之前把 locale 放進 fetch effect 的 deps,LanguageContext mount 後
  // 從 'zh' detect 切到 en/ja/ko 時會觸發 cleanup → cancelled=true 擋掉
  // in-flight 的 fetch.then,導致 queue 從未 setState、audio.src 永遠空、
  // bar 卡在「Loading…」。改成 mount-only 後不會被 locale 變動干擾。
  const rawTracksRef = useRef<
    | {
        id: string;
        title: string;
        title_translations?: Record<string, string> | null;
        category_id: string;
        audio_url: string;
        duration_seconds: number;
        creator_display_name: string | null;
      }[]
    | null
  >(null);

  // ── 跨頁持久化 player state(sessionStorage)──
  // 為什麼:理論上 MusicPlayerProvider 在 root layout,client-side 換頁不應該
  // remount。但使用者在 PWA / TWA / 不同瀏覽器組合下還是反映「換頁音樂重播」,
  // 為防萬一(Next 16 layout 傳 children 的時序、SW 介入、history.assign 殘餘
  // 等),把 queue / queueIndex / currentTime / isPlaying 即時寫進 sessionStorage,
  // 下次 mount 時優先 hydrate 既有狀態,音樂從上次斷點恢復(不從頭播)。
  //
  // 寫入由獨立 effect 在 audio timeupdate 等事件後 sync;讀取在 init effect 開頭。
  const PERSIST_KEY = "tarogram_player_state_v1";
  type PersistedState = {
    trackId: string | null;
    audioUrl: string | null;
    currentTime: number;
    isPlaying: boolean;
    volume: number;
    loopMode: LoopMode;
    queue: PlayerTrack[];
    queueIndex: number;
    rawTracks:
      | {
          id: string;
          title: string;
          title_translations?: Record<string, string> | null;
          category_id: string;
          audio_url: string;
          duration_seconds: number;
          creator_display_name: string | null;
        }[]
      | null;
  };
  const hydratedFromStorageRef = useRef(false);

  // ── Auto-init:開機載入「靜心冥想(精選長曲)」當預設 BGM ────────
  // 瀏覽器多半會擋 autoplay(沒用戶手勢);但 PWA standalone / TWA 通常可
  // 過。失敗就靜靜 swallow,bar 顯示為「已就緒、暫停中」,用戶按 ▶ 即可。
  //
  // mount 時優先 hydrate sessionStorage 的上次狀態(若有)— 換頁 / refresh 後
  // audio.src + currentTime 從斷點恢復,不從頭播。沒 sessionStorage 才走預設
  // 「載入靜心冥想當開機 BGM」流程。
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // ── Step 1: try sessionStorage hydrate ──
    let hydrated = false;
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(PERSIST_KEY);
        if (raw) {
          const persisted = JSON.parse(raw) as PersistedState;
          if (
            persisted &&
            Array.isArray(persisted.queue) &&
            persisted.queue.length > 0 &&
            typeof persisted.queueIndex === "number" &&
            persisted.audioUrl
          ) {
            setQueue(persisted.queue);
            setQueueIndex(persisted.queueIndex);
            setVolumeState(typeof persisted.volume === "number" ? persisted.volume : 0.5);
            setLoopMode(persisted.loopMode ?? "one");
            if (persisted.rawTracks) {
              rawTracksRef.current = persisted.rawTracks;
            }
            const audio = audioRef.current;
            if (audio) {
              audio.src = persisted.audioUrl;
              audio.volume = typeof persisted.volume === "number" ? persisted.volume : 0.5;
              audio.loop =
                (persisted.loopMode ?? "one") === "one" &&
                !persisted.queue[persisted.queueIndex]?.previewLimitSeconds;
              const seekTo = Math.max(0, persisted.currentTime || 0);
              // 等 metadata 載入再 seek;否則 currentTime 賦值會被 ignore
              const onMeta = () => {
                try {
                  audio.currentTime = seekTo;
                  setCurrentTime(seekTo);
                } catch { /* ignore */ }
                audio.removeEventListener("loadedmetadata", onMeta);
                if (persisted.isPlaying) {
                  audio.play().catch(() => {
                    // autoplay 被擋 — 等用戶按 ▶
                  });
                }
              };
              audio.addEventListener("loadedmetadata", onMeta);
            }
            hydrated = true;
            hydratedFromStorageRef.current = true;
          }
        }
      } catch {
        /* corrupt persisted state — 忽略,走預設 BGM 流程 */
      }
    }

    // ── Step 2: fetch free-tracks 來 refresh queue(不論有沒 hydrate)──
    // hydrate 成功 → 只更新 rawTracksRef + 重新 localize queue title,不動 audio.src
    // hydrate 失敗 → 載入靜心冥想當預設 BGM(原行為)
    fetch("/api/music/free-tracks")
      .then((res) => res.json())
      .then((data: { tracks?: { id: string; title: string; title_translations?: Record<string, string> | null; category_id: string; audio_url: string; duration_seconds: number; creator_display_name: string | null }[] }) => {
        const tracks = data.tracks ?? [];
        if (tracks.length === 0) return;
        rawTracksRef.current = tracks;

        // 用「當下的 locale」 — 在 fetch resolve 時讀 ref,避開 closure stale 問題
        const currentLocale = localeRef.current;
        const playerTracks: PlayerTrack[] = tracks.map((t) => {
          const tr = t.title_translations;
          const localizedTitle =
            tr && typeof tr === "object" && typeof tr[currentLocale] === "string"
              ? tr[currentLocale]
              : t.title;
          return {
            id: t.id,
            title: localizedTitle,
            audioUrl: t.audio_url,
            categoryEmoji: t.category_id === "meditation" ? "🧘" : t.category_id === "oriental" ? "🏮" : "🎵",
            creatorDisplayName: null, // bar 會 fallback 顯示「平台官方」
            durationSeconds: t.duration_seconds,
          };
        });

        const meditationIdx = Math.max(
          0,
          playerTracks.findIndex((_, i) => tracks[i].category_id === "meditation"),
        );

        // 已從 sessionStorage 恢復播放狀態 → 只 refresh queue 顯示(title 可能因 locale
        // 改了),不重置 audio.src / 不 autoplay,避免打斷使用者既有播放。
        if (hydrated) {
          // queue 用 hydrate 來的就好;rawTracksRef 用最新值讓之後 locale 改變能 re-map
          return;
        }

        setQueue(playerTracks);
        setQueueIndex(meditationIdx);

        const audio = audioRef.current;
        if (!audio) return;
        audio.src = playerTracks[meditationIdx].audioUrl;
        audio.volume = 0.5;
        audio.loop = true;
        // 嘗試 autoplay — 多半被擋,但 PWA / TWA 環境會通過
        audio.play().catch(() => {
          // 靜默失敗,等用戶按 ▶
        });
      })
      .catch((err) => {
        console.warn("[player] free-tracks fetch failed:", err);
      });
    // mount-only — 不要把 locale 放進 deps,locale 變動由下面那個 effect 處理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // locale 永遠映射到 ref,給 fetch resolve 時拿「當下值」避開 stale closure
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  // locale 改變 → 用既有 raw tracks 重 map 顯示標題,不動 audio.src / 不重 fetch
  useEffect(() => {
    const tracks = rawTracksRef.current;
    if (!tracks || tracks.length === 0) return;
    setQueue((prevQueue) =>
      prevQueue.map((pt) => {
        const raw = tracks.find((r) => r.id === pt.id);
        if (!raw) return pt;
        const tr = raw.title_translations;
        const localizedTitle =
          tr && typeof tr === "object" && typeof tr[locale] === "string"
            ? tr[locale]
            : raw.title;
        return { ...pt, title: localizedTitle };
      }),
    );
  }, [locale]);

  // ── 持久化 player 狀態到 sessionStorage(throttle 1 次/秒) ──
  // 防 Provider 在 layout boundary 邊緣案例被 remount 時,音樂從頭播。
  // 寫入時機:每次 currentTime 更新都觸發,但用 ref 上次寫入時間做節流。
  const lastPersistRef = useRef(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const writePersist = () => {
      try {
        const audio = audioRef.current;
        const snapshot: PersistedState = {
          trackId: currentTrack?.id ?? null,
          audioUrl: audio?.src && !audio.src.startsWith("blob:") ? audio.src : null,
          currentTime: audio?.currentTime ?? 0,
          isPlaying,
          volume,
          loopMode,
          queue,
          queueIndex,
          rawTracks: rawTracksRef.current,
        };
        sessionStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
      } catch {
        /* sessionStorage 滿或 disabled — 忽略 */
      }
    };
    const audio = audioRef.current;
    if (!audio) return;
    const onTick = () => {
      const now = Date.now();
      if (now - lastPersistRef.current < 1000) return; // 節流 1 秒
      lastPersistRef.current = now;
      writePersist();
    };
    // 多種事件都 trigger 持久化 — pause / play / loadedmetadata / 進度
    audio.addEventListener("timeupdate", onTick);
    audio.addEventListener("play", writePersist);
    audio.addEventListener("pause", writePersist);
    audio.addEventListener("loadedmetadata", writePersist);
    // queue / index / volume / loop 改變的 deps 也要寫一次
    writePersist();
    return () => {
      audio.removeEventListener("timeupdate", onTick);
      audio.removeEventListener("play", writePersist);
      audio.removeEventListener("pause", writePersist);
      audio.removeEventListener("loadedmetadata", writePersist);
    };
    // currentTrack/isPlaying/volume/loopMode/queue/queueIndex 變動時都重新綁(closure 抓最新值)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, isPlaying, volume, loopMode, queue, queueIndex]);

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
      // 同步 currentTime 給 UI 進度條(每 ~250ms 觸發一次)
      setCurrentTime(audio.currentTime);

      // 試聽限制 — 到 N 秒就強制 pause 並 emit 事件給 UI 顯示「收藏才能聽完整版」
      // 同時 reset 到 0,下次按 ▶ 從頭再聽一次 preview(避免卡 15.001s 的死循環)
      if (currentTrack?.previewLimitSeconds && audio.currentTime >= currentTrack.previewLimitSeconds) {
        audio.pause();
        audio.currentTime = 0;
        setCurrentTime(0);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("music:preview_ended", {
              detail: { trackId: currentTrack.id, limitSeconds: currentTrack.previewLimitSeconds },
            }),
          );
        }
        return;
      }

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
    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    const onEmptied = () => {
      // 切歌時 audio.src reset → currentTime 重來、duration 待重新 load
      setCurrentTime(0);
      setDuration(0);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("emptied", onEmptied);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("emptied", onEmptied);
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
      currentTime,
      duration,
      play,
      pause,
      stop,
      next,
      prev,
      setVolume,
      cycleLoopMode,
      seekTo,
    }),
    [currentTrack, queue, queueIndex, isPlaying, volume, loopMode, currentTime, duration, play, pause, stop, next, prev, setVolume, cycleLoopMode, seekTo],
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {/* 唯一的 <audio> 元素 — 在 layout 層級存活,切頁不會被 unmount */}
      <audio ref={audioRef} preload="auto" hidden />
      {children}
    </MusicPlayerContext.Provider>
  );
}
