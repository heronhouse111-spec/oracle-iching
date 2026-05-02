/**
 * DELETE /api/admin/collection-milestones/[id] — 刪除一個里程碑配置
 *
 * 注意:CASCADE 會把 collection_milestones(已領紀錄)的同 id row 也刪掉,
 * 但 add_credits 已經發出去的 credits 不會被回收 — 跟 ban / role 撤銷一樣,
 * 是 audit-only 的歷史記號,不可逆。
 *
 * 多數情況用「停用 active=false」就夠,真要刪才呼這支。
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("collection_milestone_configs")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "collection_milestone.delete",
    targetType: "collection_milestone",
    targetId: id,
    payload: {},
  });

  return NextResponse.json({ ok: true });
}
