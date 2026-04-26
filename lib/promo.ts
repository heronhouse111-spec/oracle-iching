/**
 * 促銷碼共用邏輯
 *
 * verifyPromoCode():給定 code + 訂單 context,回傳「能不能用 + 折抵後金額/額外點數」。
 * Server-side only(用 service role 繞過 RLS,因為 anon 不能 read promo_codes table)。
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type DiscountType =
  | "percentage"
  | "fixed_amount"
  | "bonus_credits"
  | "free_period";

export interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  applies_to: string;
  usage_limit: number | null;
  per_user_limit: number;
  starts_at: string;
  expires_at: string | null;
  active: boolean;
  total_redemptions: number;
}

export interface VerifyContext {
  /** 'credit_pack' / 'subscription' */
  kind: "credit_pack" | "subscription";
  /** pack_500 / monthly / yearly etc. */
  itemId: string;
  /** 原始金額(NT$) */
  amount: number;
  /** 用 user id 檢查 per_user_limit */
  userId: string;
}

export type VerifyResult =
  | {
      ok: true;
      code: PromoCode;
      finalAmount: number;       // 折抵後金額
      bonusCredits: number;      // 加贈點數(只對 credit_pack 有意義)
      freeMonths: number;        // 免費期數(只對 subscription 有意義)
      reason: string;            // 「9 折」「贈 100 點」等顯示文字
    }
  | {
      ok: false;
      error:
        | "not_found"
        | "inactive"
        | "expired"
        | "not_started"
        | "usage_limit_reached"
        | "per_user_limit_reached"
        | "not_applicable";
      message: string;
    };

export async function verifyPromoCode(
  rawCode: string,
  ctx: VerifyContext,
): Promise<VerifyResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "not_found", message: "促銷碼不可空白" };

  const supabase = createAdminClient();

  const { data: promo, error } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error)
    return { ok: false, error: "not_found", message: "查詢失敗" };
  if (!promo) return { ok: false, error: "not_found", message: "促銷碼不存在" };
  if (!promo.active)
    return { ok: false, error: "inactive", message: "此促銷碼已停用" };

  const now = new Date();
  if (new Date(promo.starts_at) > now)
    return { ok: false, error: "not_started", message: "促銷碼尚未開始" };
  if (promo.expires_at && new Date(promo.expires_at) < now)
    return { ok: false, error: "expired", message: "促銷碼已過期" };

  if (promo.usage_limit && promo.total_redemptions >= promo.usage_limit)
    return {
      ok: false,
      error: "usage_limit_reached",
      message: "促銷碼已用完",
    };

  // 同一個 user 已用過幾次?
  const { count: userUsedCount } = await supabase
    .from("promo_code_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("promo_code_id", promo.id)
    .eq("user_id", ctx.userId);

  if ((userUsedCount ?? 0) >= promo.per_user_limit)
    return {
      ok: false,
      error: "per_user_limit_reached",
      message: "你已達此促銷碼的使用次數上限",
    };

  // 是否適用此 item
  if (
    promo.applies_to !== "all" &&
    promo.applies_to !== ctx.kind &&
    promo.applies_to !== `pack:${ctx.itemId}` &&
    promo.applies_to !== `plan:${ctx.itemId}`
  ) {
    return {
      ok: false,
      error: "not_applicable",
      message: "此促銷碼不適用於目前的方案",
    };
  }

  // 計算 discount
  let finalAmount = ctx.amount;
  let bonusCredits = 0;
  let freeMonths = 0;
  let reason = "";

  switch (promo.discount_type) {
    case "percentage": {
      const discount = Math.round((ctx.amount * promo.discount_value) / 100);
      finalAmount = Math.max(0, ctx.amount - discount);
      reason = `${promo.discount_value}% off · 折 NT$${discount}`;
      break;
    }
    case "fixed_amount": {
      finalAmount = Math.max(0, ctx.amount - promo.discount_value);
      reason = `折 NT$${promo.discount_value}`;
      break;
    }
    case "bonus_credits": {
      if (ctx.kind !== "credit_pack")
        return {
          ok: false,
          error: "not_applicable",
          message: "加贈點數型促銷碼僅適用於加購方案",
        };
      bonusCredits = promo.discount_value;
      reason = `加贈 ${bonusCredits} 點`;
      break;
    }
    case "free_period": {
      if (ctx.kind !== "subscription")
        return {
          ok: false,
          error: "not_applicable",
          message: "免費期型促銷碼僅適用於訂閱方案",
        };
      freeMonths = promo.discount_value;
      reason = `首 ${freeMonths} 個月免費`;
      break;
    }
  }

  return {
    ok: true,
    code: promo as PromoCode,
    finalAmount,
    bonusCredits,
    freeMonths,
    reason,
  };
}

/**
 * 將促銷碼兌換寫入 redemption 表(在訂單成立時呼叫,例如 webhook 確認付款後)。
 * 同一筆訂單只能兌一次,unique constraint 已防重複。
 */
export async function recordRedemption(args: {
  promoCodeId: number;
  userId: string;
  merchantTradeNo?: string;
  appliedAmount: number;
  appliedTo: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("promo_code_redemptions").insert({
    promo_code_id: args.promoCodeId,
    user_id: args.userId,
    merchant_trade_no: args.merchantTradeNo ?? null,
    applied_amount: args.appliedAmount,
    applied_to: args.appliedTo,
  });
  if (error) {
    if (error.code === "23505") {
      // duplicate redemption 不算錯,代表 webhook 重送
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
