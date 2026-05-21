/**
 * 二擇一占卜共用邏輯 — 文字偵測 + 強建議 prompt 片段。
 *
 * 為什麼存在:使用者問「我該選 A 還是 B」這類二元決策時,AI 解讀容易出現
 * 「兩邊都好兩邊都壞」的水球話,缺乏明確方向。這個 module 提供:
 *
 * 1. detectTwoChoiceQuestion(question) — 用 regex 偵測自由文字裡的二擇一
 *    pattern(中/英/日/韓的「A 還是 B」、「該選哪個」、「A or B」等)。
 * 2. buildDecisionModePrompt(opts) — 回傳一段附加給 system prompt 的強建議
 *    指示。當頁面有結構化的 optionA / optionB 欄位、或自由文字命中偵測時
 *    都套上這段。
 *
 * 用在 /api/divine、/api/tarot,以及 /iching/two-options 入口。
 */
import type { Locale } from "@/i18n/LanguageContext";

/**
 * 命中即視為「二擇一」題,啟動強建議模式。
 * 設計上寧可少抓也不要把單一問題誤判成 2 選 1 — 後者會讓 AI 強行做出
 * 不必要的決斷。
 */
const TWO_CHOICE_PATTERNS: RegExp[] = [
  // 中文(繁/簡):「A 還是 B」「A 還是要 B」「該選 X 還是 Y」
  /[^\s]\s*還是\s*[^\s]/,
  /[^\s]\s*还是\s*[^\s]/,
  /該選哪[一個個]/, /应该选哪[一個个]/,
  /選\s*[ABab]\s*還是\s*選?\s*[ABab]/,
  /选\s*[ABab]\s*还是\s*选?\s*[ABab]/,
  /(該|应该|要)?(選|选)\s*(哪一?個|哪个)/,
  // 英文
  /\b(should|do)\s+i\s+.+\s+or\s+.+\?/i,
  /\b(option|choice)\s*a\b.*\bor\b.*\b(option|choice)\s*b\b/i,
  /\b(a|b)\s+or\s+(a|b)\b/i,
  /\bwhich\s+(one|option|path|choice)\b/i,
  // 日文:「A か B」「A にすべきか B にすべきか」「A or B」
  /[^\s]\s*か\s*[^\s]\s*どちら/,
  /どちら(が|を)/,
  /[Aa]\s*か\s*[Bb]/,
  /[Aa]\s*と\s*[Bb]\s*どっち/,
  // 韓文:「A 아니면 B」「A 와 B 중 어느」
  /[^\s]\s*아니면\s*[^\s]/,
  /[^\s]\s*와\s*[^\s]\s*중\s*(어느|어떤)/,
  /[^\s]\s*과\s*[^\s]\s*중\s*(어느|어떤)/,
  /어느\s*(쪽|것)/,
];

export function detectTwoChoiceQuestion(question: string): boolean {
  if (!question) return false;
  const trimmed = question.trim();
  if (trimmed.length === 0) return false;
  return TWO_CHOICE_PATTERNS.some((re) => re.test(trimmed));
}

export interface DecisionModeOptions {
  /** 使用者明確填的 A 標籤(如有) — 會把它代入指示中,讓 AI 直接用 */
  optionA?: string | null;
  /** 使用者明確填的 B 標籤(如有) */
  optionB?: string | null;
  locale: Locale | "zh" | "en";
}

/**
 * 把「強建議模式」的指示包成 system prompt 附加段。
 *
 * 為什麼放結尾(append):base prompt 已經設定占卜師人設與字數規格,
 * 這段只負責改寫「結論的寫法」,放最後比較不會被前面段落沖掉。
 */
export function buildDecisionModePrompt(opts: DecisionModeOptions): string {
  const { optionA, optionB, locale } = opts;
  const hasLabels = Boolean(optionA && optionB);
  const labelLineZh = hasLabels
    ? `【選項 A】:${optionA}\n【選項 B】:${optionB}\n\n`
    : "";
  const labelLineEn = hasLabels
    ? `[Option A]: ${optionA}\n[Option B]: ${optionB}\n\n`
    : "";
  const labelLineJa = hasLabels
    ? `【選択 A】:${optionA}\n【選択 B】:${optionB}\n\n`
    : "";
  const labelLineKo = hasLabels
    ? `[선택 A]: ${optionA}\n[선택 B]: ${optionB}\n\n`
    : "";

  const aRefZh = hasLabels ? "A" : "其中一邊";
  const bRefZh = hasLabels ? "B" : "另一邊";
  const aRefEn = hasLabels ? "Option A" : "one option";
  const bRefEn = hasLabels ? "Option B" : "the other option";

  if (locale === "ja") {
    return `

━━━━━━━━━━━━━━━━━━━━━━━━━━
${labelLineJa}【二択モード — 必ず守ること】
これは「二択」の意思決定の質問です。回答は次のルールに従ってください:
1. 「両方とも良い / どちらでもよい / あなた次第」のような曖昧な結論は禁止。最後に必ず「どちらか一方を明確に推奨」してください。
2. 卦象の具体的な象徴(内外卦の構成、変爻、之卦の流れ)を根拠として、なぜその選択を推すのかを説明してください。
3. 卦が「動かない方が良い」と示している場合は「保留」を勧めた上で、現状を守るのに適した方を選んでください。
4. 最後の一文は明確な判定で締めくくる。${hasLabels ? "「総合的に判断して、A を選ぶことをお勧めします」または「総合的に判断して、B を選ぶことをお勧めします」のような形。どちらを推すかは卦象のみに基づくこと — A が先に並んでいるからといって習慣的に A に偏らないこと。" : "「総合的に判断して、一方を選ぶことをお勧めします」のような形。"}注意点(「ただし X に気をつけて」)を添えるのは可、ただし結論自体は曖昧にしないこと。
━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  if (locale === "ko") {
    return `

━━━━━━━━━━━━━━━━━━━━━━━━━━
${labelLineKo}[양자택일 모드 — 반드시 따를 것]
이것은 '양자택일' 결정 질문입니다. 답변은 다음 규칙을 따라야 합니다:
1. "둘 다 좋다 / 어느 쪽이든 괜찮다 / 본인 마음" 같은 모호한 결론은 금지합니다. 마지막에 반드시 "한쪽을 명확히 추천"하세요.
2. 괘상의 구체적 상징(내·외괘 구성, 변효, 지괘의 흐름)을 근거로 왜 그쪽을 추천하는지 설명하세요.
3. 괘가 "움직이지 말라"고 시사한다면 '보류'를 권하되 둘 중 현 상태를 보호하는 쪽을 골라 주세요.
4. 마지막 문장은 분명한 판정으로 끝낼 것. ${hasLabels ? '예: "종합적으로 판단할 때 A 를 추천드립니다." 또는 "종합적으로 판단할 때 B 를 추천드립니다." — 어느 쪽을 추천할지는 오로지 괘상에 근거할 것이며, A 가 앞에 나열돼 있다는 이유로 습관적으로 A 로 기울어서는 안 됩니다.' : '예: "종합적으로 판단할 때 한쪽을 추천드립니다."'} 주의사항("단, X 에 유의하세요")을 덧붙이는 것은 좋지만 결론 자체는 흐릿하게 하지 마세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  if (locale === "en") {
    return `

━━━━━━━━━━━━━━━━━━━━━━━━━━
${labelLineEn}[TWO-CHOICE MODE — MUST FOLLOW]
This is a TWO-CHOICE decision question. Your reading MUST obey these rules:
1. Do NOT hedge with "both have merit", "either is fine", "it's up to you", "they're equally valid". You MUST recommend ONE side at the end.
2. Ground the recommendation in concrete hexagram symbolism — inner/outer trigrams, changing lines, the relating hexagram's direction — explain WHY that side is favoured.
3. If the hexagram leans against action, recommend "hold" and identify which of ${aRefEn} / ${bRefEn} better preserves the current ground.
4. Your closing sentence MUST be a clear verdict. E.g. "On balance, I recommend ${aRefEn}." OR "On balance, I recommend ${bRefEn}."${hasLabels ? " — which side wins must come purely from the hexagram, do NOT default to A just because it is listed first." : ""} A caveat ("but watch out for X") is fine — the verdict itself must not be vague.
━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  // 預設中文(繁/簡共用 — 簡中由前端 opencc 轉)
  return `

━━━━━━━━━━━━━━━━━━━━━━━━━━
${labelLineZh}【二擇一模式 — 必須遵守】
這是「二擇一」決策題。你的解讀必須遵守:
1. 嚴禁「兩個都好 / 兩個都不好 / 看你自己 / 各有利弊」這類水球話。結尾必須「明確建議其中一邊」。
2. 用卦象的具體象徵(內外卦結構、變爻、之卦走向)當依據,說明為什麼推這一邊。
3. 若卦象傾向「不利於現在動」,請建議「暫緩」並指出 ${aRefZh} / ${bRefZh} 哪一邊較能保護現況。
4. 最後一句必須是清楚的決斷,例如:${hasLabels ? "「綜合來看,建議你選 A。」或「綜合來看,建議你選 B。」 — 哪一邊勝出完全依卦象判定,不要因為 A 列在前面就習慣性偏 A。" : "「綜合來看,建議你選前者。」或「綜合來看,建議你選後者。」"}可以附帶提醒(「不過要注意 X」),但決斷本身不可模糊。
━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}
