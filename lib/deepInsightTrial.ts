/**
 * Deep Insight 試用配額 — server-side wrapper
 *
 * 規則(phase 33):
 *   - 訂閱戶:Deep Insight 永久解鎖,不再加 +3 點(由 API route 在計費時 skip)
 *   - 免費用戶:每月 3 次免費試用,試用扣配額但不扣點
 *
 * 為什麼包成 helper:divine 跟 tarot 兩條 route 都要呼叫,
 * 把 RPC + console.error log 統一在這裡,API route 只看 boolean 回傳。
 */

import { createAdminClient } from "@/lib/supabase/admin";

export const FREE_DEEP_INSIGHT_TRIAL_LIMIT = 3;

/**
 * 嘗試消耗一次試用配額(原子操作,Postgres for update 保護)。
 *   回傳 true  → 允許 Deep Insight,已扣 1 次配額
 *   回傳 false → 配額用完(或 user 不存在),call 端應降級成 quick
 *
 * RPC 失敗(連線錯誤等)→ false + log;不 throw,讓占卜流程不要因為配額查詢崩掉。
 */
export async function consumeDeepInsightTrial(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("consume_deep_insight_trial", {
      p_user_id: userId,
    });
    if (error) {
      console.error("[deepInsightTrial] consume failed", { userId, error });
      return false;
    }
    return Boolean(data);
  } catch (e) {
    console.error("[deepInsightTrial] consume threw", e);
    return false;
  }
}

/**
 * 純讀取試用配額餘額(0..FREE_DEEP_INSIGHT_TRIAL_LIMIT)。
 * 給前端顯示「本月剩 X 次免費試用」用,不會扣配額。
 */
export async function getDeepInsightTrialBalance(userId: string): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_deep_insight_trial_balance", {
      p_user_id: userId,
    });
    if (error) {
      console.error("[deepInsightTrial] balance failed", { userId, error });
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (e) {
    console.error("[deepInsightTrial] balance threw", e);
    return 0;
  }
}
