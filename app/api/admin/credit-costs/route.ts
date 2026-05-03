/**
 * GET  /api/admin/credit-costs — 列全部成本(含停用)
 * POST /api/admin/credit-costs — upsert 一筆(主要用來改 amount / 啟停)
 *
 * 寫入用 service_role 繞 RLS;改完強制清 server-side cache 讓變更立刻生效。
 *
 * 提醒:這裡的 id 必須是 lib/credits.ts CREDIT_COSTS 的 key,新加的 key
 *      程式碼端要對應加 import + getCreditCost("NEW_KEY") 才會有效果,
 *      光在 DB 加 row 不會自己生效。
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateCreditCostsCache } from "@/lib/creditCostsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UpsertBody {
  id?: string;
  amount?: number;
  labelZh?: string;
  labelEn?: string;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  category?: string;
  active?: boolean;
  sortOrder?: number;
}

const ID_RE = /^[A-Z][A-Z0-9_]{1,40}$/;

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("credit_costs")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ costs: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const errors: string[] = [];
  if (!body.id || !ID_RE.test(body.id)) {
    errors.push("id 必須是大寫字母開頭 / 字母數字底線,2-41 字");
  }
  if (typeof body.amount !== "number" || !Number.isInteger(body.amount) || body.amount < 0) {
    errors.push("amount 必須是非負整數");
  }
  if (typeof body.amount === "number" && body.amount > 1000) {
    errors.push("amount 不能超過 1000(安全上限,防誤操作)");
  }
  if (typeof body.labelZh !== "string" || !body.labelZh) errors.push("labelZh required");
  if (typeof body.labelEn !== "string" || !body.labelEn) errors.push("labelEn required");

  if (errors.length > 0) {
    return NextResponse.json({ error: "validation", detail: errors }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("credit_costs")
    .upsert({
      id: body.id,
      amount: body.amount,
      label_zh: body.labelZh,
      label_en: body.labelEn,
      description_zh: body.descriptionZh ?? null,
      description_en: body.descriptionEn ?? null,
      category: body.category ?? "general",
      active: body.active ?? true,
      sort_order: body.sortOrder ?? 100,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  // 立即清快取讓改動生效(否則最多要等 60 秒)
  invalidateCreditCostsCache();

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "credit_cost.upsert",
    targetType: "credit_cost",
    targetId: data.id,
    payload: {
      amount: data.amount,
      active: data.active,
    },
  });

  return NextResponse.json({ ok: true, cost: data });
}
