/**
 * Banned user check
 *
 * 用在付費 / 占卜 / 任何寫操作的 API 開頭,擋下被封鎖的 user。
 * 一般讀取(看歷史紀錄、看公告)不需要擋,讓被封鎖者還能看到自己的資料。
 *
 * 用法:
 *   const banCheck = await assertNotBanned(user.id);
 *   if (!banCheck.ok) return banCheck.response;
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type BanCheckResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

export async function assertNotBanned(userId: string): Promise<BanCheckResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("banned, banned_reason")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // 查不到 ban 狀態,保守起見放行(避免誤殺,但 log)
    console.warn("[bannedCheck] query failed:", error.message);
    return { ok: true };
  }

  if (data?.banned) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "account_banned",
          detail: data.banned_reason ?? "您的帳號已被停權",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true };
}
