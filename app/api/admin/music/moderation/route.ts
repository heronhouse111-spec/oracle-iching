import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/music/moderation
 *   回傳所有 flagged 歌(自動或手動標)+ 檢舉紀錄,讓 admin 一頁處理完。
 *
 * POST /api/admin/music/moderation
 *   Body: { musicId, decision: 'approve' | 'takedown', reason?: string }
 *   - approve  → 還原 moderation_status='approved',pending reports 全部
 *                改成 'reviewed_no_action'
 *   - takedown → 呼叫 takedown_music_by_moderation() — 會退所有買家 + 沒收
 *                創作者已賺、把 moderation_status='rejected' visibility=
 *                'removed_by_moderation',並把 pending reports 全部改成 'removed'
 */

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  // 1. flagged 歌
  const { data: flagged, error: flaggedErr } = await admin
    .from("generated_music")
    .select(
      "id, title, creator_id, creator_display_name, prompt, category_id, storage_path, duration_seconds, visibility, moderation_status, moderation_notes, collect_count, creator_earnings_total, published_at, created_at",
    )
    .eq("moderation_status", "flagged")
    .order("published_at", { ascending: false });

  if (flaggedErr) {
    return NextResponse.json(
      { error: "db_error", detail: flaggedErr.message },
      { status: 500 },
    );
  }

  const flaggedTracks = flagged ?? [];
  const flaggedIds = flaggedTracks.map((t) => t.id);

  // 2. 對應的 reports(只取 pending 的給 admin 看)
  let reportsByMusic: Record<string, unknown[]> = {};
  if (flaggedIds.length > 0) {
    const { data: reports } = await admin
      .from("music_reports")
      .select("id, music_id, reporter_id, reason, notes, status, created_at")
      .in("music_id", flaggedIds)
      .order("created_at", { ascending: false });

    reportsByMusic = (reports ?? []).reduce(
      (acc, r) => {
        const key = r.music_id as string;
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      },
      {} as Record<string, unknown[]>,
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const enriched = flaggedTracks.map((t) => ({
    ...t,
    audio_url: `${supabaseUrl}/storage/v1/object/public/app-music/${t.storage_path}`,
    reports: reportsByMusic[t.id] ?? [],
  }));

  return NextResponse.json({ flagged: enriched });
}

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  let body: { musicId?: string; decision?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const musicId = typeof body.musicId === "string" ? body.musicId : "";
  const decision = body.decision;
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

  if (!musicId.match(/^[0-9a-f-]{36}$/i)) {
    return NextResponse.json({ error: "invalid_music_id" }, { status: 400 });
  }
  if (decision !== "approve" && decision !== "takedown") {
    return NextResponse.json(
      { error: "invalid_decision", detail: "decision must be approve | takedown" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  if (decision === "approve") {
    // 還原 moderation_status
    const { error: updErr } = await admin
      .from("generated_music")
      .update({ moderation_status: "approved", moderation_notes: null })
      .eq("id", musicId);
    if (updErr) {
      return NextResponse.json(
        { error: "db_error", detail: updErr.message },
        { status: 500 },
      );
    }
    // pending reports → reviewed_no_action
    await admin
      .from("music_reports")
      .update({
        status: "reviewed_no_action",
        reviewed_by: actor.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("music_id", musicId)
      .eq("status", "pending");

    await writeAuditLog({
      actorId: actor.id,
      actorEmail: actor.email ?? "",
      action: "music.moderation.approve",
      targetType: "generated_music",
      targetId: musicId,
      payload: { reason },
    });

    return NextResponse.json({ success: true, decision: "approve" });
  }

  // takedown — 呼叫 SQL function 內部會做退款 + 沒收 + 標記
  const { data, error: rpcErr } = await admin.rpc(
    "takedown_music_by_moderation",
    {
      p_admin_id: actor.id,
      p_music_id: musicId,
      p_reason: reason ?? "moderation_violation",
    },
  );

  if (rpcErr) {
    if (rpcErr.message?.includes("NOT_ADMIN")) {
      return NextResponse.json({ error: "not_admin" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "rpc_error", detail: rpcErr.message },
      { status: 500 },
    );
  }

  // pending reports → removed
  await admin
    .from("music_reports")
    .update({
      status: "removed",
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("music_id", musicId)
    .eq("status", "pending");

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email ?? "",
    action: "music.moderation.takedown",
    targetType: "generated_music",
    targetId: musicId,
    payload: {
      reason,
      ...(typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}),
    },
  });

  return NextResponse.json({ success: true, decision: "takedown", result: data });
}
