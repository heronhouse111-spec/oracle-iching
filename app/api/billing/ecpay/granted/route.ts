/**
 * POST /api/billing/ecpay/granted
 *
 * 收 hub (pay.heronhouse.me) 在 ECPay 付款 + 發票成功後的 callback。
 * 在這裡做業務邏輯:
 *   - credits:用 add_credits RPC 補點
 *   - subscription:更新 profiles.subscription_*,寫 subscriptions 歷程
 *
 * 認證:
 *   Authorization: Bearer <HUB_INTERNAL_API_TOKEN>
 *   跟 hub 那邊同一個 secret(我們是同一個 org)。
 *
 * 輸入(hub 傳來):
 *   {
 *     merchantTradeNo: "ORC...",
 *     serviceCode: "ORC",
 *     serviceUserId: "<auth.users.id>",
 *     amount: 60,
 *     itemName: "易問 200 點",
 *     isRecurring: false,
 *     ecpayTradeNo: "...",
 *     paymentDate: "2026-04-26T08:00:00Z",
 *     periodGwsr: "12345678" | null
 *   }
 *
 * Idempotency:
 *   credit_transactions table 用 reference_id 去重。
 *   subscriptions table 用 (provider='ecpay', provider_txn_id) 去重。
 *   重複的 callback 不會重複補點 / 重複啟用訂閱。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  type CreditPackId,
  type SubscriptionPlanId,
} from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GrantedBody {
  merchantTradeNo?: string;
  serviceCode?: string;
  serviceUserId?: string;
  amount?: number;
  itemName?: string;
  isRecurring?: boolean;
  ecpayTradeNo?: string | null;
  paymentDate?: string | null;
  periodGwsr?: string | null;
}

export async function POST(req: NextRequest) {
  // -------- 1. 認證 --------
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.HUB_INTERNAL_API_TOKEN;
  if (!expected) {
    console.error("[granted] 缺 HUB_INTERNAL_API_TOKEN");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // -------- 2. Parse --------
  let body: GrantedBody;
  try {
    body = (await req.json()) as GrantedBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.merchantTradeNo || !body.serviceUserId) {
    return NextResponse.json(
      { error: "missing_fields", required: ["merchantTradeNo", "serviceUserId"] },
      { status: 400 },
    );
  }

  // -------- 3. 撈 hub 那邊的訂單 metadata 取 packId / planId --------
  // hub 沒把 metadata 放進 callback payload(避免太大),
  // 我們有 merchantTradeNo,直接從訂單號 prefix + amount + itemName 推:
  //   不過更安全是讓 hub 傳 metadata。這裡以 itemName 做關鍵字比對。
  // 為了簡化,我們把點數 / 訂閱判斷邏輯放這:
  const admin = createAdminClient();

  // -------- 4. credits 路徑 --------
  if (!body.isRecurring) {
    // 點數包:從 itemName 反推 packId(易問 200 點 → pack_200)
    const pack = inferCreditPack(body.itemName ?? "", body.amount ?? 0);
    if (!pack) {
      console.warn("[granted] 無法從 itemName 反推 pack", {
        mtn: body.merchantTradeNo,
        itemName: body.itemName,
      });
      return NextResponse.json(
        { error: "unknown_pack", detail: "itemName 對不到任何 CREDIT_PACKS" },
        { status: 400 },
      );
    }

    const credits = pack.credits + pack.bonusCredits;

    // 用 reference_id = merchantTradeNo 防重複補點
    // (credit_transactions table 沒有 unique constraint 在 reference_id,
    //  我們先 select 看是否已存在)
    const { data: existing } = await admin
      .from("credit_transactions")
      .select("id")
      .eq("metadata->>merchant_trade_no", body.merchantTradeNo)
      .maybeSingle();

    if (existing) {
      console.log("[granted] credits 已補過,idempotent skip", {
        mtn: body.merchantTradeNo,
      });
      return NextResponse.json({ ok: true, alreadyGranted: true });
    }

    const { error: rpcErr } = await admin.rpc("add_credits", {
      p_user_id: body.serviceUserId,
      p_amount: credits,
      p_reason: "ecpay_purchase",
      p_reference_id: null,
      p_metadata: {
        merchant_trade_no: body.merchantTradeNo,
        ecpay_trade_no: body.ecpayTradeNo,
        pack_id: pack.id,
        amount_twd: body.amount,
      },
    });

    if (rpcErr) {
      console.error("[granted] add_credits failed", rpcErr);
      return NextResponse.json(
        { error: "credit_grant_failed", detail: rpcErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      type: "credits",
      packId: pack.id,
      creditsGranted: credits,
    });
  }

  // -------- 5. subscription 路徑 --------
  const plan = inferSubscriptionPlan(body.itemName ?? "", body.amount ?? 0);
  if (!plan) {
    console.warn("[granted] 無法從 itemName 反推 plan", {
      mtn: body.merchantTradeNo,
      itemName: body.itemName,
    });
    return NextResponse.json(
      { error: "unknown_plan", detail: "itemName 對不到任何 SUBSCRIPTION_PLANS" },
      { status: 400 },
    );
  }

  // 計算到期日
  const startedAt = body.paymentDate ?? new Date().toISOString();
  const expiresAt = computeExpiresAt(plan.id, startedAt);

  // 更新 profiles
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      subscription_status: "active",
      subscription_plan: plan.id,
      subscription_started_at: startedAt,
      subscription_expires_at: expiresAt,
    })
    .eq("id", body.serviceUserId);

  if (profileErr) {
    console.error("[granted] profile update failed", profileErr);
    return NextResponse.json(
      { error: "profile_update_failed", detail: profileErr.message },
      { status: 500 },
    );
  }

  // 寫 subscriptions 歷程(idempotent: provider_txn_id = merchantTradeNo)
  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("provider", "ecpay")
    .eq("provider_txn_id", body.merchantTradeNo)
    .maybeSingle();

  if (!existingSub) {
    await admin.from("subscriptions").insert({
      user_id: body.serviceUserId,
      plan: plan.id,
      status: "active",
      provider: "ecpay",
      provider_txn_id: body.merchantTradeNo,
      provider_subscription_id: body.periodGwsr ?? null,
      amount: body.amount ?? plan.price.TWD,
      currency: "TWD",
      started_at: startedAt,
      expires_at: expiresAt,
      raw_payload: { from: "hub_callback", body } as never,
    });
  }

  return NextResponse.json({
    ok: true,
    type: "subscription",
    planId: plan.id,
    expiresAt,
    periodGwsr: body.periodGwsr ?? null,
  });
}

// ---------- helpers ----------

function inferCreditPack(itemName: string, amount: number) {
  // 先從 itemName 試,失敗再從金額對
  for (const p of CREDIT_PACKS) {
    const total = p.credits + p.bonusCredits;
    if (
      itemName.includes(`${total} 點`) ||
      itemName.includes(`${p.credits} 點`)
    ) {
      return p;
    }
  }
  return CREDIT_PACKS.find((p) => p.price.TWD === amount) ?? null;
}

function inferSubscriptionPlan(itemName: string, amount: number) {
  if (itemName.includes("月") || itemName.toLowerCase().includes("monthly")) {
    return SUBSCRIPTION_PLANS.find((p) => p.id === "monthly");
  }
  if (itemName.includes("年") || itemName.toLowerCase().includes("yearly")) {
    return SUBSCRIPTION_PLANS.find((p) => p.id === "yearly");
  }
  return SUBSCRIPTION_PLANS.find((p) => p.price.TWD === amount) ?? null;
}

function computeExpiresAt(planId: SubscriptionPlanId, startedAtIso: string): string {
  const start = new Date(startedAtIso);
  const end = new Date(start);
  if (planId === "monthly") {
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else if (planId === "yearly") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  }
  // 加 12 小時 buffer 避免時區邊界讓使用者看到「過期 1 秒前」
  end.setUTCHours(end.getUTCHours() + 12);
  return end.toISOString();
}
