/**
 * POST /api/billing/play/verify-purchase
 *
 * 用途:
 *   TWA 殼內的 Play Billing 購買成功後,前端拿到 purchaseToken,
 *   打這支 endpoint 做後端「真實驗證」,確認:
 *     1. token 真的是 Google 簽出來的(防偽造)
 *     2. 確實是這個 user 在這個 SKU 完成的購買
 *     3. 還沒被處理過(idempotency)
 *   驗證通過後:
 *     - consumable: 補點(add_credits RPC) + 在 Google 端 consume
 *     - subscription: 更新 profiles.subscription_* + 寫 subscriptions 歷程表
 *
 * 為什麼客戶端拿到 token 還要打後端再驗一次:
 *   token 在 client 端可以被偽造/replay。Google 文件強烈建議 server-to-server 驗證。
 *
 * 安全:
 *   - 必須登入(Supabase auth.getUser())
 *   - 用 service_role 寫 play_purchases / profiles(繞過 RLS)
 *   - GCP_SERVICE_ACCOUNT_JSON 是 server-only env var
 *
 * 失敗處理:
 *   client 端應該 retry。我們會把 status='failed' 寫進 play_purchases,
 *   下次同一個 token 進來看到 failed 不會直接 short-circuit,而是重跑驗證。
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PLAY_PACKAGE_NAME,
  SKU_CREDITS_GRANTED,
  SKU_TO_SUBSCRIPTION_PLAN,
  isCreditPackSku,
  isSubscriptionSku,
} from "@/lib/billing/playSkus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------- 輸入型別 ----------
interface VerifyBody {
  sku?: string;
  purchaseToken?: string;
}

// ---------- 取 GCP service account JSON ----------
function getServiceAccountCredentials() {
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "[play/verify] 缺少 GCP_SERVICE_ACCOUNT_JSON env var。請去 GCP Console 建 service account 拿 JSON,把整段(含換行 \\n)塞進 env"
    );
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `[play/verify] GCP_SERVICE_ACCOUNT_JSON 不是合法 JSON: ${e instanceof Error ? e.message : e}`
    );
  }
}

async function getAndroidPublisher() {
  const credentials = getServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  return google.androidpublisher({ version: "v3", auth });
}

// ---------- Main handler ----------
export async function POST(req: NextRequest) {
  // -------- 1. 認證 --------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // -------- 2. Parse + validate --------
  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { sku, purchaseToken } = body;
  if (!sku || !purchaseToken) {
    return NextResponse.json(
      { error: "missing_fields", required: ["sku", "purchaseToken"] },
      { status: 400 }
    );
  }

  if (!isCreditPackSku(sku) && !isSubscriptionSku(sku)) {
    return NextResponse.json(
      { error: "unknown_sku", sku },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // -------- 3. Idempotency check --------
  const { data: existing } = await admin
    .from("play_purchases")
    .select("id, status, user_id, credits_granted, subscription_plan")
    .eq("purchase_token", purchaseToken)
    .maybeSingle();

  if (existing) {
    // 已經結算過 → 直接回成功(不再重複補點)
    if (existing.status === "granted") {
      return NextResponse.json({
        ok: true,
        alreadyGranted: true,
        creditsGranted: existing.credits_granted ?? null,
        subscriptionPlan: existing.subscription_plan ?? null,
      });
    }
    // 不同 user 拿同一 token → 拒絕
    if (existing.user_id !== user.id) {
      console.warn("[play/verify] token reuse across users", {
        token: purchaseToken,
        existingUser: existing.user_id,
        attemptUser: user.id,
      });
      return NextResponse.json(
        { error: "token_already_used_by_other_user" },
        { status: 409 }
      );
    }
    // status=pending/failed 繼續走下面驗證流程,結束時 update 同一 row
  }

  // -------- 4. 跟 Google Play Developer API 驗證 --------
  let publisher;
  try {
    publisher = await getAndroidPublisher();
  } catch (e) {
    console.error("[play/verify] GCP credentials init failed", e);
    return NextResponse.json(
      { error: "server_misconfigured", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  // ============================================
  // 4A. Subscription 路徑
  // ============================================
  if (isSubscriptionSku(sku)) {
    let subInfo;
    try {
      const res = await publisher.purchases.subscriptions.get({
        packageName: PLAY_PACKAGE_NAME,
        subscriptionId: sku,
        token: purchaseToken,
      });
      subInfo = res.data;
    } catch (e) {
      console.error("[play/verify] subscriptions.get failed", e);
      await upsertFailed(admin, {
        userId: user.id,
        sku,
        purchaseToken,
        productType: "subscription",
        reason: e instanceof Error ? e.message : String(e),
      });
      return NextResponse.json(
        { error: "google_verify_failed", detail: e instanceof Error ? e.message : String(e) },
        { status: 502 }
      );
    }

    // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = pending deferred upgrade/downgrade
    if (subInfo.paymentState !== 1 && subInfo.paymentState !== 2) {
      await upsertFailed(admin, {
        userId: user.id,
        sku,
        purchaseToken,
        productType: "subscription",
        reason: `paymentState=${subInfo.paymentState}`,
        raw: subInfo,
      });
      return NextResponse.json(
        { error: "payment_not_received", paymentState: subInfo.paymentState },
        { status: 400 }
      );
    }

    const planId = SKU_TO_SUBSCRIPTION_PLAN[sku];
    const expiryMillis = Number(subInfo.expiryTimeMillis ?? 0);
    const expiresAt = expiryMillis > 0 ? new Date(expiryMillis).toISOString() : null;
    const startedAt = subInfo.startTimeMillis
      ? new Date(Number(subInfo.startTimeMillis)).toISOString()
      : new Date().toISOString();

    // -------- 4A.1 更新 profiles 訂閱欄位 --------
    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        subscription_status: "active",
        subscription_plan: planId,
        subscription_started_at: startedAt,
        subscription_expires_at: expiresAt,
      })
      .eq("id", user.id);

    if (profileErr) {
      console.error("[play/verify] profile update failed", profileErr);
      return NextResponse.json(
        { error: "profile_update_failed", detail: profileErr.message },
        { status: 500 }
      );
    }

    // -------- 4A.2 寫 subscriptions 歷程表 --------
    await admin.from("subscriptions").insert({
      user_id: user.id,
      plan: planId,
      status: "active",
      provider: "google_play",
      provider_txn_id: subInfo.orderId ?? null,
      provider_subscription_id: purchaseToken,
      amount: 0, // Play 端我們抓不到 TWD 金額(Google 是 micros + currency),先 0,raw_payload 有完整資料
      currency: subInfo.priceCurrencyCode ?? "TWD",
      started_at: startedAt,
      expires_at: expiresAt,
      raw_payload: subInfo as never,
    });

    // -------- 4A.3 acknowledge(避免 3 天後 Google 自動退款) --------
    if (subInfo.acknowledgementState === 0) {
      try {
        await publisher.purchases.subscriptions.acknowledge({
          packageName: PLAY_PACKAGE_NAME,
          subscriptionId: sku,
          token: purchaseToken,
        });
      } catch (e) {
        console.warn("[play/verify] acknowledge failed (non-fatal)", e);
      }
    }

    // -------- 4A.4 寫 play_purchases idempotency row --------
    await admin
      .from("play_purchases")
      .upsert(
        {
          user_id: user.id,
          sku,
          purchase_token: purchaseToken,
          order_id: subInfo.orderId ?? null,
          product_type: "subscription",
          status: "granted",
          subscription_plan: planId,
          subscription_expires_at: expiresAt,
          raw_purchase: subInfo as never,
          acknowledged_at: new Date().toISOString(),
        },
        { onConflict: "purchase_token" }
      );

    return NextResponse.json({
      ok: true,
      type: "subscription",
      plan: planId,
      expiresAt,
    });
  }

  // ============================================
  // 4B. Consumable(點數包)路徑
  // ============================================
  let productInfo;
  try {
    const res = await publisher.purchases.products.get({
      packageName: PLAY_PACKAGE_NAME,
      productId: sku,
      token: purchaseToken,
    });
    productInfo = res.data;
  } catch (e) {
    console.error("[play/verify] products.get failed", e);
    await upsertFailed(admin, {
      userId: user.id,
      sku,
      purchaseToken,
      productType: "consumable",
      reason: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "google_verify_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
  if (productInfo.purchaseState !== 0) {
    await upsertFailed(admin, {
      userId: user.id,
      sku,
      purchaseToken,
      productType: "consumable",
      reason: `purchaseState=${productInfo.purchaseState}`,
      raw: productInfo,
    });
    return NextResponse.json(
      { error: "purchase_state_invalid", purchaseState: productInfo.purchaseState },
      { status: 400 }
    );
  }

  const credits = SKU_CREDITS_GRANTED[sku];
  if (!credits) {
    return NextResponse.json(
      { error: "sku_credits_not_configured", sku },
      { status: 500 }
    );
  }

  // -------- 4B.1 補點(走既有 add_credits RPC) --------
  const { error: creditErr } = await admin.rpc("add_credits", {
    p_user_id: user.id,
    p_amount: credits,
    p_reason: "play_billing_purchase",
    p_reference_id: null,
    p_metadata: {
      sku,
      purchase_token: purchaseToken,
      order_id: productInfo.orderId,
    },
  });

  if (creditErr) {
    console.error("[play/verify] add_credits failed", creditErr);
    return NextResponse.json(
      { error: "credit_grant_failed", detail: creditErr.message },
      { status: 500 }
    );
  }

  // -------- 4B.2 acknowledge + consume --------
  // consumable 商品要 consume 才能再次購買;不 consume 的話 Google 會視為已擁有,擋掉再次購買
  try {
    await publisher.purchases.products.acknowledge({
      packageName: PLAY_PACKAGE_NAME,
      productId: sku,
      token: purchaseToken,
    });
  } catch (e) {
    console.warn("[play/verify] product acknowledge failed (non-fatal)", e);
  }
  try {
    await publisher.purchases.products.consume({
      packageName: PLAY_PACKAGE_NAME,
      productId: sku,
      token: purchaseToken,
    });
  } catch (e) {
    console.warn("[play/verify] product consume failed", e);
    // 這個比較重要,但已經補點了,不能 rollback。記下來等人工處理
  }

  // -------- 4B.3 寫 play_purchases --------
  await admin
    .from("play_purchases")
    .upsert(
      {
        user_id: user.id,
        sku,
        purchase_token: purchaseToken,
        order_id: productInfo.orderId ?? null,
        product_type: "consumable",
        status: "granted",
        credits_granted: credits,
        raw_purchase: productInfo as never,
        acknowledged_at: new Date().toISOString(),
        consumed_at: new Date().toISOString(),
      },
      { onConflict: "purchase_token" }
    );

  return NextResponse.json({
    ok: true,
    type: "consumable",
    creditsGranted: credits,
  });
}

// ---------- helper ----------
async function upsertFailed(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    userId: string;
    sku: string;
    purchaseToken: string;
    productType: "consumable" | "subscription";
    reason: string;
    raw?: unknown;
  }
) {
  await admin
    .from("play_purchases")
    .upsert(
      {
        user_id: args.userId,
        sku: args.sku,
        purchase_token: args.purchaseToken,
        product_type: args.productType,
        status: "failed",
        status_reason: args.reason.slice(0, 500),
        raw_purchase: (args.raw ?? null) as never,
      },
      { onConflict: "purchase_token" }
    );
}
