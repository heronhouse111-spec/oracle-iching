/**
 * GET /api/pricing — public,回所有 active 的點數方案 + 訂閱方案
 *
 * 給 /account/credits 跟 /account/upgrade 等 client component fetch live pricing。
 * RLS 已限制只 active=true 給 anon/authenticated 看,所以這支是安全的。
 *
 * 60 秒 cache(改價後最久 60 秒生效)。
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET() {
  const supabase = await createClient();
  const [packs, plans] = await Promise.all([
    supabase
      .from("credit_packs")
      .select(
        "id, credits, bonus_credits, price_twd, price_usd, highlighted, display_order, zh_label, en_label",
      )
      .eq("active", true)
      .order("display_order"),
    supabase
      .from("subscription_plans")
      .select(
        "id, price_twd, price_usd, amortize_months, monthly_credits, highlighted, display_order, zh_label, en_label",
      )
      .eq("active", true)
      .order("display_order"),
  ]);

  return NextResponse.json({
    packs: packs.data ?? [],
    plans: plans.data ?? [],
  });
}
