/**
 * POST /api/billing/ecpay/cancel-subscription
 *
 * 使用者在 /account 頁按「取消訂閱」時呼叫。
 * 流程:
 *   1. 確認登入 + 確認有 active recurring 訂閱
 *   2. 撈使用者 active 訂閱(找出 provider_subscription_id = PeriodGwsr)
 *   3. POST 到 hub /api/subscriptions/ecpay/cancel(帶 mtn 跟 PeriodGwsr)
 *   4. hub call ECPay CreditCardPeriodAction Action="Cancel"
 *   5. 標記 profiles.subscription_status = 'canceled'
 *      (注意:使用者「目前已付的期限」內仍視為有效訂閱戶,
 *       has_active_subscription() 會回 true,直到 expires_at)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HUB_BASE_URL =
  process.env.HUB_PUBLIC_URL ?? "https://pay.heronhouse.me";

export async function POST() {
  // -------- 1. 認證 --------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // -------- 2. 找最新一筆 active ecpay 訂閱 --------
  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select(
      "id, provider, provider_txn_id, provider_subscription_id, status, plan",
    )
    .eq("user_id", user.id)
    .eq("provider", "ecpay")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr) {
    console.error("[cancel] subscriptions read failed", subErr);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!sub) {
    return NextResponse.json(
      { error: "no_active_subscription", detail: "找不到有效的綠界訂閱" },
      { status: 404 },
    );
  }

  if (!sub.provider_subscription_id) {
    // PeriodGwsr 沒寫進來 → 訂閱是用舊架構建的,沒辦法呼叫綠界取消 API
    console.warn("[cancel] subscription 缺 provider_subscription_id (PeriodGwsr)", {
      subId: sub.id,
    });
    // 仍然把 profile 標記成 canceled,人工去綠界後台手動關
    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({ subscription_status: "canceled" })
      .eq("id", user.id);
    await admin.from("subscriptions").update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    }).eq("id", sub.id);

    return NextResponse.json({
      ok: true,
      manualNeeded: true,
      detail:
        "本筆訂閱缺 PeriodGwsr,Profile 已標記為 canceled,但綠界後台需要手動停扣",
    });
  }

  // -------- 3. 打 hub /api/subscriptions/ecpay/cancel --------
  const hubToken = process.env.HUB_INTERNAL_API_TOKEN;
  if (!hubToken) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }

  let hubRes: Response;
  try {
    hubRes = await fetch(
      `${HUB_BASE_URL}/api/subscriptions/ecpay/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          merchantTradeNo: sub.provider_txn_id,
          periodGwsr: sub.provider_subscription_id,
          reason: "user_request_cancel",
        }),
      },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: "hub_unreachable",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  if (!hubRes.ok) {
    const err = await hubRes.json().catch(() => ({}));
    console.error("[cancel] hub returned non-ok", { status: hubRes.status, err });
    return NextResponse.json(
      { error: "hub_error", detail: err },
      { status: 502 },
    );
  }

  // -------- 4. 標記 profile + subscriptions 為 canceled --------
  // 注意:不改 subscription_expires_at,讓使用者用到原本期限結束
  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ subscription_status: "canceled" })
    .eq("id", user.id);

  await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  return NextResponse.json({
    ok: true,
    detail: "已停止下期續扣;會員權益維持到目前期限結束",
  });
}
