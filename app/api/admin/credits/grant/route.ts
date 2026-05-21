/**
 * POST /api/admin/credits/grant
 *
 * Admin 手動補/扣點。可正可負。寫 admin_audit_log + credit_grants(後者由 RPC 自動寫)。
 *
 * Body:
 *   {
 *     userId: "uuid",
 *     delta: 500 | -100,
 *     reason: "退款補償:訂單 ORC..." (必填),
 *     relatedOrderMtn?: "ORC2026..."
 *   }
 *
 * Response:
 *   200 { ok: true, newBalance: 1234 }
 *   400 { error: "validation", detail: [...] }
 *   401 { error: "unauthorized" }
 *   403 { error: "forbidden" } (非 admin)
 *   500 { error: "rpc_error", detail }
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  userId?: string;
  delta?: number;
  reason?: string;
  relatedOrderMtn?: string;
}

export async function POST(req: NextRequest) {
  // -------- 1. Admin 驗證 --------
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  // -------- 2. Parse + validate --------
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const errors: string[] = [];
  if (!body.userId || typeof body.userId !== "string")
    errors.push("userId required (uuid string)");
  if (
    typeof body.delta !== "number" ||
    !Number.isInteger(body.delta) ||
    body.delta === 0
  )
    errors.push("delta required (non-zero integer)");
  if (typeof body.delta === "number" && Math.abs(body.delta) > 10000)
    errors.push("|delta| must be ≤ 10000 (safety bound)");
  if (!body.reason || body.reason.trim().length < 4)
    errors.push("reason required (≥ 4 chars)");

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "validation", detail: errors },
      { status: 400 },
    );
  }

  // -------- 3. 呼叫 admin_adjust_credits RPC --------
  const supabase = await createClient();
  const { data: newBalance, error } = await supabase.rpc(
    "admin_adjust_credits",
    {
      p_user_id: body.userId!,
      p_delta: body.delta!,
      p_reason: body.reason!,
      p_related_order_mtn: body.relatedOrderMtn ?? null,
    },
  );

  if (error) {
    console.error("[admin/credits/grant] RPC error:", error);
    return NextResponse.json(
      { error: "rpc_error", detail: error.message },
      { status: 500 },
    );
  }

  // -------- 4. Audit log --------
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "credits.grant",
    targetType: "user",
    targetId: body.userId,
    payload: {
      delta: body.delta,
      reason: body.reason,
      relatedOrderMtn: body.relatedOrderMtn,
      newBalance,
    },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    newBalance,
  });
}
