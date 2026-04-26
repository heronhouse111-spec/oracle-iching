/**
 * GET /api/admin/users/search?q=foo&limit=20
 *
 * Admin 用 email 部分查詢使用者列表(ILIKE)。
 * 用 admin_users_view(已 join auth.users + profiles)。
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
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1),
    100,
  );

  const supabase = await createClient();

  let query = supabase
    .from("admin_users_view")
    .select(
      "id, email, signed_up_at, last_sign_in_at, display_name, preferred_locale, is_admin",
    )
    .order("signed_up_at", { ascending: false })
    .limit(limit);

  if (q.length > 0) {
    query = query.ilike("email", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "db_error", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ users: data ?? [] });
}
