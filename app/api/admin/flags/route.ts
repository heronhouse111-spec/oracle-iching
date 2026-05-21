/**
 * GET /api/admin/flags — 列所有 feature flag
 * PATCH /api/admin/flags — 更新一個 flag(body: { key, enabled?, description?, payload? })
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .order("key", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ flags: data ?? [] });
}

interface PatchBody {
  key?: string;
  enabled?: boolean;
  description?: string;
  payload?: Record<string, unknown>;
}

export async function PATCH(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.key) {
    return NextResponse.json({ error: "validation", detail: "key required" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_by: actor.id };
  if (body.enabled !== undefined) update.enabled = body.enabled;
  if (body.description !== undefined) update.description = body.description;
  if (body.payload !== undefined) update.payload = body.payload;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_flags")
    .update(update)
    .eq("key", body.key)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "not_found", detail: `flag ${body.key} not found` }, { status: 404 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "flag.update",
    targetType: "flag",
    targetId: body.key,
    payload: body as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true, flag: data });
}
