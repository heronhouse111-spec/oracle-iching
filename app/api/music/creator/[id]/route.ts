import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/music/creator/[id]
 *
 * 創作者公開資料頁的資料來源:
 *   - 顯示名 + 累計總收藏 + 總點數收益(顯示給該創作者本人才看得到金額)
 *   - 自己創作的 public 歌曲清單(含 collect_count、creator_payout 累計)
 *   - viewer 是否已 follow 這位創作者
 *   - viewer 已收藏哪些歌(讓清單可顯示「✓ 已收藏」/ 試聽限制)
 *
 * 不暴露 email / private 歌(除非 viewer 就是該 creator)。
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: creatorId } = await params;
  if (!creatorId.match(/^[0-9a-f-]{36}$/i)) {
    return jsonError(400, "INVALID_ID", "Invalid creator id");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;
  const isOwnProfile = viewerId === creatorId;

  // 用 admin client 跨 RLS 拿 profile 公開資訊(display_name / avatar_url)
  const admin = createAdminClient();
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("id, display_name, avatar_url, created_at")
    .eq("id", creatorId)
    .maybeSingle();
  if (profErr) {
    console.error("[creator] profile fetch:", profErr);
    return jsonError(500, "FETCH_FAILED", profErr.message);
  }
  if (!profile) {
    return jsonError(404, "CREATOR_NOT_FOUND", "找不到此創作者");
  }

  // 該創作者的歌:本人看全部,他人只看 public+approved
  let tracksQuery = admin
    .from("generated_music")
    .select(
      "id, title, title_translations, category_id, storage_path, duration_seconds, visibility, moderation_status, is_free, collect_count, creator_earnings_total, created_at, published_at",
    )
    .eq("creator_id", creatorId);
  if (!isOwnProfile) {
    tracksQuery = tracksQuery
      .eq("visibility", "public")
      .eq("moderation_status", "approved");
  }
  const { data: tracksData } = await tracksQuery.order("created_at", {
    ascending: false,
  });
  const tracks = tracksData ?? [];

  // 統計
  const totalCollects = tracks.reduce(
    (sum, t) => sum + (t.collect_count ?? 0),
    0,
  );
  const totalEarnings = tracks.reduce(
    (sum, t) => sum + (t.creator_earnings_total ?? 0),
    0,
  );
  const publicTrackCount = tracks.filter((t) => t.visibility === "public").length;

  // Follower count(誰在追這位)
  const { count: followerCount } = await admin
    .from("music_creator_follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("creator_id", creatorId);

  // viewer 是否已 follow
  let isFollowing = false;
  if (viewerId && !isOwnProfile) {
    const { data: rel } = await admin
      .from("music_creator_follows")
      .select("follower_id")
      .eq("follower_id", viewerId)
      .eq("creator_id", creatorId)
      .maybeSingle();
    isFollowing = !!rel;
  }

  // viewer 已收藏的歌 id(只取這位創作者的歌的 collection,給 UI 標「已收藏」)
  let viewerCollectedIds: string[] = [];
  if (viewerId) {
    const trackIds = tracks.map((t) => t.id);
    if (trackIds.length > 0) {
      const { data: collected } = await admin
        .from("music_collections")
        .select("music_id")
        .eq("user_id", viewerId)
        .in("music_id", trackIds);
      viewerCollectedIds = (collected ?? []).map((r) => r.music_id);
    }
  }

  return new Response(
    JSON.stringify({
      creator: {
        id: profile.id,
        displayName: profile.display_name ?? "",
        avatarUrl: profile.avatar_url ?? null,
        createdAt: profile.created_at,
      },
      isOwnProfile,
      isFollowing,
      followerCount: followerCount ?? 0,
      stats: {
        totalTracks: publicTrackCount,
        totalCollects,
        // 收益只給本人看(他人不該看到別人賺多少)
        totalEarnings: isOwnProfile ? totalEarnings : null,
      },
      tracks,
      viewerId,
      viewerCollectedIds,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
