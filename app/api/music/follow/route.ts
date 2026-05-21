import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/music/follow      — follow 一位創作者
 * DELETE /api/music/follow    — unfollow
 * Body: { creatorId: string }
 *
 * 寫 / 刪 music_creator_follows row。
 * RLS 已限制 follower_id = auth.uid(),這支用 admin client 為了一致性。
 * Self-follow 在 SQL CHECK 已擋(follower_id <> creator_id)。
 */
export async function POST(request: NextRequest) {
  return handleFollow(request, "follow");
}

export async function DELETE(request: NextRequest) {
  return handleFollow(request, "unfollow");
}

async function handleFollow(request: NextRequest, mode: "follow" | "unfollow") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "LOGIN_REQUIRED", "Please sign in");
  }

  let body: { creatorId?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_BODY", "Invalid JSON");
  }

  const creatorId = typeof body.creatorId === "string" ? body.creatorId : "";
  if (!creatorId.match(/^[0-9a-f-]{36}$/i)) {
    return jsonError(400, "INVALID_CREATOR_ID", "Invalid creatorId");
  }
  if (creatorId === user.id) {
    return jsonError(400, "CANNOT_SELF_FOLLOW", "不能追蹤自己");
  }

  const admin = createAdminClient();

  if (mode === "follow") {
    // 確認 creator profile 存在
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .eq("id", creatorId)
      .maybeSingle();
    if (!prof) {
      return jsonError(404, "CREATOR_NOT_FOUND", "創作者不存在");
    }
    const { error } = await admin
      .from("music_creator_follows")
      .upsert(
        { follower_id: user.id, creator_id: creatorId },
        { onConflict: "follower_id,creator_id" },
      );
    if (error) {
      console.error("[follow]", error);
      return jsonError(500, "FOLLOW_FAILED", error.message);
    }
  } else {
    const { error } = await admin
      .from("music_creator_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("creator_id", creatorId);
    if (error) {
      console.error("[unfollow]", error);
      return jsonError(500, "UNFOLLOW_FAILED", error.message);
    }
  }

  // 重算 follower count 回給前端立即更新
  const { count } = await admin
    .from("music_creator_follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("creator_id", creatorId);

  return new Response(
    JSON.stringify({
      success: true,
      isFollowing: mode === "follow",
      followerCount: count ?? 0,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
