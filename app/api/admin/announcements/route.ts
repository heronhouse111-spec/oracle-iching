/**
 * GET /api/admin/announcements — 列所有公告(含 inactive 跟過期的)
 * POST /api/admin/announcements — 新增公告
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Severity = "info" | "warn" | "critical";

interface CreateBody {
  zhText?: string | null;
  enText?: string | null;
  linkUrl?: string | null;
  severity?: Severity;
  startsAt?: string;   // ISO timestamp
  endsAt?: string | null;
  active?: boolean;
  displayOrder?: number;
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ announcements: data ?? [] });
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

  if (!body.zhText && !body.enText) {
    return NextResponse.json(
      { error: "validation", detail: "至少需要中文或英文內容" },
      { status: 400 },
    );
  }

  const severity: Severity = body.severity ?? "info";
  if (!["info", "warn", "critical"].includes(severity)) {
    return NextResponse.json({ error: "validation", detail: "invalid severity" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      zh_text: body.zhText ?? null,
      en_text: body.enText ?? null,
      link_url: body.linkUrl ?? null,
      severity,
      starts_at: body.startsAt ?? new Date().toISOString(),
      ends_at: body.endsAt ?? null,
      active: body.active ?? true,
      display_order: body.displayOrder ?? 100,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "announcement.create",
    targetType: "announcement",
    targetId: String(data.id),
    payload: { ...body },
  });

  return NextResponse.json({ ok: true, announcement: data });
}
