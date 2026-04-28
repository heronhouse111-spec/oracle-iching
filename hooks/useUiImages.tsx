"use client";

/**
 * useUiImages — 全頁共享的 UI 圖片 map
 *
 * 圖片在 RootLayout (server component) 用 lib/uiImages.getUiImages() 從 Supabase
 * 撈一次,經由 UiImagesProvider 把 map 注入 React context,所有 consumer 拿到的
 * 都是 SSR 階段就準備好的同一份 — 第一次 paint 就有正確 url,沒有 fetch / mount /
 * setState 造成的閃爍。
 *
 * 設計選擇:
 *   - 不再做 client-side fetch 的原因:它一定會晚於第一次 render,造成 emoji →
 *     圖片的 swap,UX 不好。
 *   - 沒上傳的 slot 直接 url=undefined,呼叫端不再 fallback 到 emoji(空著)。
 */

import { createContext, useContext, type ReactNode } from "react";

type ImagesMap = Record<string, string>;

const UiImagesCtx = createContext<ImagesMap>({});

export function UiImagesProvider({
  images,
  children,
}: {
  images: ImagesMap;
  children: ReactNode;
}) {
  return <UiImagesCtx.Provider value={images}>{children}</UiImagesCtx.Provider>;
}

export function useUiImages(): ImagesMap {
  return useContext(UiImagesCtx);
}
