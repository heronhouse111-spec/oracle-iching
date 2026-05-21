/**
 * PATCH /api/admin/announcements/[id] — 更新公告(任何欄位)
 * DELETE /api/admin/announcements/[id] — 刪除公告(實際刪;若想保留 audit 軌跡可改成 active=false)
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface PatchBody {
  zhText?: string | null;
  enText?: string | null;
  linkUrl?: string | null;
  severity?: "info" | "warn" | "critical";
  startsAt?: string;
  endsAt?: string | null;
  active?: boolean;
  displayOrder?: number;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 把 camelCase 轉 snake_case 給 DB
  const update: Record<string, unknown> = {};
  if (body.zhText !== undefined) update.zh_text = body.zhText;
  if (body.enText !== undefined) update.en_text = body.enText;
  if (body.linkUrl !== undefined) update.link_url = body.linkUrl;
  if (body.severity !== undefined) update.severity = body.severity;
  if (body.startsAt !== undefined) update.starts_at = body.startsAt;
  if (body.endsAt !== undefined) update.ends_at = body.endsAt;
  if (body.active !== undefined) update.active = body.active;
  if (body.displayOrder !== undefined) update.display_order = body.displayOrder;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .update(update)
    .eq("id", parseInt(id, 10))
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "announcement.update",
    targetType: "announcement",
    targetId: id,
    payload: body as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true, announcement: data });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", parseInt(id, 10));

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "announcement.delete",
    targetType: "announcement",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
