/**
 * GET /api/account/has-purchased
 *
 * 給前端判斷是否要隱藏 firstTimeOnly 的 pack(例如 pack_100_starter)。
 *
 * 回傳:
 *   { authenticated: false }                       — 訪客(可看到首購包)
 *   { authenticated: true, hasPurchased: false }   — 登入但從未買過
 *   { authenticated: true, hasPurchased: true }    — 買過(隱藏首購包)
 *
 * 「買過」的定義 = credit_transactions 有任何一筆 reason in (
 *   'ecpay_purchase', 'play_billing_purchase', 'purchase_pack',
 *   'subscription_refill'
 * )。subscription 也算入,因為 starter pack 設計給「從未付費」的人。
 *
 * 安全:
 *   讀自己的 credit_transactions 用 user-scoped client(RLS 已限本人讀),
 *   不需要 admin client。後端 checkout 會再驗一次,前端隱藏只是 UX。
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PURCHASE_REASONS = [
  "ecpay_purchase",
  "play_billing_purchase",
  "purchase_pack",
  "subscription_refill",
];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  // 只要任一筆「付費類」交易存在即視為已付費
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("user_id", user.id)
    .in("reason", PURCHASE_REASONS)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[has-purchased] query failed:", error);
    // 失敗保守 → 視為已購買(避免漏發首購卡)
    return NextResponse.json({ authenticated: true, hasPurchased: true });
  }

  return NextResponse.json({
    authenticated: true,
    hasPurchased: data !== null,
  });
}
