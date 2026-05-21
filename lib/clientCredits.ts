/**
 * 前端點數系統 helper
 *   - 全站 credits:changed 事件(成功扣點 / 加點後,讓 CreditsBadge 重新抓餘額)
 *   - parseCreditsError: 把 API 回的 402 解析成 { required, message },讓呼叫端決定怎麼顯示
 */

export const CREDITS_CHANGED_EVENT = "credits:changed";

/** 通知全站餘額可能變了 —— Badge 聽到會自動 refetch。 */
export function notifyCreditsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}

export interface InsufficientCreditsInfo {
  required: number;
  message: string;
}

/**
 * 如果 response 是 402 點數不足,解析成 InsufficientCreditsInfo 回傳。
 * 其他狀況回 null(呼叫端自行處理一般錯誤)。
 *
 * ⚠️ 會 clone response 再 parse,避免干擾原本要拿 body 的流程
 */
export async function parseInsufficientCredits(
  response: Response
): Promise<InsufficientCreditsInfo | null> {
  if (response.status !== 402) return null;
  try {
    const cloned = response.clone();
    const data = await cloned.json();
    if (data?.error === "INSUFFICIENT_CREDITS") {
      return {
        required: Number(data.required ?? 0),
        message: String(data.message ?? "Insufficient credits"),
      };
    }
  } catch {
    // fall through — 就算 body 解析失敗也回 null
  }
  return null;
}
