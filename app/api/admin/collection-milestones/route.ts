/**
 * GET  /api/admin/collection-milestones — 列全部(含停用)
 * POST /api/admin/collection-milestones — upsert(新增 / 編輯;PK=id)
 *
 * 寫入用 service_role 繞過 RLS,但變更全進 admin_audit_log。
 *
 * 提醒:改 reward / threshold 對「已領舊獎勵的 user」不會自動補差額 —
 * collection_milestones 表的 PK (user_id, milestone_id) 防止重複領,
 * 已達成過的閾值改了也不會重新發獎。要回溯需手動 SQL,或先停用該 milestone
 * (active=false)再開新 milestone id。
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UpsertBody {
  id?: string;
  collectionType?: "iching" | "tarot";
  kind?: "distinct_count" | "subkind_full";
  threshold?: number;
  param?: string | null;
  rewardCredits?: number;
  labelZh?: string;
  labelEn?: string;
  labelJa?: string | null;
  labelKo?: string | null;
  sortOrder?: number;
  active?: boolean;
}

const ID_RE = /^[a-z][a-z0-9_-]{1,40}$/;

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("collection_milestone_configs")
    .select("*")
    .order("collection_type", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ milestones: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 驗證
  const errors: string[] = [];
  if (!body.id || !ID_RE.test(body.id)) {
    errors.push("id 必須是小寫字母開頭 / 字母數字底線連字號,2-41 字");
  }
  if (body.collectionType !== "iching" && body.collectionType !== "tarot") {
    errors.push("collectionType must be 'iching' or 'tarot'");
  }
  if (body.kind !== "distinct_count" && body.kind !== "subkind_full") {
    errors.push("kind must be 'distinct_count' or 'subkind_full'");
  }
  if (typeof body.threshold !== "number" || !Number.isInteger(body.threshold) || body.threshold <= 0) {
    errors.push("threshold must be positive integer");
  }
  if (body.kind === "subkind_full") {
    if (body.collectionType !== "tarot") errors.push("subkind_full only supports tarot");
    if (!body.param) errors.push("subkind_full requires param (e.g. 'major', 'wands')");
  }
  if (typeof body.rewardCredits !== "number" || body.rewardCredits < 0) {
    errors.push("rewardCredits must be non-negative integer");
  }
  if (typeof body.labelZh !== "string" || !body.labelZh) errors.push("labelZh required");
  if (typeof body.labelEn !== "string" || !body.labelEn) errors.push("labelEn required");

  if (errors.length > 0) {
    return NextResponse.json({ error: "validation", detail: errors }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("collection_milestone_configs")
    .upsert({
      id: body.id,
      collection_type: body.collectionType,
      kind: body.kind,
      threshold: body.threshold,
      param: body.param ?? null,
      reward_credits: body.rewardCredits,
      label_zh: body.labelZh,
      label_en: body.labelEn,
      label_ja: body.labelJa ?? null,
      label_ko: body.labelKo ?? null,
      sort_order: body.sortOrder ?? 100,
      active: body.active ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "collection_milestone.upsert",
    targetType: "collection_milestone",
    targetId: data.id,
    payload: {
      collectionType: data.collection_type,
      threshold: data.threshold,
      rewardCredits: data.reward_credits,
      active: data.active,
    },
  });

  return NextResponse.json({ ok: true, milestone: data });
}
