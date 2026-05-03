import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/music/publish
 * Body: { musicId: string }
 *
 * 把自己 private 的歌公開到排行榜池。
 * 後續可被別人花 20 點(訂閱戶 16 點)收藏,創作者依當日排名拿分潤。
 *
 * ⚠️ 公開後不能撤回成 private — 只能完整下架(takedown_music_by_creator)
 *    並退所有買家 20 點 + 從創作者已賺扣回。T&C 寫明此承諾。
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "LOGIN_REQUIRED", "Please sign in");
  }

  let body: { musicId?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_BODY", "Invalid JSON");
  }

  const musicId = typeof body.musicId === "string" ? body.musicId : "";
  if (!musicId.match(/^[0-9a-f-]{36}$/i)) {
    return jsonError(400, "INVALID_MUSIC_ID", "Invalid musicId");
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("publish_music", {
    p_user_id: user.id,
    p_music_id: musicId,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("MUSIC_NOT_FOUND")) {
      return jsonError(404, "MUSIC_NOT_FOUND", "找不到這首音樂");
    }
    if (msg.includes("NOT_OWNER")) {
      return jsonError(403, "NOT_OWNER", "你不是這首音樂的創作者");
    }
    if (msg.includes("MUSIC_REMOVED")) {
      return jsonError(409, "MUSIC_REMOVED", "這首音樂已下架");
    }
    if (msg.includes("MUSIC_REJECTED") || msg.includes("MUSIC_MODERATION_PENDING")) {
      return jsonError(409, "MUSIC_MODERATION_FAILED", "moderation 未通過,無法公開");
    }
    console.error("[music/publish]", error);
    return jsonError(500, "PUBLISH_FAILED", "公開失敗");
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
