import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FREE_DEEP_INSIGHT_TRIAL_LIMIT,
  getDeepInsightTrialBalance,
} from "@/lib/deepInsightTrial";

/**
 * GET /api/deep-insight/trial-status
 *
 * 回傳當前使用者的 Deep Insight 試用配額狀態,給 PersonaDepthPicker 顯示
 *   「本月剩 X 次免費試用」用。
 *
 * 回應 shape:
 *   {
 *     authenticated: boolean,
 *     isSubscriber : boolean,   // 訂閱戶不受配額限制
 *     limit        : number,    // 每月上限(=FREE_DEEP_INSIGHT_TRIAL_LIMIT)
 *     remaining    : number,    // 0..limit
 *   }
 *
 * 未登入 / 訂閱戶 limit 仍會帶,前端依 isSubscriber 決定要顯示「✦ 訂閱專屬」
 * 還是「✨ 免費試用 X / 3」。
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        isSubscriber: false,
        limit: FREE_DEEP_INSIGHT_TRIAL_LIMIT,
        remaining: 0,
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();

    const isSubscriber = Boolean(profile?.is_active);

    // 訂閱戶不需要查 RPC — 配額對他們不適用
    if (isSubscriber) {
      return NextResponse.json({
        authenticated: true,
        isSubscriber: true,
        limit: FREE_DEEP_INSIGHT_TRIAL_LIMIT,
        remaining: FREE_DEEP_INSIGHT_TRIAL_LIMIT,
      });
    }

    const remaining = await getDeepInsightTrialBalance(user.id);
    return NextResponse.json({
      authenticated: true,
      isSubscriber: false,
      limit: FREE_DEEP_INSIGHT_TRIAL_LIMIT,
      remaining,
    });
  } catch (e) {
    console.error("[deep-insight/trial-status] unexpected:", e);
    return NextResponse.json(
      {
        authenticated: false,
        isSubscriber: false,
        limit: FREE_DEEP_INSIGHT_TRIAL_LIMIT,
        remaining: 0,
        error: "internal",
      },
      { status: 500 }
    );
  }
}
