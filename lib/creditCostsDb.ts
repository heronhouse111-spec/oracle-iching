/**
 * Server-side credit cost resolver — DB-first, fallback to lib/credits.ts CREDIT_COSTS.
 *
 * 設計:
 *   - DB 是 source of truth(admin 可從 /admin/credit-costs 即時改)
 *   - lib/credits.ts CREDIT_COSTS 變成 fallback,DB 讀不到 / 失敗時用,
 *     確保即使 DB 暫時掛了主流程仍能跑(只是會用舊價格)
 *   - 每個 server-side process 本身做 60 秒 cache,避免每次扣點都打 DB
 *     (admin 改價後最多 1 分鐘生效;高效平台需要時可以縮)
 *
 * 用法:
 *   import { getCreditCost } from "@/lib/creditCostsDb";
 *   const cost = await getCreditCost("YESNO");           // 動態
 *   await spendCredits({ userId, amount: cost, reason: "spend_yesno", ... });
 *
 * 注意這是 SERVER-ONLY(用 admin client),不可被 client bundle import。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { CREDIT_COSTS } from "@/lib/credits";

export type CreditCostKey = keyof typeof CREDIT_COSTS;

interface CacheEntry {
  costs: Record<string, number>;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 1000;
let cache: CacheEntry | null = null;
let inflight: Promise<Record<string, number>> | null = null;

async function loadCostsFromDb(): Promise<Record<string, number>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("credit_costs")
      .select("id, amount")
      .eq("active", true);
    if (error || !data) {
      console.error("[creditCosts] DB read failed, using static fallback:", error);
      return {};
    }
    const map: Record<string, number> = {};
    for (const row of data) {
      map[row.id as string] = row.amount as number;
    }
    return map;
  } catch (e) {
    console.error("[creditCosts] DB read threw, using static fallback:", e);
    return {};
  }
}

async function getCachedCosts(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.costs;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    const costs = await loadCostsFromDb();
    cache = { costs, fetchedAt: Date.now() };
    inflight = null;
    return costs;
  })();
  return inflight;
}

/**
 * 取單一成本值。DB 沒這個 key → fallback 到 lib/credits.ts CREDIT_COSTS。
 */
export async function getCreditCost(key: CreditCostKey): Promise<number> {
  const costs = await getCachedCosts();
  if (key in costs) return costs[key];
  return CREDIT_COSTS[key];
}

/**
 * 一次拿全部(admin UI 列表用)。
 */
export async function getAllCreditCosts(): Promise<Record<CreditCostKey, number>> {
  const costs = await getCachedCosts();
  const result: Record<string, number> = { ...CREDIT_COSTS };
  for (const k of Object.keys(costs)) {
    result[k] = costs[k];
  }
  return result as Record<CreditCostKey, number>;
}

/**
 * 強制清快取(admin 編輯後叫一次,讓變更立刻生效)。
 */
export function invalidateCreditCostsCache(): void {
  cache = null;
  inflight = null;
}
