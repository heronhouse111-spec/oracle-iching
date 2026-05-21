/**
 * GET  /api/admin/collection-hub — 列全部(含停用)
 * POST /api/admin/collection-hub — upsert 一筆(主要用於改 zh 跟 en/ja/ko 翻譯)
 *
 * 寫入用 service_role 繞 RLS。所有變更進 audit log。
 * 注意:這頁不能新增 / 刪除 row(需要前端 collection page 對應改 layout 才會生效)。
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UpsertBody {
  id?: string;
  titleZh?: string | null;
  titleEn?: string | null;
  titleJa?: string | null;
  titleKo?: string | null;
  bodyZh?: string | null;
  bodyEn?: string | null;
  bodyJa?: string | null;
  bodyKo?: string | null;
  active?: boolean;
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("collection_hub_content")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
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

  if (!body.id) {
    return NextResponse.json({ error: "validation", detail: "id required" }, { status: 400 });
  }

  // 只能 update 既有 row(防止亂加 key)
  const supabase = createAdminClient();
  const { data: existing, error: readErr } = await supabase
    .from("collection_hub_content")
    .select("id")
    .eq("id", body.id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: "db_error", detail: readErr.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "not_found", detail: `id ${body.id} not in catalog` }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if ("titleZh" in body) patch.title_zh = body.titleZh;
  if ("titleEn" in body) patch.title_en = body.titleEn;
  if ("titleJa" in body) patch.title_ja = body.titleJa;
  if ("titleKo" in body) patch.title_ko = body.titleKo;
  if ("bodyZh" in body) patch.body_zh = body.bodyZh;
  if ("bodyEn" in body) patch.body_en = body.bodyEn;
  if ("bodyJa" in body) patch.body_ja = body.bodyJa;
  if ("bodyKo" in body) patch.body_ko = body.bodyKo;
  if ("active" in body) patch.active = body.active;

  const { data, error } = await supabase
    .from("collection_hub_content")
    .update(patch)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "collection_hub_content.update",
    targetType: "collection_hub_content",
    targetId: body.id,
    payload: { fields: Object.keys(patch) },
  });

  return NextResponse.json({ ok: true, item: data });
}
