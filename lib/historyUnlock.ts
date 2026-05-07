/**
 * 歷史解鎖 — server helpers(phase 34)
 *
 * 設計:
 *   - 訂閱戶開歷史頁時 server 自動把該 user 全部 divinations upsert 到 history_unlocks
 *   - 退訂後仍可看「曾在訂閱期內被解鎖過的紀錄」(永久)
 *   - 非訂閱戶 + 非解鎖紀錄 + 超過 10 天 → 鎖
 *
 * 10 天 / paywall 的時間判斷在 history page 前端做(用 record.created_at)。
 * 這支只負責「訂閱戶 → 寫 unlocks」這一步。
 */

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 把 user 全部 divinations 標記為已解鎖(僅限 active 訂閱戶)。
 * RPC 內部判斷,非訂閱戶 call 也只會回 0。
 *
 * 回傳:本次新增多少筆 unlocks(之前已解鎖的不重複算)
 */
export async function unlockHistoryForSubscriber(userId: string): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("unlock_history_for_subscriber", {
      p_user_id: userId,
    });
    if (error) {
      console.error("[historyUnlock] unlock failed", { userId, error });
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (e) {
    console.error("[historyUnlock] unlock threw", e);
    return 0;
  }
}

/** Paywall 設計:登入戶 10 天內紀錄全免 + 訂閱期內看過的永久解鎖 */
export const FREE_HISTORY_WINDOW_DAYS = 10;
