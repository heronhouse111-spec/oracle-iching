import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/account/merge
 *
 * 把「來源帳號 B」的點數/訂閱/紀錄合併進「目前登入的帳號 A」,然後停用 B。
 * 設計依據:ACCOUNT_MERGE_DESIGN.md。
 *
 * 為什麼要收兩個 token:
 *   Supabase 瀏覽器端一次只有一個 session,登入 B 會蓋掉 A。
 *   所以前端先暫存 A 的 session,登入 B 拿到 B 的 access token,
 *   把 B 的 token 放 body 送來;A 則照常從 cookie session 讀。
 *   後端兩邊都驗證有效,才以 A=keep、B=source 執行合併。
 *
 * 流程:
 *   1. 功能旗標 ACCOUNT_MERGE_ENABLED 必須為 "true"(預設關閉,未測完不開)
 *   2. 從 cookie 讀 A(keep);沒有 → 401
 *   3. 用 admin client 驗證 body.sourceAccessToken → B(source);無效 → 400
 *   4. 擋 A==B、擋已合併過
 *   5. admin.rpc('merge_accounts', {p_keep, p_source, p_keep_subscription})
 *   6. 刪除 B 的 auth user(資料已搬走,FK cascade 清掉殘餘)
 *   7. 回傳 source provider,前端據此把該 provider 重新 link 到 A
 *
 * ⚠️ 未被選中的「金流訂閱取消」尚未接(見下方 TODO)。在接好之前,
 *    若雙方都有 active 訂閱,合併後請人工到金流後台取消未保留的那份。
 */
export async function POST(request: Request) {
  // 1. 功能旗標 —— 預設關閉,避免未測完就開放
  if (process.env.ACCOUNT_MERGE_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "feature_disabled" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      sourceAccessToken?: string;
      keepSubscription?: "keep" | "source";
    };
    const sourceAccessToken = body.sourceAccessToken?.trim();
    const keepSubscription = body.keepSubscription === "source" ? "source" : "keep";

    if (!sourceAccessToken) {
      return NextResponse.json({ ok: false, error: "missing_source_token" }, { status: 400 });
    }

    // 2. A = 目前登入帳號(keep)
    const supabase = await createClient();
    const {
      data: { user: keepUser },
      error: keepErr,
    } = await supabase.auth.getUser();
    if (keepErr || !keepUser) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 3. B = 來源帳號(source)—— 用 admin client 驗證 B 的 access token
    const {
      data: { user: sourceUser },
      error: sourceErr,
    } = await admin.auth.getUser(sourceAccessToken);
    if (sourceErr || !sourceUser) {
      return NextResponse.json({ ok: false, error: "invalid_source_token" }, { status: 400 });
    }

    // 4. 防呆
    if (sourceUser.id === keepUser.id) {
      return NextResponse.json({ ok: false, error: "same_account" }, { status: 400 });
    }

    // 來源帳號的登入方式(供前端合併後重新綁定到 A)
    const sourceProvider =
      sourceUser.app_metadata?.provider ??
      sourceUser.identities?.[0]?.provider ??
      null;

    // 5. 資料層合併(交易在 SQL function 內保證原子性)
    const { data: mergeResult, error: mergeErr } = await admin.rpc("merge_accounts", {
      p_keep: keepUser.id,
      p_source: sourceUser.id,
      p_keep_subscription: keepSubscription,
    });
    if (mergeErr) {
      console.error("[account/merge] merge_accounts rpc failed:", mergeErr);
      return NextResponse.json(
        { ok: false, error: "merge_failed", detail: mergeErr.message },
        { status: 500 }
      );
    }

    // TODO(金流訂閱取消):若 keepSubscription 選擇導致某一份 active 訂閱被放棄,
    //   這裡要呼叫對應金流(LINE Pay / ECPay / 藍新)的取消 API,避免雙重扣款。
    //   Apple IAP / Google Play 採「還原購買」,不在此處理。
    //   接好前:雙方都有 active 訂閱時,需人工到金流後台取消未保留的那份。

    // 6. 刪除來源 auth user(資料已搬走;FK cascade 會清掉 B 殘餘列)
    const { error: delErr } = await admin.auth.admin.deleteUser(sourceUser.id);
    if (delErr) {
      // 合併已成功,只是 B 沒刪乾淨 —— 不回失敗,但要記錄供人工清理
      console.error("[account/merge] source deleteUser failed (merge already done):", delErr);
    }

    return NextResponse.json({
      ok: true,
      merge: mergeResult,
      // 前端拿這個 provider 對 A 呼叫 linkIdentity,讓之後用該方式登入會認得 A
      sourceProvider,
    });
  } catch (e) {
    console.error("[account/merge] unexpected:", e);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
