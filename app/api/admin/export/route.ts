/**
 * GET /api/admin/export?type=users|divinations|grants|redemptions|audit
 *
 * 直接回傳 CSV(text/csv,UTF-8 BOM,Excel 可開)。
 * Browser 收到自動觸發下載(Content-Disposition: attachment)。
 */

import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";
import { rowsToCsv, csvResponse } from "@/lib/admin/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportType = "users" | "divinations" | "grants" | "redemptions" | "audit";

export async function GET(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") ?? "users") as ExportType;

  const supabase = await createClient();
  const ts = new Date().toISOString().slice(0, 10);

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: `export.${type}`,
    targetType: "csv",
  });

  switch (type) {
    case "users": {
      const { data } = await supabase
        .from("admin_users_view")
        .select(
          "id, email, signed_up_at, last_sign_in_at, display_name, preferred_locale, role, banned, banned_reason",
        )
        .order("signed_up_at", { ascending: false });
      const csv = rowsToCsv(
        ["UID", "Email", "註冊日", "上次登入", "顯示名", "語系", "角色", "是否封鎖", "封鎖原因"],
        (data ?? []).map((u: Record<string, unknown>) => [
          u.id as string,
          u.email as string,
          u.signed_up_at as string,
          (u.last_sign_in_at as string) ?? "",
          (u.display_name as string) ?? "",
          (u.preferred_locale as string) ?? "",
          (u.role as string) ?? "user",
          u.banned ? "是" : "",
          (u.banned_reason as string) ?? "",
        ]),
      );
      return csvResponse(`tarogram_users_${ts}.csv`, csv);
    }

    case "divinations": {
      const { data } = await supabase
        .from("divinations")
        .select("id, user_id, question, category, divine_type, hexagram_number, locale, created_at")
        .order("created_at", { ascending: false })
        .limit(10000);
      const csv = rowsToCsv(
        ["ID", "User ID", "問題", "類別", "占卜類型", "卦號", "語系", "時間"],
        (data ?? []).map((d: Record<string, unknown>) => [
          d.id as string,
          (d.user_id as string) ?? "",
          (d.question as string) ?? "",
          (d.category as string) ?? "",
          (d.divine_type as string) ?? "",
          (d.hexagram_number as number) ?? "",
          (d.locale as string) ?? "",
          d.created_at as string,
        ]),
      );
      return csvResponse(`tarogram_divinations_${ts}.csv`, csv);
    }

    case "grants": {
      const { data } = await supabase
        .from("credit_grants")
        .select(
          "id, user_id, delta, balance_after, reason, granted_by_email, related_order_mtn, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(10000);
      const csv = rowsToCsv(
        ["ID", "User ID", "點數變動", "事後餘額", "原因", "操作者", "相關訂單", "時間"],
        (data ?? []).map((g: Record<string, unknown>) => [
          g.id as number,
          g.user_id as string,
          g.delta as number,
          g.balance_after as number,
          (g.reason as string) ?? "",
          (g.granted_by_email as string) ?? "",
          (g.related_order_mtn as string) ?? "",
          g.created_at as string,
        ]),
      );
      return csvResponse(`tarogram_credit_grants_${ts}.csv`, csv);
    }

    case "redemptions": {
      const { data } = await supabase
        .from("promo_code_redemptions")
        .select("id, promo_code_id, user_id, merchant_trade_no, applied_amount, applied_to, redeemed_at")
        .order("redeemed_at", { ascending: false })
        .limit(10000);
      const csv = rowsToCsv(
        ["ID", "促銷碼 ID", "User ID", "訂單編號", "折抵金額", "適用對象", "兌換時間"],
        (data ?? []).map((r: Record<string, unknown>) => [
          r.id as number,
          r.promo_code_id as number,
          r.user_id as string,
          (r.merchant_trade_no as string) ?? "",
          (r.applied_amount as number) ?? "",
          (r.applied_to as string) ?? "",
          r.redeemed_at as string,
        ]),
      );
      return csvResponse(`tarogram_redemptions_${ts}.csv`, csv);
    }

    case "audit": {
      const { data } = await supabase
        .from("admin_audit_log")
        .select("id, actor_email, action, target_type, target_id, payload, created_at")
        .order("created_at", { ascending: false })
        .limit(10000);
      const csv = rowsToCsv(
        ["ID", "操作者", "動作", "對象類型", "對象 ID", "Payload (JSON)", "時間"],
        (data ?? []).map((a: Record<string, unknown>) => [
          a.id as number,
          (a.actor_email as string) ?? "",
          (a.action as string) ?? "",
          (a.target_type as string) ?? "",
          (a.target_id as string) ?? "",
          JSON.stringify(a.payload ?? {}),
          a.created_at as string,
        ]),
      );
      return csvResponse(`tarogram_audit_${ts}.csv`, csv);
    }

    default:
      return new Response("Unknown export type", { status: 400 });
  }
}
