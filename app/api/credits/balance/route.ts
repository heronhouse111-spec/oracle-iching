import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/credits/balance
 * 回登入使用者的點數餘額。未登入回 { balance: null, authenticated: false }。
 *
 * 前端 CreditsBadge 會打這支 API 顯示徽章。
 * 使用者 profiles 表已有 RLS:Users can view own profile —— 直接讀就好,
 * 不需要 admin client(這點跟 spend/add 不一樣)。
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ balance: null, authenticated: false });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("credits_balance, credits_refills_at")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[balance] profile read error:", error);
      return NextResponse.json(
        { balance: null, authenticated: true, error: "read_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      balance: data?.credits_balance ?? 0,
      refillsAt: data?.credits_refills_at ?? null,
      authenticated: true,
    });
  } catch (e) {
    console.error("[balance] unexpected:", e);
    return NextResponse.json({ balance: null, error: "internal" }, { status: 500 });
  }
}
