import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/music/leaderboard
 * 回傳:
 *   - free: 永久免費 2 首(任何人 0 點播放)
 *   - byCategory: 6 個主題各取當日 Top 10(配合 music_rankings_daily)
 *     沒當日快照時 fallback 用 collect_count desc 排序
 *   - supabaseUrl
 *
 * 這個 endpoint 不需要登入也能讀(顯示用),收藏動作才需登入。
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();

  // ── 1. 免費歌(2 首,任何人可聽) ────────────────────
  const freeRes = await supabase
    .from("generated_music")
    .select(
      "id, title, category_id, storage_path, duration_seconds, creator_display_name",
    )
    .eq("is_free", true)
    .eq("visibility", "public")
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: true });

  // ── 2. 嘗試讀今日 ranking 快照 ──────────────────────
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const rankRes = await supabase
    .from("music_rankings_daily")
    .select(
      "music_id, category_id, rank_in_category, payout_tier, generated_music(id, title, category_id, storage_path, duration_seconds, creator_display_name, is_seed, collect_count)",
    )
    .eq("date", today)
    .lte("rank_in_category", 10)
    .order("category_id", { ascending: true })
    .order("rank_in_category", { ascending: true });

  let byCategory: Record<string, unknown[]> = {};

  if (rankRes.data && rankRes.data.length > 0) {
    // 有當日快照
    for (const row of rankRes.data) {
      const cat = row.category_id as string;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({
        ...((row as unknown as { generated_music: object }).generated_music ?? {}),
        rank_in_category: row.rank_in_category,
        payout_tier: row.payout_tier,
      });
    }
  } else {
    // Fallback:沒快照時用 collect_count + created_at 簡單排序
    const fallbackRes = await supabase
      .from("generated_music")
      .select(
        "id, title, category_id, storage_path, duration_seconds, creator_display_name, is_seed, collect_count",
      )
      .eq("visibility", "public")
      .eq("moderation_status", "approved")
      .eq("is_free", false)
      .order("collect_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60); // 6 主題 × 10

    if (fallbackRes.data) {
      const tracks = fallbackRes.data;
      byCategory = {};
      for (const t of tracks) {
        const cat = t.category_id as string;
        if (!byCategory[cat]) byCategory[cat] = [];
        if (byCategory[cat].length < 10) {
          byCategory[cat].push({
            ...t,
            rank_in_category: byCategory[cat].length + 1,
            payout_tier: byCategory[cat].length < 10 ? "top10" : "long_tail",
          });
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      free: freeRes.data ?? [],
      byCategory,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      rankingDate: rankRes.data && rankRes.data.length > 0 ? today : null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
