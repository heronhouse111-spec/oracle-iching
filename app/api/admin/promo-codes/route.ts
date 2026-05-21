/**
 * GET  /api/admin/promo-codes — list 所有促銷碼(含 inactive、過期)
 * POST /api/admin/promo-codes — 建立新促銷碼
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscountType =
  | "percentage"
  | "fixed_amount"
  | "bonus_credits"
  | "free_period";

interface CreateBody {
  code?: string;
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  appliesTo?: string;            // 'all' / 'credit_pack' / 'subscription' / 'pack:pack_500'
  usageLimit?: number | null;
  perUserLimit?: number;
  startsAt?: string;
  expiresAt?: string | null;
  active?: boolean;
  notes?: string;
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({ codes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const errors: string[] = [];
  if (!body.code || !/^[A-Z0-9_-]{3,32}$/i.test(body.code))
    errors.push("code 必須 3-32 字英數/底線/破折號");
  if (
    !body.discountType ||
    !["percentage", "fixed_amount", "bonus_credits", "free_period"].includes(
      body.discountType,
    )
  )
    errors.push("discountType 必填");
  if (typeof body.discountValue !== "number" || body.discountValue < 0)
    errors.push("discountValue 必填且 ≥0");

  if (errors.length > 0)
    return NextResponse.json({ error: "validation", detail: errors }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .insert({
      code: body.code!.toUpperCase(),
      description: body.description ?? null,
      discount_type: body.discountType,
      discount_value: body.discountValue,
      applies_to: body.appliesTo ?? "all",
      usage_limit: body.usageLimit ?? null,
      per_user_limit: body.perUserLimit ?? 1,
      starts_at: body.startsAt ?? new Date().toISOString(),
      expires_at: body.expiresAt ?? null,
      active: body.active ?? true,
      notes: body.notes ?? null,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505")
      return NextResponse.json({ error: "duplicate_code", detail: `code "${body.code}" 已存在` }, { status: 409 });
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "promo_code.create",
    targetType: "promo_code",
    targetId: String(data.id),
    payload: body as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true, code: data });
}
