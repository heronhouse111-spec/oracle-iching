/**
 * Admin endpoints for the question inspirations content tree.
 *
 * GET  /api/admin/inspirations — 後台讀(沒 row 時回 static default,前端可直接編輯)
 * PUT  /api/admin/inspirations — 後台整包覆蓋(JSON tree)
 *
 * 設計:不做 row-level CRUD —— inspirations 整體是一個結構化文件,後台 UI
 * 把整顆樹當一個 form 在編,save 時整包替換。對單一管理員 + 低更新頻率場景,
 * 這比逐 row 操作簡單很多,衝突也不會出現。
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";
import { QUESTION_INSPIRATIONS } from "@/data/questionInspirations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "question_inspirations";

// ── 型別保護:確保前端送來的 JSON 是預期結構,擋掉亂塞東西 ──
interface InspirationQuestionShape {
  zh?: unknown;
  en?: unknown;
  ja?: unknown;
  ko?: unknown;
}
interface InspirationGroupShape {
  titleZh?: unknown;
  titleEn?: unknown;
  titleJa?: unknown;
  titleKo?: unknown;
  questions?: unknown;
}

function validateTree(input: unknown): { ok: true } | { ok: false; reason: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "root must be an object keyed by categoryId" };
  }
  const root = input as Record<string, unknown>;
  for (const [catId, groups] of Object.entries(root)) {
    if (!Array.isArray(groups)) {
      return { ok: false, reason: `category "${catId}" must be an array` };
    }
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi] as InspirationGroupShape;
      if (typeof g.titleZh !== "string" || typeof g.titleEn !== "string") {
        return { ok: false, reason: `${catId}[${gi}] must have titleZh + titleEn (string)` };
      }
      if (!Array.isArray(g.questions)) {
        return { ok: false, reason: `${catId}[${gi}].questions must be an array` };
      }
      for (let qi = 0; qi < g.questions.length; qi++) {
        const q = g.questions[qi] as InspirationQuestionShape;
        if (typeof q.zh !== "string" || typeof q.en !== "string") {
          return {
            ok: false,
            reason: `${catId}[${gi}].questions[${qi}] must have zh + en (string)`,
          };
        }
      }
    }
  }
  return { ok: true };
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_content")
    .select("value, updated_at")
    .eq("key", KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  if (!data?.value) {
    return NextResponse.json({
      inspirations: QUESTION_INSPIRATIONS,
      source: "static_default",
      updatedAt: null,
    });
  }

  return NextResponse.json({
    inspirations: data.value,
    source: "db",
    updatedAt: data.updated_at,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  let body: { inspirations?: unknown };
  try {
    body = (await req.json()) as { inspirations?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.inspirations) {
    return NextResponse.json(
      { error: "validation", detail: "inspirations field required" },
      { status: 400 },
    );
  }

  const check = validateTree(body.inspirations);
  if (!check.ok) {
    return NextResponse.json({ error: "validation", detail: check.reason }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_content")
    .upsert(
      {
        key: KEY,
        value: body.inspirations,
        updated_by: actor.id,
      },
      { onConflict: "key" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "inspirations.update",
    targetType: "app_content",
    targetId: KEY,
    payload: { sizeBytes: JSON.stringify(body.inspirations).length },
  });

  return NextResponse.json({ ok: true, updatedAt: data.updated_at });
}
