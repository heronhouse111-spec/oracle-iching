import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGuestFingerprint } from "@/lib/guestYesnoLimit";
import {
  getGuestDailyStatus,
  GUEST_DAILY_FREE_DAYS,
  type GuestDailyKind,
} from "@/lib/guestDailyLimit";

/**
 * GET /api/daily/guest-status?kind=iching|tarot
 *
 * 給訪客每日一卦/卡 banner 顯示用。
 *
 * Response shape:
 *   { authenticated: bool, allowed, reason, daysRemaining, usedToday, limit }
 *
 * 已登入會員 → allowed=true daysRemaining=limit(banner 不顯示)
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const kindParam = url.searchParams.get("kind");
    const kind: GuestDailyKind =
      kindParam === "tarot" ? "tarot" : "iching";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return NextResponse.json({
        authenticated: true,
        allowed: true,
        reason: "ok",
        daysRemaining: GUEST_DAILY_FREE_DAYS,
        usedToday: false,
        limit: GUEST_DAILY_FREE_DAYS,
        kind,
      });
    }

    const fp = buildGuestFingerprint(request.headers);
    const status = await getGuestDailyStatus(fp, kind);
    return NextResponse.json({
      authenticated: false,
      ...status,
      limit: GUEST_DAILY_FREE_DAYS,
      kind,
    });
  } catch (e) {
    console.error("[daily/guest-status] unexpected:", e);
    return NextResponse.json(
      {
        authenticated: false,
        allowed: true,
        reason: "ok",
        daysRemaining: GUEST_DAILY_FREE_DAYS,
        usedToday: false,
        limit: GUEST_DAILY_FREE_DAYS,
        error: "internal",
      },
      { status: 500 }
    );
  }
}
