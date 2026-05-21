/**
 * POST /api/promo/verify — 公開 API
 *
 * Body: { code, kind: "credit_pack" | "subscription", itemId, amount }
 *
 * 回傳:
 *   200 { ok: true, finalAmount, bonusCredits, freeMonths, reason }
 *   400 { ok: false, error, message }
 *   401 { ok: false, error: "unauthorized" }
 *
 * 用於前端在 checkout 前驗證促銷碼。
 * 真正的兌換寫入在 hub webhook 收到付款成功後做(見 recordRedemption)。
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyPromoCode } from "@/lib/promo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  code?: string;
  kind?: "credit_pack" | "subscription";
  itemId?: string;
  amount?: number;
}

export async function POST(req: NextRequest) {
  // 必須登入(避免 brute force 找有效 code)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "請先登入" },
      { status: 401 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "請求格式錯誤" },
      { status: 400 },
    );
  }

  if (!body.code || !body.kind || !body.itemId || typeof body.amount !== "number") {
    return NextResponse.json(
      { ok: false, error: "validation", message: "缺少必填欄位" },
      { status: 400 },
    );
  }

  const result = await verifyPromoCode(body.code, {
    kind: body.kind,
    itemId: body.itemId,
    amount: body.amount,
    userId: user.id,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  // 不要把整個 promo code 物件回給 client(內部 metadata 不需要外露)
  return NextResponse.json({
    ok: true,
    code: result.code.code,
    promoCodeId: result.code.id,
    discountType: result.code.discount_type,
    discountValue: result.code.discount_value,
    finalAmount: result.finalAmount,
    bonusCredits: result.bonusCredits,
    freeMonths: result.freeMonths,
    reason: result.reason,
  });
}
