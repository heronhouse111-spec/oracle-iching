import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildGuestFingerprint,
  getGuestYesnoStatus,
  GUEST_YESNO_FREE_DAYS,
} from "@/lib/guestYesnoLimit";

/**
 * GET /api/yesno/guest-status
 *
 * 給訪客 yesno 兩頁 banner 顯示用。回傳當前 fingerprint 的限流狀態。
 *
 * Response shape:
 *   未登入(訪客)→
 *     { authenticated: false, allowed, reason, daysRemaining, usedToday, limit }
 *   已登入(會員)→
 *     { authenticated: true, allowed: true, reason: "ok", daysRemaining: limit }
 *     (會員不受限,banner 不顯示;但仍回完整 shape 讓 client 不用做特殊處理)
 *
 * 注意:此 endpoint 是純查詢,不消耗配額。實際扣除由 /api/yesno 與
 * /api/iching/yesno 在 fetch 時 server-side 處理。
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return NextResponse.json({
        authenticated: true,
        allowed: true,
        reason: "ok",
        daysRemaining: GUEST_YESNO_FREE_DAYS,
        usedToday: false,
        limit: GUEST_YESNO_FREE_DAYS,
      });
    }

    const fp = buildGuestFingerprint(request.headers);
    const status = await getGuestYesnoStatus(fp);
    return NextResponse.json({
      authenticated: false,
      ...status,
      limit: GUEST_YESNO_FREE_DAYS,
    });
  } catch (e) {
    console.error("[yesno/guest-status] unexpected:", e);
    return NextResponse.json(
      {
        authenticated: false,
        allowed: true,
        reason: "ok",
        daysRemaining: GUEST_YESNO_FREE_DAYS,
        usedToday: false,
        limit: GUEST_YESNO_FREE_DAYS,
        error: "internal",
      },
      { status: 500 }
    );
  }
}
