/**
 * POST /api/billing/ecpay/checkout
 *
 * 流程:
 *   1. 驗使用者登入(Supabase auth)
 *   2. 依 packId / planId 從 lib/pricing.ts 取金額 + 商品名
 *   3. 產 MerchantTradeNo(ORC + yyyyMMdd + 6 字隨機),確保 < 20 字
 *   4. POST 到 hub /api/orders/create 登記訂單(含 service_callback_url 給 hub 通知)
 *   5. 回傳 hub checkout 頁的 URL,前端 window.location.assign 過去
 *
 * 為什麼不直接前端跳 hub:
 *   - HUB_INTERNAL_API_TOKEN 是 server-only secret,不能放前端
 *   - 必須由我們的 server 用 token 去登記訂單後,user 才能跳 hub 看 checkout 頁
 *
 * Body:
 *   { kind: "credits", packId: "pack_200" }
 *   或
 *   { kind: "subscription", planId: "monthly" | "yearly" }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  type CreditPackId,
  type SubscriptionPlanId,
} from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HUB_BASE_URL = process.env.HUB_PUBLIC_URL ?? "https://pay.heronhouse.me";
const SERVICE_CODE = "ORC"; // oracle-iching 的服務前綴

interface CheckoutBody {
  kind?: "credits" | "subscription";
  packId?: CreditPackId;
  planId?: SubscriptionPlanId;
  /** 客戶選的發票類型(b2c / b2c_carrier / b2b / donate),預設 b2c */
  invoiceKind?: "b2c" | "b2c_carrier" | "b2b" | "donate";
  carrierNum?: string;
  customerIdentifier?: string;
  invoiceTitle?: string;
  loveCode?: string;
  /** 客戶名(B2C 跟 B2B 都用得到) */
  customerName?: string;
}

export async function POST(req: NextRequest) {
  // -------- 1. 驗使用者 --------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 從 supabase auth 抓 email(發票需要)
  const userEmail = user.email;
  if (!userEmail) {
    return NextResponse.json(
      { error: "no_email", detail: "登入帳號沒有 email,無法開立發票" },
      { status: 400 },
    );
  }

  // -------- 2. Parse body --------
  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // -------- 3. 取金額 + 商品名 --------
  let amount: number;
  let itemName: string;
  let isRecurring = false;
  let periodAmount: number | undefined;
  let periodType: "M" | "Y" | undefined;
  let frequency: number | undefined;
  let execTimes: number | undefined;

  if (body.kind === "credits") {
    if (!body.packId) {
      return NextResponse.json(
        { error: "validation", detail: "credits 需要 packId" },
        { status: 400 },
      );
    }
    const pack = CREDIT_PACKS.find((p) => p.id === body.packId);
    if (!pack) {
      return NextResponse.json(
        { error: "validation", detail: `未知 packId: ${body.packId}` },
        { status: 400 },
      );
    }
    amount = pack.price.TWD;
    const total = pack.credits + pack.bonusCredits;
    itemName = `易問 ${total} 點`;
  } else if (body.kind === "subscription") {
    if (!body.planId) {
      return NextResponse.json(
        { error: "validation", detail: "subscription 需要 planId" },
        { status: 400 },
      );
    }
    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === body.planId);
    if (!plan) {
      return NextResponse.json(
        { error: "validation", detail: `未知 planId: ${body.planId}` },
        { status: 400 },
      );
    }
    amount = plan.price.TWD;
    isRecurring = true;
    periodAmount = plan.price.TWD;
    if (body.planId === "monthly") {
      periodType = "M";
      frequency = 1;
      execTimes = 99; // 上限,直到使用者取消
      // ⚠ 不要用全形括號 ( )!綠界定期定額 server 對 ItemName 做字元過濾
      // 後再算 hash,跟我們算的對不上會噴 CheckMacValue Error。改用簡單字元。
      itemName = "易問月會員";
    } else if (body.planId === "yearly") {
      periodType = "Y";
      frequency = 1;
      execTimes = 9; // 綠界年扣最多 9 期
      itemName = "易問年會員";
    } else {
      return NextResponse.json(
        { error: "validation", detail: `${body.planId} 不支援網頁訂閱(只有 monthly / yearly)` },
        { status: 400 },
      );
    }
  } else {
    return NextResponse.json(
      { error: "validation", detail: "kind 必須是 credits 或 subscription" },
      { status: 400 },
    );
  }

  // -------- 4. 產 MerchantTradeNo --------
  const yyyymmdd = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const random = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();
  const merchantTradeNo = `${SERVICE_CODE}${yyyymmdd}${random}`;
  // ORC + 8 + 6 = 17 字,< 20 字限制 ✓

  // -------- 5. 打 hub /api/orders/create --------
  const hubToken = process.env.HUB_INTERNAL_API_TOKEN;
  if (!hubToken) {
    console.error("[ecpay/checkout] 缺 HUB_INTERNAL_API_TOKEN");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // service callback URL —— hub 付款 + 發票完成後會 POST 到這
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oracle.heronhouse.me";
  const callbackUrl = `${baseUrl}/api/billing/ecpay/granted`;

  const orderPayload = {
    merchantTradeNo,
    serviceCode: SERVICE_CODE,
    amount,
    itemName,
    customerEmail: userEmail,
    customerName: body.customerName ?? null,
    invoiceKind: body.invoiceKind ?? "b2c",
    carrierNum: body.carrierNum,
    customerIdentifier: body.customerIdentifier,
    invoiceTitle: body.invoiceTitle,
    loveCode: body.loveCode,
    metadata: {
      kind: body.kind,
      packId: body.packId ?? null,
      planId: body.planId ?? null,
    },
    isRecurring,
    periodAmount,
    periodType,
    frequency,
    execTimes,
    serviceCallbackUrl: callbackUrl,
    serviceUserId: user.id, // Supabase auth.users.id
  };

  try {
    const res = await fetch(`${HUB_BASE_URL}/api/orders/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hubToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[ecpay/checkout] hub /api/orders/create failed", {
        status: res.status,
        err,
      });
      return NextResponse.json(
        { error: "hub_register_failed", detail: err },
        { status: 502 },
      );
    }

    const { merchantTradeNo: confirmedMtn } = (await res.json()) as {
      id: string;
      merchantTradeNo: string;
    };

    // -------- 6. 組 hub checkout URL,帶 returnUrl 讓使用者付完跳回我們 --------
    const successQuery = new URLSearchParams({
      returnUrl: `${baseUrl}/account?payment=success`,
      returnLabel: "返回 易問",
    });
    const checkoutUrl = `${HUB_BASE_URL}/payment/checkout/${encodeURIComponent(confirmedMtn)}?${successQuery.toString()}`;

    return NextResponse.json({
      ok: true,
      checkoutUrl,
      merchantTradeNo: confirmedMtn,
    });
  } catch (e) {
    console.error("[ecpay/checkout] hub fetch threw", e);
    return NextResponse.json(
      { error: "hub_unreachable", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
