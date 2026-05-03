import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const VALID_REASONS = [
  "inappropriate",
  "spam",
  "copyright",
  "low_quality",
  "other",
] as const;

const AUTO_FLAG_THRESHOLD = 3;

/**
 * POST /api/music/report
 * Body: { musicId, reason, notes? }
 *
 * 用戶檢舉公開的歌。同一個用戶對同一首歌一天只能檢舉一次(防灌水)。
 * 累計到 AUTO_FLAG_THRESHOLD 筆(3 筆)pending 報告 → 自動把
 * generated_music.moderation_status 改 'flagged',admin 後台看得到。
 *
 * 注意:auto-flag 不會立刻下架,只是標記等審核。實際下架要 admin 在
 * 後台呼叫 takedown_music_by_moderation(),會退所有買家 + 沒收創作者收益。
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "LOGIN_REQUIRED", "Please sign in");
  }

  let body: { musicId?: unknown; reason?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_BODY", "Invalid JSON");
  }

  const musicId = typeof body.musicId === "string" ? body.musicId : "";
  const reason = typeof body.reason === "string" ? body.reason : "";
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 500) : null;

  if (!musicId.match(/^[0-9a-f-]{36}$/i)) {
    return jsonError(400, "INVALID_MUSIC_ID", "Invalid musicId");
  }
  if (!VALID_REASONS.includes(reason as (typeof VALID_REASONS)[number])) {
    return jsonError(400, "INVALID_REASON", `Reason must be one of: ${VALID_REASONS.join(", ")}`);
  }

  const admin = createAdminClient();

  // 確認歌存在 + 是 public 才能被檢舉
  const { data: track } = await admin
    .from("generated_music")
    .select("id, visibility, creator_id")
    .eq("id", musicId)
    .maybeSingle();

  if (!track) {
    return jsonError(404, "MUSIC_NOT_FOUND", "找不到這首音樂");
  }
  if (track.visibility !== "public") {
    return jsonError(409, "MUSIC_NOT_PUBLIC", "這首音樂不是公開狀態");
  }
  if (track.creator_id === user.id) {
    return jsonError(403, "CANNOT_REPORT_OWN", "不能檢舉自己的音樂");
  }

  // 防止同 user 對同首歌 24h 內重複檢舉
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("music_reports")
    .select("id")
    .eq("music_id", musicId)
    .eq("reporter_id", user.id)
    .gte("created_at", oneDayAgo)
    .maybeSingle();

  if (recent) {
    return jsonError(429, "ALREADY_REPORTED", "你最近 24 小時已檢舉過這首歌");
  }

  // 寫檢舉
  const { error: insertErr } = await admin.from("music_reports").insert({
    music_id: musicId,
    reporter_id: user.id,
    reason,
    notes,
    status: "pending",
  });
  if (insertErr) {
    console.error("[music/report] insert failed:", insertErr);
    return jsonError(500, "REPORT_FAILED", "檢舉失敗");
  }

  // 看是否要 auto-flag
  const { count } = await admin
    .from("music_reports")
    .select("id", { count: "exact", head: true })
    .eq("music_id", musicId)
    .eq("status", "pending");

  let autoFlagged = false;
  if ((count ?? 0) >= AUTO_FLAG_THRESHOLD) {
    const { error: flagErr } = await admin
      .from("generated_music")
      .update({ moderation_status: "flagged" })
      .eq("id", musicId)
      .eq("moderation_status", "approved"); // 只把 approved → flagged,不覆蓋已 rejected
    if (!flagErr) autoFlagged = true;
  }

  return new Response(
    JSON.stringify({
      success: true,
      pendingReports: count ?? 1,
      autoFlagged,
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
