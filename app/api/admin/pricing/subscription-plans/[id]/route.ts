/**
 * PATCH /api/admin/pricing/subscription-plans/[id] — 更新單一訂閱方案
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
  price_twd?: number;
  price_usd?: number | null;
  amortize_months?: number;
  monthly_credits?: number;
  highlighted?: boolean;
  active?: boolean;
  display_order?: number;
  zh_label?: string;
  en_label?: string;
  play_sku_id?: string;
  ecpay_period_type?: "M" | "Y";
  ecpay_frequency?: number;
  ecpay_exec_times?: number;
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

  const { data: before } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("subscription_plans")
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
    action: "pricing.subscription_plan.update",
    targetType: "subscription_plan",
    targetId: id,
    payload: { before, after: data, changes: body },
  });

  return NextResponse.json({ ok: true, plan: data });
}
