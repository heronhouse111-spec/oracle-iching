/**
 * 訪客 Yes/No 服務端限流(phase 35.6)
 *
 * 用 HttpOnly cookie 記錄訪客已用過哪幾天(Asia/Taipei),server 在 yesno API
 * 路由內讀+寫,client-side localStorage 只負責 UI hint banner。
 *
 * 為什麼要 server-side:
 *   - client-side localStorage 可被清除、繞過、被瀏覽器快取舊 JS 跳過
 *   - cookie 是 HttpOnly + SameSite=Lax,client console / 舊 bundle 都動不了
 *   - 真正的限流在這裡,client 只是 UI 配合
 *
 * Cookie 設計:
 *   key   = "guest_yn_dates"
 *   value = JSON.stringify(["YYYY-MM-DD", ...])  最多 10 個
 *   maxAge = 60 * 60 * 24 * 60 (60 天,讓使用者下個月再來時舊資料也已過期)
 */

const COOKIE_NAME = "guest_yn_dates";
export const GUEST_YESNO_FREE_DAYS = 10;

function todayInTaipei(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }
}

function parseDates(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s));
  } catch {
    return [];
  }
}

export type GuestLimitDecision =
  | { allowed: true; setCookieValue: string; daysRemaining: number }
  | { allowed: false; reason: "used_today" | "limit_reached"; daysRemaining: number };

/**
 * 讀 cookie 判斷 + 計算新值。caller 收到 allowed=true 後要把 setCookieValue
 * 透過 Response Set-Cookie header 回給 client。
 *
 * 用法(API route):
 *   import { cookies } from "next/headers";
 *   const cookieStore = await cookies();
 *   const raw = cookieStore.get("guest_yn_dates")?.value;
 *   const decision = decideGuestYesnoLimit(raw);
 *   if (!decision.allowed) return 401;
 *   // ... 占卜邏輯 ...
 *   return new Response(stream, {
 *     headers: { "Set-Cookie": buildGuestYesnoCookie(decision.setCookieValue) }
 *   });
 */
export function decideGuestYesnoLimit(rawCookieValue: string | undefined): GuestLimitDecision {
  const dates = parseDates(rawCookieValue);
  const today = todayInTaipei();
  const total = dates.length;
  const daysRemaining = Math.max(0, GUEST_YESNO_FREE_DAYS - total);

  if (dates.includes(today)) {
    return { allowed: false, reason: "used_today", daysRemaining };
  }
  if (total >= GUEST_YESNO_FREE_DAYS) {
    return { allowed: false, reason: "limit_reached", daysRemaining: 0 };
  }

  const newDates = [...dates, today];
  return {
    allowed: true,
    setCookieValue: JSON.stringify(newDates),
    daysRemaining: GUEST_YESNO_FREE_DAYS - newDates.length,
  };
}

/**
 * 建出 Set-Cookie header 字串。HttpOnly + SameSite=Lax + 60 天 maxAge。
 * 注意 production 加 Secure;開發本機不加(沒 HTTPS)。
 */
export function buildGuestYesnoCookie(value: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 60}`, // 60 天
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export const GUEST_YESNO_COOKIE_NAME = COOKIE_NAME;
