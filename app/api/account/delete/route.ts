import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/account/delete
 *
 * 使用者自助刪除帳號(Google Play 2023+ 上架必要)。
 *
 * 流程:
 *   1. 從 cookie session 讀 user —— 沒 session 直接 401
 *   2. 用 admin client 呼叫 auth.admin.deleteUser(user.id)
 *      —— 所有 FK 都是 ON DELETE CASCADE,會一路清:
 *         auth.users → profiles → divinations
 *         auth.users → subscriptions
 *         auth.users → credit_transactions
 *   3. 回 200 後由前端 signOut + 導回首頁
 *
 * 註:刻意不做雙重驗證(例如要求再輸入 email),
 * UI 端已經有「打 DELETE 才能送出」的二次確認,這支 API 單純收指令。
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        { ok: false, error: "unauthenticated" },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // deleteUser 會連帶清掉所有 FK cascade 的子表
    const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      console.error("[account/delete] deleteUser failed:", deleteErr);
      return NextResponse.json(
        { ok: false, error: "delete_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[account/delete] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "internal" },
      { status: 500 }
    );
  }
}
