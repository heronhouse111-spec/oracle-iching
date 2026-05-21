/**
 * GET /api/personas — 公開讀:取出所有 active 的占卜師
 *
 * 客戶端依 system 過濾(避免每換系統就一次 round-trip)。
 * 沒設 RLS write,所以這裡只 select active=true(public RLS 已經幫我們擋了停用的)。
 *
 * 失敗 / 空表 → 回 200 + { personas: [], source: "empty" },前端會 fallback 到 static。
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60; // 1 min CDN

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("personas")
      .select(
        "id, system, tier, sort_order, emoji, image_url, name_zh, name_en, name_ja, name_ko, tagline_zh, tagline_en, tagline_ja, tagline_ko",
      )
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { personas: [], source: "error", error: error.message },
        { status: 200 },
      );
    }

    return NextResponse.json({
      personas: data ?? [],
      source: data && data.length > 0 ? "db" : "empty",
    });
  } catch (e) {
    return NextResponse.json({
      personas: [],
      source: "exception",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
