/**
 * 訪客(未登入)Yes/No 占卜每日 1 次限流(client-side)
 *
 * 設計選擇:純 localStorage 不走 server。
 *   - 想繞過 localStorage 的人技術門檻很低,但這類用戶不是商業目標
 *   - server 端 IP rate limit 副作用大(共用 wifi 互相鎖)
 *   - 主要目的是「自然引導未登入用戶轉登入」,不是「徹底防刷」
 *
 * 用法:
 *   - 提交占卜前 → if (!user && !isGuestYesnoAvailableToday()) { 顯示登入 modal; return; }
 *   - 占卜成功後 → if (!user) markGuestYesnoUsed();
 *
 * 「今日」用 Asia/Taipei 日期,跟後端 daily_checkins / get_daily_checkin_status 一致。
 */

const KEY = "guest_yesno_last_used_date";

function todayInTaipei(): string {
  // Intl 格式 en-CA → YYYY-MM-DD
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    // 極舊瀏覽器無 Intl 兜底:用 UTC + 8 hr 偏移
    const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }
}

/** 訪客今日是否還能用免費 yes/no(true=可以,false=已用過) */
export function isGuestYesnoAvailableToday(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const last = localStorage.getItem(KEY);
    return last !== todayInTaipei();
  } catch {
    return true;
  }
}

/** 占卜成功後 call,記錄今日已用(隔天 0:00 Asia/Taipei 自動重置) */
export function markGuestYesnoUsed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, todayInTaipei());
  } catch {
    /* localStorage 被停用(隱身模式) — 略過,不影響功能 */
  }
}
