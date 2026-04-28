/**
 * GET /api/admin/ui-images — admin 讀(沒 row 時回空 map)
 * PUT /api/admin/ui-images — admin 整包覆蓋(只接受 string→string 的平面 map)
 *
 * 跟 inspirations 一樣走「整包替換」策略,簡單可靠。
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY = "ui_images";

function validateMap(input: unknown): input is Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof k !== "string" || !k) return false;
    if (typeof v !== "string") return false;
  }
  return true;
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_content")
    .select("value, updated_at")
    .eq("key", KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    images: (data?.value as Record<string, string>) ?? {},
    updatedAt: data?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  let body: { images?: unknown };
  try {
    body = (await req.json()) as { images?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!validateMap(body.images)) {
    return NextResponse.json(
      { error: "validation", detail: "images must be Record<string, string>" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_content")
    .upsert({ key: KEY, value: body.images, updated_by: actor.id }, { onConflict: "key" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ui_images.update",
    targetType: "app_content",
    targetId: KEY,
    payload: { slotCount: Object.keys(body.images).length },
  });

  // 戳掉 lib/uiImages.ts 的 unstable_cache,讓使用者下次刷新就看到新圖
  revalidateTag("ui-images");

  return NextResponse.json({ ok: true, updatedAt: data.updated_at });
}
