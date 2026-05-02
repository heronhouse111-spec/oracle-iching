/**
 * Card collection — server-side helper
 *
 * 對應 supabase/phase20_card_collection.sql 的 record_card_obtained() RPC。
 *
 * 從 server route 呼叫(daily / 主流占卜 / yes-no / plum / direction):
 *   const result = await recordCardObtained({
 *     userId: user.id,
 *     collectionType: 'iching',
 *     cardId: String(hex.number),       // '1'..'64'
 *     source: 'daily',
 *   });
 *
 * 塔羅:
 *   await recordCardObtained({
 *     userId: user.id,
 *     collectionType: 'tarot',
 *     cardId: card.id,                  // slug
 *     cardSubkind: card.suit,           // 'major'|'wands'|'cups'|'swords'|'pentacles'
 *     source: 'main',
 *   });
 *
 * 失敗永遠不要 throw — 收藏是次要功能,不能炸 main flow。失敗 console.error 即可。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { TarotSuit } from "@/data/tarot";

export type CollectionType = "iching" | "tarot";
export type CollectionSource =
  | "daily"
  | "main"
  | "plum_blossom"
  | "direction"
  | "yes_no"
  | "admin_grant";

export interface RecordCardParams {
  userId: string;
  collectionType: CollectionType;
  cardId: string;
  /** 塔羅必填(suit);易經傳 null/undefined */
  cardSubkind?: TarotSuit | null;
  source: CollectionSource;
}

export interface UnlockedMilestone {
  id: string;
  reward_credits: number;
  label_zh: string;
  label_en: string;
}

export interface RecordCardResult {
  /** 該 user 第一次擁有這張卡 → true(可給 toast「✨ 新卡!」) */
  isNew: boolean;
  /** 該 user 在這個 collection_type 已收藏 distinct 張數(顯示「23/64」) */
  distinctCount: number;
  /** 這次達成的里程碑(可能 0~多筆;每筆已自動發 credits) */
  unlockedMilestones: UnlockedMilestone[];
  /** 這次因里程碑共獲得的 credits 加總 */
  rewardCredits: number;
}

/**
 * 主入口。失敗回傳保底結果(isNew=false, count=0, 無里程碑),呼叫端不需要 try-catch。
 */
export async function recordCardObtained(
  params: RecordCardParams,
): Promise<RecordCardResult> {
  const fallback: RecordCardResult = {
    isNew: false,
    distinctCount: 0,
    unlockedMilestones: [],
    rewardCredits: 0,
  };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("record_card_obtained", {
      p_user_id: params.userId,
      p_collection_type: params.collectionType,
      p_card_id: params.cardId,
      p_card_subkind: params.cardSubkind ?? null,
      p_source: params.source,
    });

    if (error) {
      console.error("[cardCollection] record_card_obtained RPC failed:", error);
      return fallback;
    }

    if (!data || typeof data !== "object") return fallback;

    const d = data as Record<string, unknown>;
    return {
      isNew: Boolean(d.is_new),
      distinctCount: Number(d.distinct_count ?? 0),
      unlockedMilestones: Array.isArray(d.unlocked_milestones)
        ? (d.unlocked_milestones as UnlockedMilestone[])
        : [],
      rewardCredits: Number(d.reward_credits ?? 0),
    };
  } catch (e) {
    console.error("[cardCollection] unexpected error:", e);
    return fallback;
  }
}

/**
 * 多卡批次寫入(塔羅一次抽多張時用)。順序處理,
 * 每一張都會獨立判定里程碑 — 因為里程碑可能在第 2 張就跨過閾值,
 * 第 3 張就不該再觸發同一個。SQL function 自帶 dedup 防護,所以順序呼叫安全。
 */
export async function recordManyCardsObtained(
  paramsList: RecordCardParams[],
): Promise<RecordCardResult[]> {
  const results: RecordCardResult[] = [];
  for (const p of paramsList) {
    results.push(await recordCardObtained(p));
  }
  return results;
}

/** 把多筆結果聚合成單一給前端的 summary(toast 用) */
export function aggregateResults(results: RecordCardResult[]): {
  newCardCount: number;
  totalUnlockedMilestones: UnlockedMilestone[];
  totalRewardCredits: number;
  finalDistinctCount: number;
} {
  return {
    newCardCount: results.filter((r) => r.isNew).length,
    totalUnlockedMilestones: results.flatMap((r) => r.unlockedMilestones),
    totalRewardCredits: results.reduce((sum, r) => sum + r.rewardCredits, 0),
    finalDistinctCount: results.length > 0 ? results[results.length - 1].distinctCount : 0,
  };
}
