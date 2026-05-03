/**
 * GET /api/admin/users/[id]
 *
 * Admin 取得單一 user 完整資料:
 *   - profile(餘額、訂閱狀態、is_admin)
 *   - 訂閱(subscriptions table)
 *   - 近期占卜(divinations,最新 20 筆)
 *   - 補/扣點記錄(credit_grants,最新 20 筆)
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  const supabase = await createClient();

  // 平行抓 6 個資料源
  // - spendTxs:該 user 所有 spend_* 流水(用來對應 divinations 顯示扣點 + 餘額)
  // - rewardTxs:該 user 所有 collection_milestone 流水(用來算「卡牌已發獎勵」總額)
  const [profileResult, userResult, divinationsResult, grantsResult, spendTxsResult, rewardTxsResult] =
    await Promise.all([
      supabase
        .from("admin_users_view")
        .select(
          "id, email, signed_up_at, last_sign_in_at, display_name, preferred_locale, is_admin",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select(
          "credits_balance, credits_refills_at, subscription_status, subscription_plan, subscription_started_at, subscription_expires_at",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("divinations")
        .select(
          "id, question, category, hexagram_number, locale, divine_type, created_at",
        )
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("credit_grants")
        .select(
          "id, delta, balance_after, reason, granted_by_email, related_order_mtn, created_at",
        )
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      // 撈最近的 spend_* 流水給 divinations 對應 — 拉 100 筆夠 cover 20 筆占卜
      supabase
        .from("credit_transactions")
        .select("delta, balance_after, reason, created_at")
        .eq("user_id", id)
        .like("reason", "spend_%")
        .order("created_at", { ascending: false })
        .limit(100),
      // 收集里程碑發出的所有獎勵
      supabase
        .from("credit_transactions")
        .select("delta, created_at")
        .eq("user_id", id)
        .eq("reason", "collection_milestone"),
    ]);

  if (!profileResult.data) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // 訂閱以 profiles 為準(寫入時 admin/billing API 都更新這裡)。
  // subscriptions 表是歷程,只用來找最近一筆的 provider。
  const { data: latestSub } = await supabase
    .from("subscriptions")
    .select("provider")
    .eq("user_id", id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const profileSub = userResult.data;
  const status = profileSub?.subscription_status ?? "free";
  const plan = profileSub?.subscription_plan ?? null;
  const expiresAt = profileSub?.subscription_expires_at ?? null;
  const subscription =
    status === "free"
      ? null
      : {
          plan,
          status,
          started_at: profileSub?.subscription_started_at ?? null,
          expires_at: expiresAt,
          provider: latestSub?.provider ?? "manual",
          is_active:
            (status === "active" || status === "canceled") &&
            (!expiresAt || new Date(expiresAt).getTime() > Date.now()),
        };

  // ── 對應每筆 divination 找到「最接近的 spend transaction」──
  // 因為 saveDivination 是 client-side 寫入(在 spend_credits server-side 執行之後),
  // tx.created_at < divination.created_at,差距通常 1-30 秒(視 AI streaming 長度)。
  // 用「最接近」配對,並 dedupe(同一 tx 不會被兩筆 divination 用到)。
  interface SpendTx {
    delta: number;
    balance_after: number;
    reason: string;
    created_at: string;
  }
  const spendTxs: SpendTx[] = (spendTxsResult.data ?? []) as SpendTx[];
  const usedTxIdx = new Set<number>();
  const divinations = (divinationsResult.data ?? []).map((d) => {
    const dTime = new Date(d.created_at).getTime();
    let bestIdx = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < spendTxs.length; i++) {
      if (usedTxIdx.has(i)) continue;
      const tx = spendTxs[i];
      const txTime = new Date(tx.created_at).getTime();
      // window: tx 在 divination 之前 60s 內,或之後 5s 內(時鐘漂移)
      if (txTime > dTime + 5000 || txTime < dTime - 60000) continue;
      const diff = Math.abs(txTime - dTime);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      usedTxIdx.add(bestIdx);
      const tx = spendTxs[bestIdx];
      return {
        ...d,
        spent_credits: -tx.delta, // delta 是負的,顯示成正數
        balance_after: tx.balance_after,
      };
    }
    return { ...d, spent_credits: null, balance_after: null };
  });

  // ── 收集里程碑獎勵總額 ──
  const collectionRewardsTotal = (rewardTxsResult.data ?? []).reduce(
    (sum, t) => sum + (t.delta ?? 0),
    0,
  );
  const collectionRewardsCount = rewardTxsResult.data?.length ?? 0;

  return NextResponse.json({
    profile: {
      ...profileResult.data,
      credits_balance: userResult.data?.credits_balance ?? 0,
      credits_refills_at: userResult.data?.credits_refills_at ?? null,
    },
    subscription,
    divinations,
    grants: grantsResult.data ?? [],
    collectionRewardsTotal,
    collectionRewardsCount,
  });
}
