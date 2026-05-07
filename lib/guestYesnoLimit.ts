/**
 * 訪客 Yes/No DB 限流(phase 35.7)
 *
 * 取代 phase 35.6 的 cookie 方案 — Vercel streaming response + supabase auth
 * middleware 把 Set-Cookie 吃掉,cookie 從未真的寫進瀏覽器。
 *
 * 新方案:server 用 sha256(ip + ua) 當 fingerprint,記在 guest_yesno_log 表。
 * 完全不依賴瀏覽器 cookie,只看 server 端能拿到的 request headers。
 *
 * Trade-off:
 *   - 共用 IP 的用戶(咖啡廳 / NAT)會互相鎖,但 UA 通常會差(不同瀏覽器 / 裝置)
 *   - 對個人來說很穩 — 同一台裝置同瀏覽器的累計就是公平地 10 天
 *   - DB hiccup → fail-open(允許 + 記 warning),不要因此擋死整個訪客流量
 */

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const GUEST_YESNO_FREE_DAYS = 10;

export type GuestYesnoReason = "ok" | "used_today" | "limit_reached";

export interface GuestYesnoCheck {
  allowed: boolean;
  reason: GuestYesnoReason;
  daysRemaining: number;
  /** 純查詢時才有(banner 用) */
  usedToday?: boolean;
}

/**
 * 從 request headers 取出 client IP。優先順序:
 *   x-vercel-forwarded-for(Vercel 給的,最可靠)
 *   x-forwarded-for(標準 proxy header,取第一個 IP)
 *   x-real-ip
 * 都沒有就回 "unknown",server 仍會記錄但所有 unknown 共用同一個 fingerprint
 * (適度防刷,即使代理隱身也不能無限刷)
 */
function getClientIp(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]?.trim() || vercel;
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || xff;
  const real = headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

/**
 * 產生 fingerprint:sha256(ip + ua)。
 * UA 截 200 字避免極端長度噪音(主要識別位元在前段)。
 */
export function buildGuestFingerprint(headers: Headers): string {
  const ip = getClientIp(headers);
  const ua = (headers.get("user-agent") || "unknown").slice(0, 200);
  return crypto.createHash("sha256").update(`${ip}::${ua}`).digest("hex");
}

/**
 * 嘗試消耗一次訪客配額。RPC 內原子寫入,
 * 並發兩請求只會 insert 成功一筆但兩個都會被允許(罕見 race,可接受)。
 *
 * DB hiccup → fail-open(回 allowed: true)避免全站擋死訪客。
 */
export async function tryConsumeGuestYesno(
  fingerprint: string
): Promise<GuestYesnoCheck> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("try_consume_guest_yesno", {
      p_fingerprint: fingerprint,
    });
    if (error) {
      console.error("[guestYesnoLimit] try_consume failed", error);
      return { allowed: true, reason: "ok", daysRemaining: GUEST_YESNO_FREE_DAYS };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { allowed: true, reason: "ok", daysRemaining: GUEST_YESNO_FREE_DAYS };
    }
    return {
      allowed: Boolean(row.allowed),
      reason: (row.reason as GuestYesnoReason) ?? "ok",
      daysRemaining: row.days_remaining ?? 0,
    };
  } catch (e) {
    console.error("[guestYesnoLimit] try_consume threw", e);
    return { allowed: true, reason: "ok", daysRemaining: GUEST_YESNO_FREE_DAYS };
  }
}

/** 純查詢(不消耗)— 給 banner / status endpoint 用 */
export async function getGuestYesnoStatus(
  fingerprint: string
): Promise<GuestYesnoCheck> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_guest_yesno_status", {
      p_fingerprint: fingerprint,
    });
    if (error) {
      console.error("[guestYesnoLimit] get_status failed", error);
      return {
        allowed: true,
        reason: "ok",
        daysRemaining: GUEST_YESNO_FREE_DAYS,
        usedToday: false,
      };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return {
        allowed: true,
        reason: "ok",
        daysRemaining: GUEST_YESNO_FREE_DAYS,
        usedToday: false,
      };
    }
    return {
      allowed: Boolean(row.allowed),
      reason: (row.reason as GuestYesnoReason) ?? "ok",
      daysRemaining: row.days_remaining ?? 0,
      usedToday: Boolean(row.used_today),
    };
  } catch (e) {
    console.error("[guestYesnoLimit] get_status threw", e);
    return {
      allowed: true,
      reason: "ok",
      daysRemaining: GUEST_YESNO_FREE_DAYS,
      usedToday: false,
    };
  }
}
