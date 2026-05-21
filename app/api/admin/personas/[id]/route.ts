/**
 * PATCH  /api/admin/personas/[id] — 編輯 persona(任何欄位)
 * DELETE /api/admin/personas/[id] — 刪除 persona
 *
 * 注意:刪除 persona 不會自動清掉 storage 上對應的圖片(避免誤刪共用圖)。
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

interface PatchBody {
  system?: "iching" | "tarot" | "any";
  tier?: "free" | "premium";
  active?: boolean;
  sortOrder?: number;
  emoji?: string | null;
  imageUrl?: string | null;
  nameZh?: string;
  nameEn?: string;
  nameJa?: string | null;
  nameKo?: string | null;
  taglineZh?: string;
  taglineEn?: string;
  taglineJa?: string | null;
  taglineKo?: string | null;
  promptZh?: string;
  promptEn?: string;
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

  // camelCase → snake_case
  const update: Record<string, unknown> = {};
  if (body.system !== undefined) update.system = body.system;
  if (body.tier !== undefined) update.tier = body.tier;
  if (body.active !== undefined) update.active = body.active;
  if (body.sortOrder !== undefined) update.sort_order = body.sortOrder;
  if (body.emoji !== undefined) update.emoji = body.emoji;
  if (body.imageUrl !== undefined) update.image_url = body.imageUrl;
  if (body.nameZh !== undefined) update.name_zh = body.nameZh;
  if (body.nameEn !== undefined) update.name_en = body.nameEn;
  if (body.nameJa !== undefined) update.name_ja = body.nameJa;
  if (body.nameKo !== undefined) update.name_ko = body.nameKo;
  if (body.taglineZh !== undefined) update.tagline_zh = body.taglineZh;
  if (body.taglineEn !== undefined) update.tagline_en = body.taglineEn;
  if (body.taglineJa !== undefined) update.tagline_ja = body.taglineJa;
  if (body.taglineKo !== undefined) update.tagline_ko = body.taglineKo;
  if (body.promptZh !== undefined) update.prompt_zh = body.promptZh;
  if (body.promptEn !== undefined) update.prompt_en = body.promptEn;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "validation", detail: "no fields" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("personas")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "persona.update",
    targetType: "persona",
    targetId: id,
    payload: body as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true, persona: data });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  const supabase = createAdminClient();
  const { error } = await supabase.from("personas").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "persona.delete",
    targetType: "persona",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
