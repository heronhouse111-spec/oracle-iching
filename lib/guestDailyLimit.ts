/**
 * 訪客每日一卦 / 每日一卡 累計 3 天 fingerprint 限流(phase 36)
 *
 * 跟 lib/guestYesnoLimit.ts 同一套 fingerprint 模式,差別:
 *   - 上限 3 天 vs 10 天
 *   - 多 kind 維度區分易經/塔羅(各自獨立計算)
 *   - 訪客同日重抽仍允許(每日一卦 UX 就是同日看到同一張,擋住反而怪)
 *
 * 為什麼不直接整合進 guestYesnoLimit:RPC schema 不同(多了 p_kind),
 * 限流邏輯也微妙不同(同日重抽允許),分檔比較清晰。
 *
 * fingerprint 計算 reuse guestYesnoLimit.buildGuestFingerprint —
 * 同台裝置看 yesno + daily 是同一個 fingerprint,但兩個 log 表分開計算,
 * 互不影響。
 */

import { createAdminClient } from "@/lib/supabase/admin";

export const GUEST_DAILY_FREE_DAYS = 3;
export type GuestDailyKind = "iching" | "tarot";

export interface GuestDailyCheck {
  allowed: boolean;
  reason: "ok" | "limit_reached";
  daysRemaining: number;
  usedToday?: boolean;
}

/**
 * 嘗試消耗一次訪客每日卦/卡配額。
 * 同日重抽不消耗(回 allowed=true, daysRemaining 不變),
 * 跨日累計到 3 天後 allowed=false reason=limit_reached。
 * DB hiccup → fail-open。
 */
export async function tryConsumeGuestDaily(
  fingerprint: string,
  kind: GuestDailyKind
): Promise<GuestDailyCheck> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("try_consume_guest_daily", {
      p_fingerprint: fingerprint,
      p_kind: kind,
    });
    if (error) {
      console.error("[guestDailyLimit] try_consume failed", error);
      return { allowed: true, reason: "ok", daysRemaining: GUEST_DAILY_FREE_DAYS };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { allowed: true, reason: "ok", daysRemaining: GUEST_DAILY_FREE_DAYS };
    }
    return {
      allowed: Boolean(row.allowed),
      reason: (row.reason as "ok" | "limit_reached") ?? "ok",
      daysRemaining: row.days_remaining ?? 0,
    };
  } catch (e) {
    console.error("[guestDailyLimit] try_consume threw", e);
    return { allowed: true, reason: "ok", daysRemaining: GUEST_DAILY_FREE_DAYS };
  }
}

/** 純查詢 — 給 banner 用 */
export async function getGuestDailyStatus(
  fingerprint: string,
  kind: GuestDailyKind
): Promise<GuestDailyCheck> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_guest_daily_status", {
      p_fingerprint: fingerprint,
      p_kind: kind,
    });
    if (error) {
      console.error("[guestDailyLimit] get_status failed", error);
      return {
        allowed: true,
        reason: "ok",
        daysRemaining: GUEST_DAILY_FREE_DAYS,
        usedToday: false,
      };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        allowed: true,
        reason: "ok",
        daysRemaining: GUEST_DAILY_FREE_DAYS,
        usedToday: false,
      };
    }
    return {
      allowed: Boolean(row.allowed),
      reason: (row.reason as "ok" | "limit_reached") ?? "ok",
      daysRemaining: row.days_remaining ?? 0,
      usedToday: Boolean(row.used_today),
    };
  } catch (e) {
    console.error("[guestDailyLimit] get_status threw", e);
    return {
      allowed: true,
      reason: "ok",
      daysRemaining: GUEST_DAILY_FREE_DAYS,
      usedToday: false,
    };
  }
}
