"use client";

/**
 * useUiImages — 全頁共享的 UI 圖片 fetcher
 *
 * 第一個用到的 component mount 時打一次 /api/ui-images,結果存 module-level cache,
 * 後面 component 用同一份(避免重複請求 + 閃爍)。fetch 失敗就回空物件,
 * 任何用法都應該對「沒 url」做 emoji fallback。
 */

import { useEffect, useState } from "react";

type ImagesMap = Record<string, string>;

let cache: ImagesMap | null = null;
let inflight: Promise<ImagesMap> | null = null;

async function loadOnce(): Promise<ImagesMap> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/ui-images", { cache: "no-store" });
      if (!res.ok) return {};
      const data = (await res.json()) as { images?: ImagesMap };
      cache = data.images ?? {};
      return cache;
    } catch {
      cache = {};
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useUiImages(): ImagesMap {
  const [images, setImages] = useState<ImagesMap>(cache ?? {});
  useEffect(() => {
    let cancelled = false;
    loadOnce().then((data) => {
      if (!cancelled) setImages(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return images;
}
