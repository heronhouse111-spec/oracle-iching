/**
 * 點數系統 - 後端 wrapper
 *
 * 所有點數操作(扣/加/退)一律透過 SERVICE_ROLE admin client 呼叫
 * phase5_credits.sql 定義的 Postgres function。好處:
 *   - 流水 insert 到 credit_transactions(使用者 RLS 不能寫)
 *   - 扣點原子性由 SQL 側保證(UPDATE ... WHERE balance >= amount)
 *   - 使用者即使知道 function 名稱也無法從前端直接亂扣
 *
 * 使用原則:
 *   - API route 拿到 auth.getUser() 驗證身份後,再把 user.id 傳進來
 *   - 絕對不可以信任前端傳來的 user_id
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ──────────────────────────────────────────
// 價目表 — 之後想改費用來這裡改就好
// ──────────────────────────────────────────
export const CREDIT_COSTS = {
  /** 一次完整的易經占卜(含 AI 解說) */
  DIVINE: 5,
  /** 一次三張牌塔羅占卜(含 AI 解說) */
  TAROT: 5,
  /** 接續前一次占卜的衍伸占卜 — 成本較高(要讀前文脈絡 + 給更長回覆) */
  DIVINE_FOLLOWUP: 10,
  TAROT_FOLLOWUP: 10,
  /** 跟老師的一則追問對話 */
  CHAT: 1,
  /** Yes/No 一張牌占卜 — 輕量入口。原 1 點,phase 21 漲到 2 點:
   *  (1) 1 點實際接近 token 成本邊際虧本
   *  (2) 「Yes/No 不算收集」之後仍要避免被當免費快速答題機 */
  YESNO: 2,
  /** 每日一卡 — 每天 1 點當回訪鉤子(同 user 同日重抽走 cache 不再扣) */
  DAILY: 1,
  /** 多牌陣加價(牌數 × 解讀深度) — 愛情十字 5 卡 / 凱爾特十字 10 卡 / 年度 12 卡 */
  TAROT_5_CARD: 8,
  TAROT_10_CARD: 12,
  TAROT_12_CARD: 14,
  /** Deep Insight 模式加成(訂閱戶才能用,免費版鎖在 Quick) */
  DEEP_INSIGHT_SURCHARGE: 3,
  /** 方位卦象合參 — 兩段式占法(羅盤方位 + 完整六爻),含 AI 合參解讀。
   *  比一般 DIVINE 多一段卜方位的解讀,但又比 DIVINE_FOLLOWUP 簡單,定 6 點。 */
  DIRECTION_HEX: 6,
  /** 梅花易數 — 時間起卦不擲錢,但仍是完整六爻 + AI 解卦,跟 DIVINE 同價。 */
  PLUM_BLOSSOM: 5,
} as const;

export type CreditReason =
  | "spend_divine"
  | "spend_divine_followup"
  | "spend_tarot"
  | "spend_tarot_followup"
  | "spend_chat"
  | "spend_yesno"
  | "spend_daily"
  | "spend_direction_hex"
  | "spend_plum_blossom"
  | "refund_api_error"
  | "signup_bonus"
  | "onboarding_bonus"
  | "subscription_refill"
  | "purchase_pack"
  | "ad_reward";

export class InsufficientCreditsError extends Error {
  constructor(public required: number) {
    super("INSUFFICIENT_CREDITS");
    this.name = "InsufficientCreditsError";
  }
}

/**
 * 扣點 — 原子操作。
 * 餘額不足會 throw InsufficientCreditsError,API route 接住後回 402。
 * 其他錯誤(DB 斷線等)直接 throw。
 */
export async function spendCredits(params: {
  userId: string;
  amount: number;
  reason: CreditReason;
  referenceId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<number> {
  const { userId, amount, reason, referenceId, metadata } = params;
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("spend_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_id: referenceId ?? null,
    p_metadata: metadata ?? null,
  });

  if (error) {
    // phase5_credits.sql 內部 raise 'INSUFFICIENT_CREDITS' 時,
    // supabase-js 會把它包成 PostgresError,message 或 code 可以用來判斷
    if (
      error.message?.includes("INSUFFICIENT_CREDITS") ||
      (error as { code?: string }).code === "P0001"
    ) {
      throw new InsufficientCreditsError(amount);
    }
    throw error;
  }

  return data as number;
}

/**
 * 退點 — DeepSeek 呼叫失敗、或其他需要回退的情境
 * 不會 throw(盡量不要讓退款流程本身 break 主要錯誤回應),
 * 失敗時只 log,讓 ops 事後查 credit_transactions 補。
 */
export async function refundCredits(params: {
  userId: string;
  amount: number;
  referenceId?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  const { userId, amount, referenceId, errorMessage } = params;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("refund_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_reference_id: referenceId ?? null,
      p_error_message: errorMessage ?? null,
    });
    if (error) {
      console.error("[credits] refund failed", {
        userId,
        amount,
        error: error.message,
      });
    }
  } catch (e) {
    console.error("[credits] refund threw", e);
  }
}

/**
 * 查餘額 — 給 API / UI 顯示用
 * 失敗回傳 null(呼叫端自行決定要不要 fallback 成 0)
 */
export async function getCreditsBalance(userId: string): Promise<number | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return (data.credits_balance as number) ?? 0;
  } catch (e) {
    console.error("[credits] getBalance failed", e);
    return null;
  }
}
