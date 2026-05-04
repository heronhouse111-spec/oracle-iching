import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/music/stats
 *
 * 音樂後台儀表板數字。一次回所有摘要,前端不用打多支 API。
 */
export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  // 平行打多支 query 加速
  const [
    todayGenRes,
    todayCollectRes,
    totalCollectsRes,
    totalRevenueRes,
    totalEarningsRes,
    flaggedRes,
    pendingReportsRes,
    topCreatorsRes,
    topTracksRes,
  ] = await Promise.all([
    // 今日用戶生成數(排除 seed)
    admin
      .from("generated_music")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00Z`)
      .not("creator_id", "is", null),
    // 今日收藏數
    admin
      .from("music_collections")
      .select("user_id", { count: "exact", head: true })
      .gte("collected_at", `${today}T00:00:00Z`),
    // 累計收藏總數
    admin
      .from("music_collections")
      .select("user_id", { count: "exact", head: true }),
    // 累計買家付出總點數
    admin.from("music_collections").select("points_paid"),
    // 累計創作者收益(平台支出)
    admin.from("music_collections").select("creator_payout"),
    // flagged 歌數
    admin
      .from("generated_music")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "flagged"),
    // pending 檢舉數
    admin
      .from("music_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    // Top 5 創作者(按累計收益)
    admin
      .from("generated_music")
      .select("creator_id, creator_display_name, creator_earnings_total")
      .not("creator_id", "is", null)
      .gt("creator_earnings_total", 0)
      .order("creator_earnings_total", { ascending: false })
      .limit(50), // 多取一些做 client 端聚合
    // Top 5 歌曲(按收藏數)
    admin
      .from("generated_music")
      .select("id, title, creator_display_name, category_id, collect_count, creator_earnings_total")
      .eq("visibility", "public")
      .gt("collect_count", 0)
      .order("collect_count", { ascending: false })
      .limit(10),
  ]);

  const totalRevenuePoints = (totalRevenueRes.data ?? []).reduce(
    (s, r) => s + (r.points_paid ?? 0),
    0,
  );
  const totalCreatorEarnings = (totalEarningsRes.data ?? []).reduce(
    (s, r) => s + (r.creator_payout ?? 0),
    0,
  );

  // 創作者聚合(按 creator_id 把多首歌的收益加總)
  const creatorMap = new Map<
    string,
    { creator_id: string; creator_display_name: string; total: number }
  >();
  for (const row of topCreatorsRes.data ?? []) {
    if (!row.creator_id) continue;
    const existing = creatorMap.get(row.creator_id);
    if (existing) {
      existing.total += row.creator_earnings_total ?? 0;
    } else {
      creatorMap.set(row.creator_id, {
        creator_id: row.creator_id,
        creator_display_name: row.creator_display_name ?? "(未命名)",
        total: row.creator_earnings_total ?? 0,
      });
    }
  }
  const topCreators = Array.from(creatorMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return NextResponse.json({
    todayGenerations: todayGenRes.count ?? 0,
    todayCollections: todayCollectRes.count ?? 0,
    totalCollections: totalCollectsRes.count ?? 0,
    totalRevenuePoints,
    totalCreatorEarnings,
    platformNetPoints: totalRevenuePoints - totalCreatorEarnings,
    flaggedTracks: flaggedRes.count ?? 0,
    pendingReports: pendingReportsRes.count ?? 0,
    topCreators,
    topTracks: topTracksRes.data ?? [],
  });
}
