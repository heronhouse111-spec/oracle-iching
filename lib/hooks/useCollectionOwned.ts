"use client";

/**
 * useCollectionOwned — 給單卡詳細頁 (hexagram detail / tarot card detail)
 * 拉自己有沒有收藏這張卡,讓圖片決定灰階 / 彩色。
 *
 * 回傳:
 *   - status === 'loading'   → 還在 fetch(detail view 應該先顯示彩色,避免閃爍)
 *   - status === 'unauth'    → 未登入(同樣顯示彩色 + 顯示「登入後追蹤收藏」CTA)
 *   - status === 'owned'     → 已收藏(彩色 + ✓ 角標)
 *   - status === 'not-owned' → 已登入但沒收藏(灰階 + 「尚未抽到」標籤)
 */

import { useEffect, useState } from "react";

export type OwnedStatus = "loading" | "unauth" | "owned" | "not-owned";

export interface UseCollectionOwnedResult {
  status: OwnedStatus;
  /** 若已登入,該 type 收藏總數;未登入 / loading 為 0 */
  ownedCount: number;
  /** 若已登入,該 type 卡牌總數(易經 64 / 塔羅 78);用來顯示「23/64」 */
  total: number;
}

interface CollectionResponse {
  authenticated: boolean;
  type: "iching" | "tarot";
  owned: Array<{ cardId: string }>;
  ownedCount: number;
}

export function useCollectionOwned(
  type: "iching" | "tarot",
  cardId: string,
): UseCollectionOwnedResult {
  const [status, setStatus] = useState<OwnedStatus>("loading");
  const [ownedCount, setOwnedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/collection?type=${type}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setStatus("loading"); // 視為 loading,UI 仍走 default 彩色
          return;
        }
        const json: CollectionResponse = await res.json();
        if (cancelled) return;

        if (!json.authenticated) {
          setStatus("unauth");
          setOwnedCount(0);
          return;
        }
        const ownedSet = new Set(json.owned.map((o) => o.cardId));
        setOwnedCount(json.ownedCount);
        setStatus(ownedSet.has(cardId) ? "owned" : "not-owned");
      } catch {
        if (!cancelled) setStatus("loading");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, cardId]);

  return {
    status,
    ownedCount,
    total: type === "iching" ? 64 : 78,
  };
}
