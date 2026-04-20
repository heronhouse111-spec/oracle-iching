/**
 * 訪客登入前的「暫存占卜快照」
 *
 * 情境:
 *   訪客在首頁占卜 → 按登入 → OAuth 踢回 /(整個 React state 清光)
 *   → mount 時讀這份 snapshot 把結果頁復原,並把資料補存進 Supabase,讓分享連結可用
 *
 * 存 sessionStorage 而非 localStorage — 只要同一個 tab/視窗內跨頁有效就好;
 * 關掉視窗自然丟掉,不會有 stale snapshot 問題。
 */
export const PENDING_KEY = "oracle:pending-divination";

// 30 分鐘內回來才算有效,避免使用者 OAuth 放棄 → 明天才回來還撿到舊結果
const TTL_MS = 30 * 60 * 1000;

export interface PendingIchingSnapshot {
  hexagramNumber: number;
  primaryLines: number[];
  changingLines: number[];
  relatingLines: number[] | null;
  relatingHexagramNumber: number | null;
}

export interface PendingTarotSlot {
  cardId: string;
  isReversed: boolean;
}

export interface PendingChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PendingDivinationSnapshot {
  v: 1;
  timestamp: number;
  divineType: "iching" | "tarot";
  selectedCategory: string;
  userQuestion: string;
  aiReading: string;
  locale: string;
  iching: PendingIchingSnapshot | null;
  tarot: PendingTarotSlot[] | null;
  // 訪客在結果頁跟老師的對話(可選 — 舊 snapshot 無此欄位也不會炸)。
  // 登入後一併帶回來,讓使用者看到的畫面跟按下登入前一致。
  chatMessages?: PendingChatMessage[];
}

export function savePendingDivination(snap: PendingDivinationSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(snap));
  } catch {
    // quota / disabled — 沒存到也不影響現有體驗,吞掉
  }
}

export function loadPendingDivination(): PendingDivinationSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingDivinationSnapshot;
    if (!parsed || parsed.v !== 1) return null;
    if (Date.now() - parsed.timestamp > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingDivination(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}
