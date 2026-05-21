/**
 * Admin audit log writer
 *
 * 所有 admin 寫入操作都呼叫 writeAuditLog() 留下審計線索。
 * 用 service_role 客戶端寫(繞過 RLS,因為 admin_audit_log 沒開放 client INSERT)。
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditLogEntry {
  actorId: string;
  actorEmail: string;
  action: string; // e.g. 'credits.grant', 'pricing.update', 'announcement.create'
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("admin_audit_log").insert({
    actor_id: entry.actorId,
    actor_email: entry.actorEmail,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    payload: entry.payload ?? {},
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
  });

  if (error) {
    // log 失敗不應該擋住主流程,但要寫到 console
    console.error("[audit] failed to write log:", error.message, entry);
  }
}
