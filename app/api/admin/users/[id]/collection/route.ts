/**
 * GET /api/admin/users/[id]/collection
 *
 * Admin 看指定使用者的收藏狀態:已收 cardIds + 已領 milestoneIds + milestone configs。
 * RLS:user_collections / collection_milestones 都有 admin policy,所以用 admin client 讀。
 */

import { NextResponse, type NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const { id: targetUserId } = await params;
  if (!targetUserId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }

  const admin = createAdminClient();

  const [collectionsRes, milestonesRes, configsRes] = await Promise.all([
    admin
      .from("user_collections")
      .select("collection_type, card_id, card_subkind, source, obtain_count, first_obtained_at, last_obtained_at")
      .eq("user_id", targetUserId),
    admin
      .from("collection_milestones")
      .select("milestone_id, reward_credits, granted_at")
      .eq("user_id", targetUserId)
      .order("granted_at", { ascending: false }),
    admin
      .from("collection_milestone_configs")
      .select("*")
      .order("collection_type", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  if (collectionsRes.error) {
    console.error("[admin/collection] collections read:", collectionsRes.error);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (milestonesRes.error) {
    console.error("[admin/collection] milestones read:", milestonesRes.error);
  }
  if (configsRes.error) {
    console.error("[admin/collection] configs read:", configsRes.error);
  }

  const collections = collectionsRes.data ?? [];
  const milestones = milestonesRes.data ?? [];
  const configs = configsRes.data ?? [];

  // 拆兩個 type 給 client 顯示
  const ichingIds = collections
    .filter((c) => c.collection_type === "iching")
    .map((c) => c.card_id);
  const tarotIds = collections
    .filter((c) => c.collection_type === "tarot")
    .map((c) => c.card_id);

  return NextResponse.json({
    iching: { ownedIds: ichingIds, count: ichingIds.length, total: 64 },
    tarot: { ownedIds: tarotIds, count: tarotIds.length, total: 78 },
    milestones,
    milestoneConfigs: configs,
  });
}
