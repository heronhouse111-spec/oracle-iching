import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDailyCheckinStatus } from "@/lib/dailyCheckin";

/**
 * GET /api/daily-checkin/status
 *
 * 回今日簽到狀態給 DailyCheckInBanner 顯示。
 *
 * Response shape:
 *   未登入 → { authenticated: false, claimed: false, used: false }
 *   登入   → { authenticated: true,  claimed: bool,   used: bool }
 *
 *   claimed=false        → banner 顯示「領取每日免費 yes/no」
 *   claimed=true,used=false → banner 顯示「已領取,立即占卜」
 *   claimed=true,used=true  → banner 顯示「明天再來」(灰)
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
        claimed: false,
        used: false,
      });
    }

    const status = await getDailyCheckinStatus(user.id);
    return NextResponse.json({
      authenticated: true,
      ...status,
    });
  } catch (e) {
    console.error("[daily-checkin/status] unexpected:", e);
    return NextResponse.json(
      { authenticated: false, claimed: false, used: false, error: "internal" },
      { status: 500 }
    );
  }
}
