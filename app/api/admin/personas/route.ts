/**
 * GET  /api/admin/personas — 列全部(含停用),按 system + sort_order 排序
 * POST /api/admin/personas — 新增 persona
 *
 * 寫入用 service_role,繞過 RLS。
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateBody {
  id?: string;
  system?: "iching" | "tarot" | "any";
  tier?: "free" | "premium";
  active?: boolean;
  sortOrder?: number;
  emoji?: string | null;
  imageUrl?: string | null;
  nameZh?: string;
  nameEn?: string;
  nameJa?: string | null;
  nameKo?: string | null;
  taglineZh?: string;
  taglineEn?: string;
  taglineJa?: string | null;
  taglineKo?: string | null;
  promptZh?: string;
  promptEn?: string;
}

const ID_RE = /^[a-z][a-z0-9-]{1,30}$/;

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("personas")
    .select("*")
    .order("system", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ personas: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // 驗證
  if (!body.id || !ID_RE.test(body.id)) {
    return NextResponse.json(
      { error: "validation", detail: "id 必須是小寫字母 / 數字 / 連字號,2-31 字" },
      { status: 400 },
    );
  }
  if (!body.system || !["iching", "tarot", "any"].includes(body.system)) {
    return NextResponse.json({ error: "validation", detail: "system invalid" }, { status: 400 });
  }
  for (const field of ["nameZh", "nameEn", "taglineZh", "taglineEn", "promptZh", "promptEn"] as const) {
    if (typeof body[field] !== "string" || !body[field]) {
      return NextResponse.json(
        { error: "validation", detail: `${field} required` },
        { status: 400 },
      );
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("personas")
    .insert({
      id: body.id,
      system: body.system,
      tier: body.tier ?? "free",
      active: body.active ?? true,
      sort_order: body.sortOrder ?? 100,
      emoji: body.emoji ?? null,
      image_url: body.imageUrl ?? null,
      name_zh: body.nameZh,
      name_en: body.nameEn,
      name_ja: body.nameJa ?? null,
      name_ko: body.nameKo ?? null,
      tagline_zh: body.taglineZh,
      tagline_en: body.taglineEn,
      tagline_ja: body.taglineJa ?? null,
      tagline_ko: body.taglineKo ?? null,
      prompt_zh: body.promptZh,
      prompt_en: body.promptEn,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 },
    );
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "persona.create",
    targetType: "persona",
    targetId: data.id,
    payload: { system: data.system, tier: data.tier },
  });

  return NextResponse.json({ ok: true, persona: data });
}
