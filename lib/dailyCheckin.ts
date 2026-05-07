/**
 * 每日簽到 — server helpers(phase 34)
 *
 * 規則:
 *   - 登入用戶每日(Asia/Taipei)可簽到 1 次,獲得 1 個免費 yes/no token
 *   - 該 token 由 /api/yesno 在扣點前自動消耗,免費用戶不扣 2 點
 *   - 訂閱戶也可以簽到(因為他們也會用 yes/no,雖然原本就有 600 點)
 *
 * 為什麼用 RPC 不直接查表:扣點 / 領取 / 消耗都需要原子性 + service_role 寫入,
 * 跟 lib/credits.ts 同樣模式。
 */

import { createAdminClient } from "@/lib/supabase/admin";

/** 嘗試領取今日簽到。true=領取成功(第一次),false=今日已領 */
export async function claimDailyCheckin(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("claim_daily_checkin", {
      p_user_id: userId,
    });
    if (error) {
      console.error("[dailyCheckin] claim failed", { userId, error });
      return false;
    }
    return Boolean(data);
  } catch (e) {
    console.error("[dailyCheckin] claim threw", e);
    return false;
  }
}

/**
 * /api/yesno 在扣點前 call:
 *   true  → 用戶今日有未消耗的 token,已扣掉(yes/no 不扣點)
 *   false → 沒簽到 / 已用過(yes/no 走正常扣點)
 */
export async function consumeDailyYesno(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("consume_daily_yesno", {
      p_user_id: userId,
    });
    if (error) {
      console.error("[dailyCheckin] consume failed", { userId, error });
      return false;
    }
    return Boolean(data);
  } catch (e) {
    console.error("[dailyCheckin] consume threw", e);
    return false;
  }
}

export interface DailyCheckinStatus {
  claimed: boolean;
  used: boolean;
}

/** 給前端 banner 顯示用 */
export async function getDailyCheckinStatus(userId: string): Promise<DailyCheckinStatus> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_daily_checkin_status", {
      p_user_id: userId,
    });
    if (error) {
      console.error("[dailyCheckin] status failed", { userId, error });
      return { claimed: false, used: false };
    }
    // RPC 回 setof,supabase-js 會包成 array
    const row = Array.isArray(data) ? data[0] : data;
    return {
      claimed: Boolean(row?.claimed),
      used: Boolean(row?.used),
    };
  } catch (e) {
    console.error("[dailyCheckin] status threw", e);
    return { claimed: false, used: false };
  }
}
