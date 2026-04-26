/**
 * Admin API 共用守門 helpers
 *
 * 所有 /api/admin/* 路由必呼叫 assertAdmin() 在開頭做雙重檢查:
 *   1. 必須已登入(Supabase auth)
 *   2. profiles.is_admin 必須為 true
 *
 * 失敗回傳對應的 NextResponse 直接 return。
 *
 * 為什麼即使 page 層已 guard 仍要 API 也 guard?
 * - 攻擊者可繞過 page 直接打 API URL
 * - DB RLS 是最後防線,但寫入操作多走 service_role(會繞過 RLS),
 *   所以 API 層必須親自把關
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface AdminContext {
  /** 已驗證的 Supabase user(已確認是 admin) */
  user: {
    id: string;
    email: string;
  };
}

export type AdminAuthResult =
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse };

/**
 * 在 admin API 開頭呼叫。回傳 ok=true 時 ctx 就有 user 可用。
 * ok=false 時直接 return result.response。
 *
 * 範例:
 *   export async function POST(req: NextRequest) {
 *     const auth = await assertAdmin();
 *     if (!auth.ok) return auth.response;
 *     const { user } = auth.ctx;
 *     ...
 *   }
 */
export async function assertAdmin(): Promise<AdminAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", detail: "not signed in" },
        { status: 401 }
      ),
    };
  }

  // 查 profiles.is_admin
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "db_error", detail: error.message },
        { status: 500 }
      ),
    };
  }

  if (!profile?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", detail: "admin only" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      user: {
        id: user.id,
        email: user.email ?? "",
      },
    },
  };
}
