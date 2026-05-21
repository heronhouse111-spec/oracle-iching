/**
 * PATCH/DELETE /api/admin/promo-codes/[id]
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

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // 把 camelCase keys 對應 DB
  const allowed = [
    "code",
    "description",
    "discount_type",
    "discount_value",
    "applies_to",
    "usage_limit",
    "per_user_limit",
    "starts_at",
    "expires_at",
    "active",
    "notes",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  // also accept camelCase
  if ("discountType" in body) update.discount_type = body.discountType;
  if ("discountValue" in body) update.discount_value = body.discountValue;
  if ("appliesTo" in body) update.applies_to = body.appliesTo;
  if ("usageLimit" in body) update.usage_limit = body.usageLimit;
  if ("perUserLimit" in body) update.per_user_limit = body.perUserLimit;
  if ("startsAt" in body) update.starts_at = body.startsAt;
  if ("expiresAt" in body) update.expires_at = body.expiresAt;

  if (typeof update.code === "string") update.code = update.code.toUpperCase();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .update(update)
    .eq("id", parseInt(id, 10))
    .select()
    .single();

  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "promo_code.update",
    targetType: "promo_code",
    targetId: id,
    payload: update,
  });
  return NextResponse.json({ ok: true, code: data });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { error } = await supabase
    .from("promo_codes")
    .delete()
    .eq("id", parseInt(id, 10));
  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "promo_code.delete",
    targetType: "promo_code",
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
