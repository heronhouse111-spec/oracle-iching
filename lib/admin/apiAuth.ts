/**
 * Admin API 共用守門 helpers
 *
 * 所有 /api/admin/* 路由必呼叫 assertAdmin() 或 assertRole(min) 在開頭做雙重檢查:
 *   1. 必須已登入(Supabase auth)
 *   2. profiles.role 必須 ≥ 指定等級
 *
 * Role 等級(數值越大越高):
 *   user (0)        ← 預設,沒任何後台權限
 *   support (1)     ← 客服:可讀(看使用者、訂單、占卜),不可寫
 *   admin (2)       ← 一般管理員:可讀寫(補點、改方案、發公告等)
 *   super_admin (3) ← 超級管理員:可管 admin 名單、危險操作
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "user" | "support" | "admin" | "super_admin";

const ROLE_LEVEL: Record<AdminRole, number> = {
  user: 0,
  support: 1,
  admin: 2,
  super_admin: 3,
};

export interface AdminContext {
  user: {
    id: string;
    email: string;
    role: AdminRole;
  };
}

export type AdminAuthResult =
  | { ok: true; ctx: AdminContext }
  | { ok: false; response: NextResponse };

/**
 * 在 admin API 開頭呼叫。預設要求 admin role,可傳更高/低限制。
 *
 * 範例:
 *   const auth = await assertRole("support");   // 客服以上能呼叫
 *   const auth = await assertRole("super_admin"); // 只有 super admin 能呼叫
 *   const auth = await assertAdmin();             // 等於 assertRole("admin")
 */
export async function assertRole(
  minRole: AdminRole = "admin",
): Promise<AdminAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", detail: "not signed in" },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "db_error", detail: error.message },
        { status: 500 },
      ),
    };
  }

  const role = (profile?.role ?? "user") as AdminRole;
  if (ROLE_LEVEL[role] < ROLE_LEVEL[minRole]) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "forbidden",
          detail: `requires role >= ${minRole}, you are ${role}`,
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      user: {
        id: user.id,
        email: user.email ?? "",
        role,
      },
    },
  };
}

/** 等同於 assertRole("admin"),保留 backward compat */
export async function assertAdmin(): Promise<AdminAuthResult> {
  return assertRole("admin");
}
