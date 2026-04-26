/**
 * POST /api/admin/users/[id]/ban — body: { reason }
 * DELETE /api/admin/users/[id]/ban — 解封
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const reason = (body.reason ?? "").toString().trim();
  if (reason.length < 4) {
    return NextResponse.json({ error: "validation", detail: "reason 至少 4 字" }, { status: 400 });
  }

  // 不能 ban admin(避免互鎖)
  const supabase = createAdminClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (target?.role && target.role !== "user") {
    return NextResponse.json(
      { error: "cannot_ban_admin", detail: "不能封鎖具 admin/support 角色的帳號,請先把他們降級" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      banned: true,
      banned_reason: reason,
      banned_at: new Date().toISOString(),
      banned_by: actor.id,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.ban",
    targetType: "user",
    targetId: id,
    payload: { reason },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      banned: false,
      banned_reason: null,
      banned_at: null,
      banned_by: null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.unban",
    targetType: "user",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
