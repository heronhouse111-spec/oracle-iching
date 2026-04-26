/**
 * PATCH /api/admin/pricing/credit-packs/[id] — 更新單一加購方案
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
  credits?: number;
  bonus_credits?: number;
  price_twd?: number;
  price_usd?: number | null;
  highlighted?: boolean;
  active?: boolean;
  display_order?: number;
  zh_label?: string;
  en_label?: string;
  play_sku_id?: string;
  notes?: string;
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

  const supabase = await createClient();

  // 拉舊值給 audit log
  const { data: before } = await supabase
    .from("credit_packs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("credit_packs")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "pricing.credit_pack.update",
    targetType: "credit_pack",
    targetId: id,
    payload: { before, after: data, changes: body },
  });

  return NextResponse.json({ ok: true, pack: data });
}
