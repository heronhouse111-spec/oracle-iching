/**
 * uiImages.ts — server-side helper to read the UI image slot map.
 *
 * 設計考量:這個查詢被 RootLayout 用 — 等於每個 page 都會撈一次。為了不讓所有頁面
 * 從 static 退回 dynamic,刻意避開 cookies-based supabase client(那是 Next.js
 * dynamic API)。改用 plain anon-key client(無 session、無 cookies)。
 *
 * v2(2026-05-17):從 unstable_cache 改成 module-level memory cache + true SWR
 * ────────────────────────────────────────────────────────────────────
 * 為什麼:unstable_cache 在 revalidate 期到時,下一個 request 會「阻塞等新資料」,
 * 等於每 60 秒就有一位衰運使用者付完整的 Supabase round-trip 才能 SSR。這就是首頁
 * 「有時候卡頓」的元兇之一。
 *
 * 現在的策略:
 *   - 第一次撈完之後就常駐在 worker memory(per Vercel function instance)。
 *   - 距上次撈 > REVALIDATE_MS:**先回 stale,背景非阻塞重撈** — 沒人會等。
 *   - 完全沒撈過(冷啟動):同步等一次,且 5 秒 timeout 保底回 {}。
 * Admin 改了圖最壞情況等下一次 revalidate(60 秒)+ 下下個請求才看到新值,可以接受。
 */

import { createClient } from "@supabase/supabase-js";

export type UiImagesMap = Record<string, string>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const REVALIDATE_MS = 60_000; // 60 秒;跟舊 unstable_cache 行為對齊
const COLD_FETCH_TIMEOUT_MS = 5_000; // 冷啟動 Supabase 撈太久就放棄,先回空 map

type CacheEntry = {
  data: UiImagesMap;
  fetchedAt: number;
};

// Module-level cache:Vercel function instance 內共享。
// 同一 instance 跨 request 都用同一份,真 SWR 行為。
let cache: CacheEntry | null = null;
let inflight: Promise<UiImagesMap> | null = null;

async function fetchUiImagesRaw(): Promise<UiImagesMap> {
  if (!supabaseUrl || !supabaseAnonKey) return {};
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .from("app_content")
      .select("value")
      .eq("key", "ui_images")
      .maybeSingle();
    if (error || !data?.value) return {};
    return data.value as UiImagesMap;
  } catch {
    return {};
  }
}

/**
 * Admin 改圖後叫這個強制下次撈新值。
 * 注意:只能 invalidate 當前 function instance 的 module cache —
 * Vercel 其他 instance 還是要等 60 秒 TTL 自己 stale。實務可接受。
 */
export function bustUiImagesCache(): void {
  cache = null;
  inflight = null;
}

/** 撈一次並更新 module cache。重入時共用同一個 inflight promise,避免 N 個 request 同時打 Supabase。 */
function refresh(): Promise<UiImagesMap> {
  if (inflight) return inflight;
  inflight = fetchUiImagesRaw()
    .then((data) => {
      cache = { data, fetchedAt: Date.now() };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Returns a UI image map.
 *
 * - Warm + fresh:同步回 cache,不打 Supabase。
 * - Warm + stale:回 stale,**背景**(fire-and-forget)重撈。Caller 完全不等。
 * - Cold:同步等一次,加 5 秒 timeout 保底,避免 Supabase 慢時拖垮整個 SSR。
 */
export async function getUiImages(): Promise<UiImagesMap> {
  const now = Date.now();

  if (cache) {
    const age = now - cache.fetchedAt;
    if (age > REVALIDATE_MS) {
      // Stale-while-revalidate:背景重撈,當前 request 不等
      void refresh();
    }
    return cache.data;
  }

  // 冷啟動:必須同步等。但加 timeout 保底,Supabase 慢時不至於整頁卡住
  try {
    return await Promise.race([
      refresh(),
      new Promise<UiImagesMap>((resolve) =>
        setTimeout(() => resolve({}), COLD_FETCH_TIMEOUT_MS)
      ),
    ]);
  } catch {
    return {};
  }
}
