/**
 * GET /api/admin/pricing — 一次拉所有 credit_packs 跟 subscription_plans(含 inactive)
 */

import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const [packs, plans] = await Promise.all([
    supabase.from("credit_packs").select("*").order("display_order"),
    supabase.from("subscription_plans").select("*").order("display_order"),
  ]);

  return NextResponse.json({
    packs: packs.data ?? [],
    plans: plans.data ?? [],
  });
}
