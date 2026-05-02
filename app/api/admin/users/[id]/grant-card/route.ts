/**
 * POST /api/admin/users/[id]/grant-card
 *
 * Admin 手動贈卡(客服救人:用戶反映「我抽到了但收藏沒記到」→ 補一張)。
 *
 * 注意:
 *   - source 強制為 'admin_grant',record_card_obtained 函數會跳過里程碑判定,
 *     不會幫客服 / admin 自動發 credits → 防止刷獎
 *   - 必填 reason ≥ 4 字 + 全部進 admin_audit_log
 *
 * Body:
 *   {
 *     collectionType: "iching" | "tarot",
 *     cardId: string,         // iching: '1'..'64'  / tarot: card slug
 *     cardSubkind?: string,   // tarot 必填:'major'|'wands'|'cups'|'swords'|'pentacles'
 *     reason: string          // ≥ 4 字
 *   }
 *
 * Response:
 *   200 { ok: true, isNew, distinctCount }
 *   400 { error: "validation", detail: [...] }
 *   401/403/500
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { recordCardObtained } from "@/lib/cardCollection";
import { hexagrams } from "@/data/hexagrams";
import { tarotDeck } from "@/data/tarot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  collectionType?: "iching" | "tarot";
  cardId?: string;
  cardSubkind?: string;
  reason?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  const { id: targetUserId } = await params;
  if (!targetUserId) {
    return NextResponse.json({ error: "missing_user_id" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const errors: string[] = [];
  if (body.collectionType !== "iching" && body.collectionType !== "tarot")
    errors.push("collectionType must be 'iching' or 'tarot'");
  if (!body.cardId || typeof body.cardId !== "string")
    errors.push("cardId required");
  if (!body.reason || body.reason.trim().length < 4)
    errors.push("reason required (≥ 4 chars)");

  // 驗 cardId 真的存在於對應的 deck/hexagrams,避免亂寫
  let derivedSubkind: string | null = null;
  if (body.collectionType === "iching" && body.cardId) {
    const n = parseInt(body.cardId, 10);
    if (!Number.isInteger(n) || n < 1 || n > 64) {
      errors.push("iching cardId must be '1'..'64'");
    } else if (!hexagrams.find((h) => h.number === n)) {
      errors.push(`hexagram ${n} not found`);
    }
  } else if (body.collectionType === "tarot" && body.cardId) {
    const card = tarotDeck.find((c) => c.id === body.cardId);
    if (!card) {
      errors.push(`tarot card '${body.cardId}' not found`);
    } else {
      derivedSubkind = card.suit;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "validation", detail: errors },
      { status: 400 },
    );
  }

  const result = await recordCardObtained({
    userId: targetUserId,
    collectionType: body.collectionType!,
    cardId: body.cardId!,
    cardSubkind: derivedSubkind as "major" | "wands" | "cups" | "swords" | "pentacles" | null,
    source: "admin_grant",
  });

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "collection.grant_card",
    targetType: "user",
    targetId: targetUserId,
    payload: {
      collectionType: body.collectionType,
      cardId: body.cardId,
      reason: body.reason,
      isNew: result.isNew,
      distinctCount: result.distinctCount,
    },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    isNew: result.isNew,
    distinctCount: result.distinctCount,
  });
}
