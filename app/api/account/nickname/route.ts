import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateMusicText, moderationMessage } from "@/lib/music/moderation";

export const dynamic = "force-dynamic";

/**
 * POST /api/account/nickname
 * Body: { nickname: string }
 *
 * 改自己的暱稱(profiles.display_name)+ cascade 到過去所有
 * generated_music 的 creator_display_name(讓既有作品立即更新顯示名)。
 *
 * 沒設過暱稱的用戶,/account UI 會 fallback 顯示
 * Google name / email prefix(預設值,DB 仍是 null)。
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "LOGIN_REQUIRED", "Please sign in");
  }

  let body: { nickname?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_BODY", "Invalid JSON");
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  if (nickname.length < 1 || nickname.length > 30) {
    return jsonError(400, "INVALID_NICKNAME", "暱稱長度 1–30 字");
  }

  // 過 moderation(同音樂用同一套 blocklist + 可選 OpenAI)
  const mod = await moderateMusicText(nickname);
  if (!mod.allowed) {
    return jsonError(422, "MODERATION_BLOCKED", moderationMessage(mod, "zh"));
  }

  const admin = createAdminClient();
  const { error: profErr } = await admin
    .from("profiles")
    .update({ display_name: nickname, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (profErr) {
    console.error("[account/nickname]", profErr);
    return jsonError(500, "UPDATE_FAILED", profErr.message);
  }

  // Cascade:過去所有自己創作的音樂,creator_display_name 跟著更新
  // (snapshot 設計本來不更新,但 UX 上用戶改名後過去作品也想看到新名)
  await admin
    .from("generated_music")
    .update({ creator_display_name: nickname })
    .eq("creator_id", user.id);

  return new Response(JSON.stringify({ success: true, nickname }), {
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
