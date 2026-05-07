import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimDailyCheckin } from "@/lib/dailyCheckin";

/**
 * POST /api/daily-checkin/claim
 *
 * 登入用戶領取今日簽到。第一次領 → ok:true;今日已領過 → ok:false。
 * 領取後該 user 今日做 yes/no 不扣點(一次)。
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "LOGIN_REQUIRED" },
        { status: 401 }
      );
    }

    const claimed = await claimDailyCheckin(user.id);
    return NextResponse.json({
      ok: claimed,
      reason: claimed ? null : "ALREADY_CLAIMED_TODAY",
    });
  } catch (e) {
    console.error("[daily-checkin/claim] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500 }
    );
  }
}
