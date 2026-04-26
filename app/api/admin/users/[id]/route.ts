/**
 * GET /api/admin/users/[id]
 *
 * Admin 取得單一 user 完整資料:
 *   - profile(餘額、訂閱狀態、is_admin)
 *   - 訂閱(subscriptions table)
 *   - 近期占卜(divinations,最新 20 筆)
 *   - 補/扣點記錄(credit_grants,最新 20 筆)
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  const supabase = await createClient();

  // 平行抓 4 個資料源
  const [profileResult, userResult, divinationsResult, grantsResult] =
    await Promise.all([
      supabase
        .from("admin_users_view")
        .select(
          "id, email, signed_up_at, last_sign_in_at, display_name, preferred_locale, is_admin",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("credits_balance, credits_refills_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("divinations")
        .select(
          "id, question, category, hexagram_number, locale, divine_type, created_at",
        )
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("credit_grants")
        .select(
          "id, delta, balance_after, reason, granted_by_email, related_order_mtn, created_at",
        )
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (!profileResult.data) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // 訂閱單獨拉(可能沒有訂閱)
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, started_at, expires_at, provider, is_active")
    .eq("user_id", id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    profile: {
      ...profileResult.data,
      credits_balance: userResult.data?.credits_balance ?? 0,
      credits_refills_at: userResult.data?.credits_refills_at ?? null,
    },
    subscription: subscription ?? null,
    divinations: divinationsResult.data ?? [],
    grants: grantsResult.data ?? [],
  });
}
