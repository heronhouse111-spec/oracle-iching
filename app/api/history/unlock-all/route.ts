import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unlockHistoryForSubscriber } from "@/lib/historyUnlock";

/**
 * POST /api/history/unlock-all
 *
 * 訂閱戶開歷史頁時 client 自動 call(fire-and-forget)。
 * RPC 內部會檢查 is_active,非訂閱戶 call 也只回 0。
 *
 * 回傳:本次新解鎖筆數(可能為 0,代表早已 backfill 過或非訂閱戶)
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { newlyUnlocked: 0, error: "LOGIN_REQUIRED" },
        { status: 401 }
      );
    }

    const newlyUnlocked = await unlockHistoryForSubscriber(user.id);
    return NextResponse.json({ newlyUnlocked });
  } catch (e) {
    console.error("[history/unlock-all] unexpected:", e);
    return NextResponse.json(
      { newlyUnlocked: 0, error: "internal" },
      { status: 500 }
    );
  }
}
