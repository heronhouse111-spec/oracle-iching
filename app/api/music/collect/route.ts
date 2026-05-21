import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/music/collect
 * Body: { musicId: string }
 *
 * 永久收藏一首他人的音樂(20 點 / 訂閱戶 16 點)。
 * 點數 + 分潤 + 收藏寫入全部在 collect_music() RPC 裡 atomic 完成。
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
  const { data, error } = await admin.rpc("collect_music", {
    p_user_id: user.id,
    p_music_id: musicId,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("MUSIC_NOT_FOUND")) {
      return jsonError(404, "MUSIC_NOT_FOUND", "找不到這首音樂");
    }
    if (msg.includes("MUSIC_NOT_PUBLIC") || msg.includes("MUSIC_NOT_APPROVED")) {
      return jsonError(409, "MUSIC_NOT_AVAILABLE", "這首音樂無法收藏");
    }
    if (msg.includes("MUSIC_IS_FREE")) {
      return jsonError(409, "MUSIC_IS_FREE", "免費音樂不需收藏,可直接播放");
    }
    if (msg.includes("CANNOT_COLLECT_OWN_MUSIC")) {
      return jsonError(403, "CANNOT_COLLECT_OWN", "不能收藏自己的音樂");
    }
    if (msg.includes("ALREADY_COLLECTED")) {
      return jsonError(409, "ALREADY_COLLECTED", "你已經收藏過這首音樂");
    }
    if (msg.includes("INSUFFICIENT_CREDITS")) {
      // collect_music 內部呼叫 spend_credits 會 raise INSUFFICIENT_CREDITS
      return jsonError(402, "INSUFFICIENT_CREDITS", "點數不足", { required: 20 });
    }
    console.error("[music/collect]", error);
    return jsonError(500, "COLLECT_FAILED", "收藏失敗");
  }

  return new Response(JSON.stringify({ success: true, ...(data ?? {}) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify({ error: code, message, ...extra }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
