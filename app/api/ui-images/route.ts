/**
 * GET /api/ui-images — 公開讀:回傳所有 UI 圖片 slot → URL 的 map
 *
 * Slot 結構:平面物件,例如 { "category.love": "https://...", "cta.iching": "..." }
 * 沒設定的 slot 不會出現在 map 裡(前端就用 emoji fallback)。
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60; // 1 min CDN

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_content")
      .select("value")
      .eq("key", "ui_images")
      .maybeSingle();

    if (error || !data?.value) {
      return NextResponse.json({ images: {}, source: error ? "error" : "empty" });
    }

    return NextResponse.json({ images: data.value, source: "db" });
  } catch (e) {
    return NextResponse.json({
      images: {},
      source: "exception",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
