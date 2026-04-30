/**
 * ichingImages.ts — 64 卦插圖的 server-side reader.
 *
 * 跟 lib/uiImages.ts 同一套 pattern:plain anon-key supabase client(避開 cookies
 * 觸發 dynamic API)+ unstable_cache 60s。讀 app_content 表 key='iching_images'
 * 那一筆,value 是 Record<"1".."64", url> 的平面 map(key 是 hexagram.number 字串)。
 *
 * 為什麼跟 ui_images 分開存:
 *   ui_images 目前有 ~20 個 slot(CTAs / 類別 / 免費工具 / 雙系統 / 牌陣介紹圖),
 *   再塞 64 個卦會把 admin 介面跟 prod row 都搞肥;分開讓兩邊各自獨立更新、
 *   admin 介面也能專心做 64 卦的 grid。
 */

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

export type IchingImagesMap = Record<string, string>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function fetchIchingImages(): Promise<IchingImagesMap> {
  if (!supabaseUrl || !supabaseAnonKey) return {};
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .from("app_content")
      .select("value")
      .eq("key", "iching_images")
      .maybeSingle();
    if (error || !data?.value) return {};
    return data.value as IchingImagesMap;
  } catch {
    return {};
  }
}

export const getIchingImages = unstable_cache(fetchIchingImages, ["iching-images-map"], {
  revalidate: 60,
  tags: ["iching-images"],
});

/** key 形式:`hexagram.number` 字串(1..64),admin 跟 prod 兩邊都用同一個 key shape */
export function hexagramImageKey(num: number): string {
  return String(num);
}

/**
 * 易經抽卦的「背牌」圖 — 跟塔羅 CARD_BACK_IMAGE 同樣是 public 靜態資源,不走 storage。
 * 凡是易經需要翻卡動畫(/iching/daily 的 card flip 等)都統一引用這個常數,
 * 換圖只要替換 public 檔即可,不必改各頁。
 */
export const ICHING_BACK_IMAGE = "/iching/8grams/ichingbackcard.jpg";

/**
 * 八卦圖片 key 形式:`trigram:<3-bit code>`(例 `trigram:111` = 乾)。
 * 跟 64 卦共用同一個 app_content row,prefix 避開 1..64 數字 key 的 namespace,
 * 不需要新增資料表 / migration。
 */
export function trigramImageKey(code: string): string {
  return `trigram:${code}`;
}
