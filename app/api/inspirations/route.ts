/**
 * GET /api/inspirations — 公開讀:取出問題靈感題庫
 *
 * 行為:
 *   - 若 app_content 表內有 key='question_inspirations' 的 row,回傳該 jsonb value
 *   - 沒有 row(剛 migrate / admin 還沒儲存過)→ fallback 到 repo 內的 static data
 *   - 客戶端只 cache 5 分鐘(s-maxage),避免改完很久才生效
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { QUESTION_INSPIRATIONS } from "@/data/questionInspirations";

export const runtime = "nodejs";
export const revalidate = 300; // 5 min CDN

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_content")
      .select("value")
      .eq("key", "question_inspirations")
      .maybeSingle();

    if (error) {
      // RLS / 連線問題 → 用 static fallback,但回 500 讓前端知道後端不健康(不阻擋使用者)
      return NextResponse.json(
        { inspirations: QUESTION_INSPIRATIONS, source: "static_fallback", error: error.message },
        { status: 200 }, // 仍回 200,避免阻擋使用者
      );
    }

    if (!data?.value) {
      return NextResponse.json({
        inspirations: QUESTION_INSPIRATIONS,
        source: "static_default",
      });
    }

    return NextResponse.json({ inspirations: data.value, source: "db" });
  } catch (e) {
    return NextResponse.json({
      inspirations: QUESTION_INSPIRATIONS,
      source: "static_fallback_exception",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
