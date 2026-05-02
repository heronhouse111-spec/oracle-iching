/**
 * PUT /api/admin/users/[id]/subscription
 *
 * Admin 直接變更使用者訂閱狀態。
 *
 * Body:
 *   {
 *     action: "activate" | "cancel" | "expire" | "clear",
 *     plan?: "monthly" | "yearly" | "lifetime",   // activate 必填
 *     expiresAt?: string (ISO),                    // activate 必填;cancel 可改;expire/clear 忽略
 *     reason: string (≥4 字)
 *   }
 *
 * 行為:
 *   activate:status=active,寫入 plan / started_at / expires_at,並 insert 一筆 subscriptions(provider=manual)
 *   cancel:  status=canceled,保留 plan / expires_at(到期前仍視為有效),記 canceled_at
 *   expire:  status=expired,expires_at=now()(立即失效)
 *   clear:   status=free,清空所有訂閱欄位(視為從未訂閱過)
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

type Action = "activate" | "cancel" | "expire" | "clear";
type Plan = "monthly" | "yearly" | "lifetime";

const VALID_ACTIONS: Action[] = ["activate", "cancel", "expire", "clear"];
const VALID_PLANS: Plan[] = ["monthly", "yearly", "lifetime"];

interface Body {
  action?: string;
  plan?: string;
  expiresAt?: string | null;
  reason?: string;
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const action = body.action as Action | undefined;
  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: "validation", detail: `action 必須是 ${VALID_ACTIONS.join(" / ")}` },
      { status: 400 },
    );
  }

  const reason = (body.reason ?? "").toString().trim();
  if (reason.length < 4) {
    return NextResponse.json(
      { error: "validation", detail: "reason 至少 4 字" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // 取得目前訂閱狀態(方便 audit + cancel/expire 時保留 plan)
  const { data: before } = await supabase
    .from("profiles")
    .select(
      "subscription_status, subscription_plan, subscription_started_at, subscription_expires_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const nowIso = new Date().toISOString();

  // 依 action 計算要寫入 profiles 的值
  let nextStatus: "free" | "active" | "canceled" | "expired";
  let nextPlan: Plan | null;
  let nextStartedAt: string | null;
  let nextExpiresAt: string | null;

  if (action === "activate") {
    const plan = body.plan as Plan | undefined;
    if (!plan || !VALID_PLANS.includes(plan)) {
      return NextResponse.json(
        { error: "validation", detail: `plan 必須是 ${VALID_PLANS.join(" / ")}` },
        { status: 400 },
      );
    }
    if (!body.expiresAt) {
      return NextResponse.json(
        { error: "validation", detail: "啟用訂閱必須指定 expiresAt" },
        { status: 400 },
      );
    }
    const exp = new Date(body.expiresAt);
    if (Number.isNaN(exp.getTime())) {
      return NextResponse.json(
        { error: "validation", detail: "expiresAt 不是合法 ISO 時間" },
        { status: 400 },
      );
    }
    if (exp.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "validation", detail: "expiresAt 必須是未來時間" },
        { status: 400 },
      );
    }
    nextStatus = "active";
    nextPlan = plan;
    nextStartedAt = before.subscription_started_at ?? nowIso;
    nextExpiresAt = exp.toISOString();
  } else if (action === "cancel") {
    if (
      before.subscription_status !== "active" &&
      before.subscription_status !== "canceled"
    ) {
      return NextResponse.json(
        { error: "invalid_state", detail: "只能取消 active / canceled 訂閱" },
        { status: 400 },
      );
    }
    // 可選改 expiresAt(例如延長 / 縮短保留期),沒給就保留原值
    let exp = before.subscription_expires_at;
    if (body.expiresAt) {
      const d = new Date(body.expiresAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "validation", detail: "expiresAt 不是合法 ISO 時間" },
          { status: 400 },
        );
      }
      exp = d.toISOString();
    }
    nextStatus = "canceled";
    nextPlan = (before.subscription_plan as Plan | null) ?? null;
    nextStartedAt = before.subscription_started_at ?? null;
    nextExpiresAt = exp;
  } else if (action === "expire") {
    nextStatus = "expired";
    nextPlan = (before.subscription_plan as Plan | null) ?? null;
    nextStartedAt = before.subscription_started_at ?? null;
    nextExpiresAt = nowIso;
  } else {
    // clear
    nextStatus = "free";
    nextPlan = null;
    nextStartedAt = null;
    nextExpiresAt = null;
  }

  const { error: updErr } = await supabase
    .from("profiles")
    .update({
      subscription_status: nextStatus,
      subscription_plan: nextPlan,
      subscription_started_at: nextStartedAt,
      subscription_expires_at: nextExpiresAt,
    })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json(
      { error: "db_error", detail: updErr.message },
      { status: 500 },
    );
  }

  // 寫 subscriptions 歷程 — 留下 manual 操作軌跡
  // 使用 actor.id + 時間戳組成 provider_txn_id,避免重複
  const manualTxnId = `admin:${actor.id}:${Date.now()}`;
  const subRow: {
    user_id: string;
    plan: Plan;
    status: "active" | "canceled" | "expired";
    provider: "manual";
    provider_txn_id: string;
    amount: number;
    currency: string;
    started_at: string | null;
    expires_at: string | null;
    canceled_at: string | null;
    raw_payload: Record<string, unknown>;
  } | null =
    action === "clear"
      ? null
      : {
          user_id: id,
          plan: (nextPlan ?? (before.subscription_plan as Plan | null) ?? "monthly") as Plan,
          status:
            action === "activate"
              ? "active"
              : action === "cancel"
                ? "canceled"
                : "expired",
          provider: "manual",
          provider_txn_id: manualTxnId,
          amount: 0,
          currency: "TWD",
          started_at: nextStartedAt,
          expires_at: nextExpiresAt,
          canceled_at: action === "cancel" ? nowIso : null,
          raw_payload: {
            source: "admin_panel",
            actor_id: actor.id,
            actor_email: actor.email,
            reason,
            before: {
              status: before.subscription_status,
              plan: before.subscription_plan,
              expires_at: before.subscription_expires_at,
            },
          },
        };

  if (subRow) {
    const { error: insErr } = await supabase.from("subscriptions").insert(subRow);
    if (insErr) {
      // 不擋住主流程,但要 log
      console.error("[admin/subscription] subscriptions insert failed:", insErr.message);
    }
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: `user.subscription.${action}`,
    targetType: "user",
    targetId: id,
    payload: {
      reason,
      before: {
        status: before.subscription_status,
        plan: before.subscription_plan,
        expires_at: before.subscription_expires_at,
      },
      after: {
        status: nextStatus,
        plan: nextPlan,
        expires_at: nextExpiresAt,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    subscription: {
      status: nextStatus,
      plan: nextPlan,
      started_at: nextStartedAt,
      expires_at: nextExpiresAt,
    },
  });
}
