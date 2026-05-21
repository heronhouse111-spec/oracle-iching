/**
 * GET /api/admin/audit-log?actor=&action=&from=&to=&limit=
 *
 * 列 admin 操作 audit log,支援多條件過濾。
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const actor = url.searchParams.get("actor");        // email substring
  const action = url.searchParams.get("action");      // exact or substring
  const from = url.searchParams.get("from");          // ISO date
  const to = url.searchParams.get("to");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 500);

  const supabase = await createClient();
  let query = supabase
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (actor) query = query.ilike("actor_email", `%${actor}%`);
  if (action) query = query.ilike("action", `%${action}%`);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}
