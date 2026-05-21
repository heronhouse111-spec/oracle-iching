/**
 * 訪客(未登入)Yes/No 占卜免費期限流(client-side, phase 35.5)
 *
 * 規則:
 *   - 訪客累計可免費使用 10 天(每天 1 次,Asia/Taipei 日期)
 *   - 滿 10 天後永久鎖死,必須登入才能繼續
 *   - 想繞過 localStorage 的人技術門檻低,但這類用戶不是商業目標
 *
 * Storage 設計:
 *   localStorage["guest_yesno_used_dates"] = JSON array of "YYYY-MM-DD"
 *     例:["2026-05-01","2026-05-02","2026-05-04"] = 已用 3 天,還剩 7 天
 *   舊版的 "guest_yesno_last_used_date"(單一字串)會在第一次 readDates() 時 migrate 進來
 *
 * 用法:
 *   - 提交占卜前 → const s = getGuestYesnoStatus(); if (!user && !s.available) ...
 *   - 占卜成功後 → if (!user) markGuestYesnoUsed();
 */

const NEW_KEY = "guest_yesno_used_dates";
const LEGACY_KEY = "guest_yesno_last_used_date"; // phase 35 舊 key,做 migration 用

/** 訪客免費期上限 — 改這裡同步影響限流與前端文案插值 */
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

function readDates(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NEW_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
    }
    // Migration:phase 35 的舊單日 key → 推進新 array
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy && /^\d{4}-\d{2}-\d{2}$/.test(legacy)) {
      const migrated = [legacy];
      try {
        localStorage.setItem(NEW_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* 寫失敗只是丟掉 migration,不影響功能 */
      }
      return migrated;
    }
    return [];
  } catch {
    return [];
  }
}

function writeDates(dates: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NEW_KEY, JSON.stringify(dates));
  } catch {
    /* localStorage 被停用(隱身模式) — 略過 */
  }
}

export type GuestYesnoReason = "ok" | "used_today" | "limit_reached";

export interface GuestYesnoStatus {
  /** true=今日可以免費用一次 */
  available: boolean;
  /** 不可用時的原因(available=true 時為 "ok") */
  reason: GuestYesnoReason;
  /** 已用過幾天(0..GUEST_YESNO_FREE_DAYS) */
  daysUsed: number;
  /** 剩幾天免費(0..GUEST_YESNO_FREE_DAYS) */
  daysRemaining: number;
}

/** 給 UI banner 與限流檢查共用 */
export function getGuestYesnoStatus(): GuestYesnoStatus {
  const dates = readDates();
  const today = todayInTaipei();
  const total = dates.length;
  const daysRemaining = Math.max(0, GUEST_YESNO_FREE_DAYS - total);

  if (dates.includes(today)) {
    return { available: false, reason: "used_today", daysUsed: total, daysRemaining };
  }
  if (total >= GUEST_YESNO_FREE_DAYS) {
    return { available: false, reason: "limit_reached", daysUsed: total, daysRemaining: 0 };
  }
  return { available: true, reason: "ok", daysUsed: total, daysRemaining };
}

/** @deprecated 用 getGuestYesnoStatus().available。保留給其他現有 caller 不破。 */
export function isGuestYesnoAvailableToday(): boolean {
  return getGuestYesnoStatus().available;
}

/** 占卜成功後 call;若今日已記則 noop,若已達上限也 noop(防多次呼叫) */
export function markGuestYesnoUsed(): void {
  const dates = readDates();
  const today = todayInTaipei();
  if (dates.includes(today)) return;
  if (dates.length >= GUEST_YESNO_FREE_DAYS) return;
  dates.push(today);
  writeDates(dates);
}
