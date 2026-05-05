/**
 * 使用者輸入長度驗證 — 對應前端 UI 上的 maxLength={300} (見 app/page.tsx)。
 *
 * 為什麼需要:HTML maxLength 只擋瀏覽器 UI 路徑,腳本直呼 API 可繞過。
 * 沒這層伺服器端驗證,被人塞 10k 字 prompt 就會把 AI token 成本拉爆。
 *
 * 前端 + API 同走 300 字上限,行為一致。所有接受使用者自由文字的 route
 * (易經 / 塔羅 / yes-no / 二擇一 / 方位卦象合參 / 梅花易數 / 聊天)
 * 解構出 question / option / 訊息文字後就調用 validateUserText 一次封住。
 *
 * 二擇一 A/B 選項標籤的前端上限是 200,但這支 helper 接受 maxLength 參數,
 * 不同欄位可指定不同上限。
 */

export const MAX_USER_QUESTION_LENGTH = 300;

interface ValidateOptions {
  /** 自訂上限,預設 300 */
  maxLength?: number;
  /** 錯誤訊息裡的欄位名稱(英文 / debug 用),預設 'question' */
  field?: string;
  /** 是否允許空字串 — 預設不允許 */
  allowEmpty?: boolean;
}

/**
 * 回傳 null = 通過驗證;否則回傳 400 Response 直接讓 route 早 return。
 * 用法:
 *   const err = validateUserText(question);
 *   if (err) return err;
 */
export function validateUserText(
  text: unknown,
  opts: ValidateOptions = {}
): Response | null {
  const max = opts.maxLength ?? MAX_USER_QUESTION_LENGTH;
  const field = opts.field ?? "question";

  if (typeof text !== "string") {
    return new Response(
      JSON.stringify({ error: `${field} required` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!opts.allowEmpty && text.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: `${field} required` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (text.length > max) {
    return new Response(
      JSON.stringify({
        error: `${field} too long`,
        max,
        received: text.length,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}
