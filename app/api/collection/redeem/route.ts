/**
 * POST /api/collection/redeem
 *
 * 玩家把同一張卡的 10 張重複(obtain_count >= 10)兌換成點數。
 * 比率走 credit_costs CMS(REDEEM_DUPLICATE_RATE),預設 10 點/組。
 *
 * Body:
 *   {
 *     collectionType: 'iching' | 'iching_trigram' | 'tarot',
 *     cardId:         string,           // hexagram '1'..'64' / trigram '111'.. / tarot slug
 *     sets:           number            // 兌換組數,1 組 = 10 張
 *   }
 *
 * Response:
 *   200 { ok: true, countAfter, sets, creditsGranted, newBalance, rate }
 *   400 { error: 'validation' | 'card_not_owned' | 'insufficient_duplicates' | 'redemption_disabled' }
 *   401 { error: 'unauthorized' }
 *   500 { error: 'rpc_error' | 'unexpected' }
 *
 * 審計:
 *   - credit_transactions(由 add_credits 自動寫,reason='redeem_duplicates')
 *   - admin_audit_log(本 route 寫,action='collection.redeem',actor=user 自己)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/admin/audit";
import { getCreditCost } from "@/lib/creditCostsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(["iching", "iching_trigram", "tarot"]);
const SETS_PER_REDEMPTION_UNIT = 10; // 1 set = 10 cards

interface Body {
  collectionType?: string;
  cardId?: string;
  sets?: number;
}

export async function POST(req: NextRequest) {
  // -------- 1. Auth --------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "unauthorized", detail: "not signed in" },
      { status: 401 },
    );
  }

  // -------- 2. Parse + validate body --------
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const errors: string[] = [];
  if (!body.collectionType || !VALID_TYPES.has(body.collectionType)) {
    errors.push("collectionType must be 'iching' | 'iching_trigram' | 'tarot'");
  }
  if (!body.cardId || typeof body.cardId !== "string") {
    errors.push("cardId required");
  }
  if (
    typeof body.sets !== "number" ||
    !Number.isInteger(body.sets) ||
    body.sets < 1 ||
    body.sets > 100
  ) {
    errors.push("sets must be integer in [1, 100]");
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "validation", detail: errors },
      { status: 400 },
    );
  }

  // -------- 3. 取兌換比率(admin 可在 /admin/credit-costs 改) --------
  const rate = await getCreditCost("REDEEM_DUPLICATE_RATE");
  if (rate <= 0) {
    return NextResponse.json(
      {
        error: "redemption_disabled",
        detail: "REDEEM_DUPLICATE_RATE is 0 or disabled",
      },
      { status: 400 },
    );
  }

  // -------- 4. 呼叫 RPC --------
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_duplicate_cards", {
    p_user_id: user.id,
    p_collection_type: body.collectionType!,
    p_card_id: body.cardId!,
    p_sets: body.sets!,
    p_credits_per_set: rate,
  });

  if (error) {
    const msg = error.message ?? "";
    // RPC 自定義 raise (errcode P0001) — 對應到 user-facing 錯誤
    if (msg.includes("CARD_NOT_OWNED")) {
      return NextResponse.json(
        { error: "card_not_owned", detail: "你尚未收藏這張卡" },
        { status: 400 },
      );
    }
    if (msg.includes("INSUFFICIENT_DUPLICATES")) {
      return NextResponse.json(
        {
          error: "insufficient_duplicates",
          detail: `每組需要 ${SETS_PER_REDEMPTION_UNIT} 張重複`,
        },
        { status: 400 },
      );
    }
    if (msg.includes("REDEMPTION_DISABLED")) {
      return NextResponse.json(
        { error: "redemption_disabled", detail: "兌換功能已停用" },
        { status: 400 },
      );
    }
    if (
      msg.includes("INVALID_SETS") ||
      msg.includes("SETS_TOO_LARGE") ||
      msg.includes("INVALID_RATE")
    ) {
      return NextResponse.json(
        { error: "validation", detail: msg },
        { status: 400 },
      );
    }
    console.error("[collection/redeem] RPC error:", error);
    return NextResponse.json(
      { error: "rpc_error", detail: msg },
      { status: 500 },
    );
  }

  const result = data as {
    count_before: number;
    count_after: number;
    sets: number;
    credits_granted: number;
    new_balance: number;
  };

  // -------- 5. Audit log --------
  await writeAuditLog({
    actorId: user.id,
    actorEmail: user.email ?? "",
    action: "collection.redeem",
    targetType: "user_collection",
    targetId: `${body.collectionType}:${body.cardId}`,
    payload: {
      collectionType: body.collectionType,
      cardId: body.cardId,
      sets: result.sets,
      rate,
      creditsGranted: result.credits_granted,
      countBefore: result.count_before,
      countAfter: result.count_after,
      newBalance: result.new_balance,
    },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    countAfter: result.count_after,
    sets: result.sets,
    creditsGranted: result.credits_granted,
    newBalance: result.new_balance,
    rate,
  });
}
