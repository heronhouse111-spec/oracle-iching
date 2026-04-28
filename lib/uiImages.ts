/**
 * uiImages.ts — server-side helper to read the UI image slot map.
 *
 * 設計考量:這個查詢被 RootLayout 用 — 等於每個 page 都會撈一次。為了不讓所有頁面
 * 從 static 退回 dynamic,刻意避開 cookies-based supabase client(那是 Next.js
 * dynamic API)。改用 plain anon-key client(無 session、無 cookies),配合
 * Next 的 unstable_cache 做跨 request 快取(60 秒 TTL,跟舊 /api/ui-images 對齊)。
 * Admin 後台改了圖片之後,最多 60 秒內會生效。
 */

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

export type UiImagesMap = Record<string, string>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function fetchUiImages(): Promise<UiImagesMap> {
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

export const getUiImages = unstable_cache(fetchUiImages, ["ui-images-map"], {
  revalidate: 60,
  tags: ["ui-images"],
});
