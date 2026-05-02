import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/collection?type=iching|tarot
 *
 * 回登入使用者在指定 type 的收藏狀態 + 已領 / 未領里程碑。
 * 未登入 → { authenticated: false, owned: [], milestoneConfigs: [], earnedMilestoneIds: [] }
 *   (前端可選擇全灰階 + 顯示 CTA「登入後追蹤收集進度」)
 *
 * RLS:user_collections / collection_milestones 都已設「user 只看自己」,
 * 直接用 user-scoped client 讀即可,不必 admin client。
 * collection_milestone_configs 是 active=true 公開可讀,訪客也能拿到。
 */

interface CollectionItem {
  cardId: string;
  obtainCount: number;
  firstObtainedAt: string;
  lastObtainedAt: string;
}

interface MilestoneConfig {
  id: string;
  collectionType: "iching" | "tarot";
  kind: "distinct_count" | "subkind_full";
  threshold: number;
  param: string | null;
  rewardCredits: number;
  labelZh: string;
  labelEn: string;
  labelJa: string | null;
  labelKo: string | null;
  sortOrder: number;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  if (type !== "iching" && type !== "tarot") {
    return NextResponse.json(
      { error: "INVALID_TYPE", message: "type must be 'iching' or 'tarot'" },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // milestone configs 是公開資料 — 不論是否登入都拿,前端可預先顯示「集滿可解鎖什麼」
    const { data: configsRaw, error: cfgErr } = await supabase
      .from("collection_milestone_configs")
      .select("*")
      .eq("collection_type", type)
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (cfgErr) {
      console.error("[collection] configs read error:", cfgErr);
      // 不擋 — 給空 configs,還是回收藏資料
    }

    const milestoneConfigs: MilestoneConfig[] = (configsRaw ?? []).map((r) => ({
      id: r.id,
      collectionType: r.collection_type,
      kind: r.kind,
      threshold: r.threshold,
      param: r.param,
      rewardCredits: r.reward_credits,
      labelZh: r.label_zh,
      labelEn: r.label_en,
      labelJa: r.label_ja,
      labelKo: r.label_ko,
      sortOrder: r.sort_order,
    }));

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        type,
        owned: [],
        ownedCount: 0,
        milestoneConfigs,
        earnedMilestoneIds: [],
      });
    }

    // 自己的收藏
    const { data: ownedRaw, error: ownedErr } = await supabase
      .from("user_collections")
      .select("card_id, obtain_count, first_obtained_at, last_obtained_at")
      .eq("user_id", user.id)
      .eq("collection_type", type);

    if (ownedErr) {
      console.error("[collection] owned read error:", ownedErr);
      return NextResponse.json(
        { error: "READ_FAILED", message: "Failed to read collection" },
        { status: 500 },
      );
    }

    const owned: CollectionItem[] = (ownedRaw ?? []).map((r) => ({
      cardId: String(r.card_id),
      obtainCount: r.obtain_count,
      firstObtainedAt: r.first_obtained_at,
      lastObtainedAt: r.last_obtained_at,
    }));

    // 已領里程碑
    const { data: earnedRaw } = await supabase
      .from("collection_milestones")
      .select("milestone_id, granted_at, reward_credits")
      .eq("user_id", user.id);

    const allEarnedIds = new Set((earnedRaw ?? []).map((r) => r.milestone_id));
    // 只回傳屬於這個 type 的(透過 configs 反查)
    const configIdSet = new Set(milestoneConfigs.map((c) => c.id));
    const earnedMilestoneIds = Array.from(allEarnedIds).filter((id) =>
      configIdSet.has(id),
    );

    return NextResponse.json({
      authenticated: true,
      type,
      owned,
      ownedCount: owned.length,
      milestoneConfigs,
      earnedMilestoneIds,
    });
  } catch (e) {
    console.error("[collection] unexpected error:", e);
    return NextResponse.json(
      { error: "UNEXPECTED", message: String(e) },
      { status: 500 },
    );
  }
}
