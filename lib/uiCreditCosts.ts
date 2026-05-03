/**
 * 前端 UI 顯示用的點數成本(client-safe)
 *
 * 為什麼獨立這支:
 *   lib/credits.ts 在 module scope 引入 SERVICE_ROLE supabase admin client,
 *   client component 不能直接 import。把純常數抽出來給前端 UI 用。
 *
 * 跟其他兩處的關係:
 *   - lib/credits.ts CREDIT_COSTS:後端 fallback,給 lib/creditCostsDb.ts 用
 *   - DB 表 credit_costs:admin 即時改價的 source of truth
 *   - 本檔:純前端顯示用「預設標示」,跟 CREDIT_COSTS 對齊
 *
 * 已知妥協:admin 在 /admin/credit-costs 改 DB 後,UI 標示不會即時跟著變
 *   (要重 deploy 才會更新)。這是換取「不需要新建 public API + client fetch」
 *   的取捨;真要動態,之後可以做 /api/credit-costs/public 開出來。
 */

/** 跟 lib/credits.ts CREDIT_COSTS 同步 — 改價時這裡也要動 */
export const UI_CREDIT_COSTS = {
  DIVINE: 5,
  TAROT: 5,
  DIVINE_FOLLOWUP: 10,
  TAROT_FOLLOWUP: 10,
  CHAT: 1,
  YESNO: 2,
  DAILY: 1,
  TAROT_5_CARD: 10,    // 愛情十字
  TAROT_10_CARD: 20,   // 凱爾特十字
  TAROT_12_CARD: 14,
  DEEP_INSIGHT_SURCHARGE: 3,
  DIRECTION_HEX: 10,   // 方位卦象合參
  PLUM_BLOSSOM: 5,
} as const;

/** 由牌陣張數推出 cost(同 /api/tarot 的 tarotCostFor 邏輯) */
export function tarotSpreadCostByCardCount(cardCount: number): number {
  switch (cardCount) {
    case 3: return UI_CREDIT_COSTS.TAROT;
    case 5: return UI_CREDIT_COSTS.TAROT_5_CARD;
    case 10: return UI_CREDIT_COSTS.TAROT_10_CARD;
    case 12: return UI_CREDIT_COSTS.TAROT_12_CARD;
    default: return UI_CREDIT_COSTS.TAROT;
  }
}
