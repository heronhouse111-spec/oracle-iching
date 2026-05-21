/**
 * PUT /api/admin/users/[id]/role — body: { role: 'user' | 'support' | 'admin' | 'super_admin' }
 *
 * **只有 super_admin 能改 role**(防 admin 互相鬥權)。
 * 不能把自己降級(避免無 super_admin 的情況)。
 */

import { NextRequest, NextResponse } from "next/server";
import { assertRole, type AdminRole } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_ROLES: AdminRole[] = ["user", "support", "admin", "super_admin"];

export async function PUT(req: NextRequest, ctx: RouteContext) {
  // 必須是 super_admin
  const auth = await assertRole("super_admin");
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { role?: string };
  if (!body.role || !VALID_ROLES.includes(body.role as AdminRole)) {
    return NextResponse.json(
      { error: "validation", detail: `role 必須是 ${VALID_ROLES.join(" / ")}` },
      { status: 400 },
    );
  }

  // 防自降:不能把自己降級
  if (id === actor.id && body.role !== "super_admin") {
    return NextResponse.json(
      { error: "self_demotion", detail: "無法降低自己的角色等級。請先請另一位 super_admin 操作" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: before } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", id)
    .maybeSingle();

  // is_admin 同步:role >= admin → is_admin = true
  const isAdminFlag =
    body.role === "admin" || body.role === "super_admin";

  const { error } = await supabase
    .from("profiles")
    .update({ role: body.role, is_admin: isAdminFlag })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.role.update",
    targetType: "user",
    targetId: id,
    payload: {
      from_role: before?.role,
      to_role: body.role,
    },
  });

  return NextResponse.json({ ok: true });
}
