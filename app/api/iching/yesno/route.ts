/**
 * /api/iching/yesno — 易經一卦速答(Yes/No 易經版)
 *
 * 跟 /api/yesno 同 pattern,差別:
 *   - 抽 1 卦 (1..64) 而不是抽 1 張塔羅牌
 *   - verdict 由「卦的吉凶傾向 + 變爻」決定,規則寫死後 AI 只負責解釋
 *   - 同樣扣 CREDIT_COSTS.YESNO (1 點),訪客本路徑允許 1 次免費(由前端限流)
 *
 * 回傳:streaming AI 文字 + X-YesNo-Verdict header
 */

import { NextRequest } from "next/server";
import { getHexagramByNumber, type Hexagram } from "@/data/hexagrams";
import { appendPersonaPrompt } from "@/lib/personas";
import { resolvePersonaServer } from "@/lib/personasDb";
import { createClient } from "@/lib/supabase/server";
import {
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
  CREDIT_COSTS,
} from "@/lib/credits";
import { getCreditCost } from "@/lib/creditCostsDb";
import { withSafetyPreamble } from "@/lib/ai/guardrail";
import { validateUserText } from "@/lib/validateUserText";
import {
  buildGuestFingerprint,
  tryConsumeGuestYesno,
} from "@/lib/guestYesnoLimit";
// Yes/No 是輕量入口,單卦成本最低 — 為防止「Yes/No 刷收集套利」,
// 刻意不接 recordCardObtained。卦象只在 daily / 主流占卜 / 梅花 / 方位 計入收集。

export type YesNoVerdict = "yes" | "no" | "depends";

/**
 * 64 卦的 Yes/No 傾向 — 依卦辭的傳統吉凶判斷分類。
 *
 * STRONG_YES:卦辭明顯吉、亨、利、元等(萬事亨通類)。
 * STRONG_NO :卦辭明顯凶、不利、艱、滯等(困境類)。
 * 其他       :看條件 / depends — 中性卦或需要看變爻才能判定的。
 *
 * 設計原則:寧可 depends 也不要過度承諾。模糊邊界一律降為 depends。
 */
const STRONG_YES = new Set([
  1,  // 乾 (元亨利貞)
  9,  // 小畜 (亨)
  11, // 泰 (吉亨)
  13, // 同人 (亨)
  14, // 大有 (元亨)
  16, // 豫 (利建侯行師)
  19, // 臨 (元亨利貞)
  22, // 賁 (亨)
  24, // 復 (亨)
  25, // 無妄 (元亨利貞)
  26, // 大畜 (利貞)
  31, // 咸 (亨利貞)
  32, // 恆 (亨無咎利貞)
  34, // 大壯 (利貞)
  42, // 益 (利有攸往)
  43, // 夬 (揚于王庭)
  46, // 升 (元亨)
  50, // 鼎 (元吉亨)
  53, // 漸 (女歸吉)
  55, // 豐 (亨)
  58, // 兌 (亨利貞)
  63, // 既濟 (亨小利貞)
]);

const STRONG_NO = new Set([
  3,  // 屯 (勿用)
  6,  // 訟 (終凶)
  7,  // 師 (危險之始)
  12, // 否 (不利君子貞)
  23, // 剝 (不利有攸往)
  28, // 大過 (棟橈)
  29, // 坎 (險)
  33, // 遯 (退避)
  36, // 明夷 (利艱貞)
  39, // 蹇 (難)
  47, // 困 (困)
  64, // 未濟 (尚未完成)
]);

function decideVerdict(hex: Hexagram, hasChangingLine: boolean): YesNoVerdict {
  // 變爻代表狀態流動中,即使是強吉/強凶也降一級成 depends
  if (STRONG_YES.has(hex.number)) return hasChangingLine ? "depends" : "yes";
  if (STRONG_NO.has(hex.number)) return hasChangingLine ? "depends" : "no";
  // 其餘卦象 = 看條件
  return "depends";
}

const VERDICT_LABEL = {
  zh: { yes: "是", no: "否", depends: "看條件" },
  en: { yes: "Yes", no: "No", depends: "It depends" },
  ja: { yes: "はい", no: "いいえ", depends: "条件次第" },
  ko: { yes: "예", no: "아니오", depends: "조건부" },
};

type Locale = "zh" | "en" | "ja" | "ko";
function pickStr(
  locale: Locale,
  zh: string,
  en: string,
  ja?: string | null,
  ko?: string | null
): string {
  if (locale === "en") return en;
  if (locale === "ja") return ja || en;
  if (locale === "ko") return ko || en;
  return zh;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY not configured" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const {
      hexagramNumber,
      hasChangingLine = false,
      question,
      locale,
      personaId,
    }: {
      hexagramNumber: number;
      hasChangingLine?: boolean;
      question: string;
      locale: Locale;
      personaId?: string;
    } = body;
    const safeLocale: Locale =
      locale === "zh" || locale === "ja" || locale === "ko" ? locale : "en";

    const hex = getHexagramByNumber(hexagramNumber);
    if (!hex) {
      return new Response(JSON.stringify({ error: `Unknown hexagram: ${hexagramNumber}` }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    {
      const err = validateUserText(question);
      if (err) return err;
    }

    const verdict = decideVerdict(hex, Boolean(hasChangingLine));
    const verdictLabel = VERDICT_LABEL[safeLocale][verdict];

    // ──────────────────────────────────────────
    // 點數扣款 — 跟塔羅 yes/no 同規則
    // ──────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let isActiveSubscriber = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle();
      isActiveSubscriber = Boolean(profile?.is_active);
    }
    const persona = await resolvePersonaServer(personaId, isActiveSubscriber);
    const cost = await getCreditCost("YESNO");

    // phase 35.7:訪客 server-side 限流 — 用 IP+UA fingerprint 查 DB 表(取代 cookie 方案)
    // 通過則 RPC 已原子寫入該 fingerprint+今日;不通過則 401
    if (!user) {
      const fp = buildGuestFingerprint(request.headers);
      const decision = await tryConsumeGuestYesno(fp);
      if (!decision.allowed) {
        return new Response(
          JSON.stringify({
            error: "GUEST_LIMIT_REACHED",
            reason: decision.reason,
            daysRemaining: decision.daysRemaining,
            message: pickStr(
              safeLocale,
              decision.reason === "used_today"
                ? "你今日已用過免費 Yes/No,明天再來或登入即可繼續"
                : "訪客 10 天免費期已用完,登入即可繼續占卜",
              decision.reason === "used_today"
                ? "Today's free Yes/No is used. Come back tomorrow or sign in."
                : "Guest 10-day free trial is over. Sign in to continue.",
              decision.reason === "used_today"
                ? "本日の無料 Yes/No を使い切りました。明日また、またはログインで続行"
                : "ゲスト 10 日間無料体験が終了しました。ログインで続行",
              decision.reason === "used_today"
                ? "오늘 무료 Yes/No 사용 완료. 내일 또는 로그인하여 계속"
                : "게스트 10일 무료 체험 종료. 로그인하여 계속"
            ),
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (user) {
      try {
        await spendCredits({
          userId: user.id,
          amount: cost,
          reason: "spend_yesno",
          metadata: {
            kind: "iching",
            hexagramNumber,
            verdict,
            locale,
            personaId: persona.id,
          },
        });
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          return new Response(
            JSON.stringify({
              error: "INSUFFICIENT_CREDITS",
              required: cost,
              message: pickStr(
                safeLocale,
                "點數不足",
                "Insufficient credits",
                "ポイント不足",
                "포인트 부족"
              ),
            }),
            { status: 402, headers: { "Content-Type": "application/json" } }
          );
        }
        console.error("[iching/yesno] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
    }

    const hexName = pickStr(safeLocale, hex.nameZh, hex.nameEn, hex.nameJa, hex.nameKo);
    const judgmentModern = pickStr(
      safeLocale,
      hex.judgmentVernacularZh,
      hex.judgmentEn,
      hex.judgmentJa,
      hex.judgmentKo
    );
    const classicalJudgment = hex.judgmentZh;

    const baseSystemPrompt =
      safeLocale === "zh"
        ? `你是一位深諳易經的占卜師,正在做 Yes/No 一卦的快速占卜。系統已根據卦象的傳統吉凶傾向決定了「結論」(${verdictLabel}),你不需要重新判定 yes/no,你的任務是用約 80 字的一段話,自然地解釋「為什麼是這個答案」、「這一卦想提醒問事者什麼」。

開場規則(非常重要):
- 第一句必須直接從卦名、卦象、卦辭、或這次結論的核心切入,禁止使用任何固定的安撫話術做開頭。
- 每次的開場句必須隨抽到的卦與使用者的問題自然變化,絕不可以是模板。
- 禁止以下罐頭開頭(以及任何相近改寫):「沒關係」「先抱抱自己」「親愛的」「別擔心」「深呼吸」「先別急」「我懂你的感覺」「這一卦想告訴你」。
- 同理心可以,但要融進中段或結尾,不要放在第一句。

其他要求:語氣自然口語、使用繁體中文、不要列點、不要重述問題。`
        : safeLocale === "ja"
          ? `あなたは易経に精通した占い師で、Yes/No 一卦の素早い占いをしています。卦象の伝統的な吉凶傾向に基づき、「結論」(${verdictLabel})はシステムが既に決定済み — yes/no を判定し直さないでください。あなたのタスクは約 80 字の段落で、なぜこの答えなのか、この卦が相談者に伝えたいことを説明すること。

書き出しの規則(非常に重要):
- 最初の一文は必ず卦名、卦象、卦辞、または結論の核心から切り込んでください。決まり文句のような慰めの言葉で始めてはいけません。
- 書き出しは引いた卦と質問に応じて毎回自然に変化させ、テンプレートにしないでください。
- 禁止する書き出し(およびそれに近い言い換え):「大丈夫」「深呼吸して」「心配しないで」「ねえ」「この卦があなたに伝えたいのは」。
- 共感は可能ですが、最初の一文ではなく中盤か終盤に置いてください。

その他の要件:会話的な口調で日本語で書き、箇条書きは避け、質問を繰り返さないでください。`
          : safeLocale === "ko"
            ? `당신은 주역에 정통한 점술사로, Yes/No 한 괘 빠른 점을 봐주고 있습니다. 괘상의 전통적인 길흉 경향에 따라 시스템이 이미 "결론"(${verdictLabel})을 결정했습니다 — yes/no를 다시 판단하지 마세요. 당신의 임무는 약 80자 한 문단으로, 왜 이 답인지, 이 괘가 질문자에게 무엇을 일깨우는지 설명하는 것입니다.

시작 규칙(매우 중요):
- 첫 문장은 반드시 괘 이름, 괘상, 괘사, 또는 결론의 핵심에서 바로 시작하세요. 정형화된 위로의 말로 시작해서는 안 됩니다.
- 시작 문장은 뽑힌 괘와 질문에 따라 매번 자연스럽게 달라야 하며, 절대 템플릿이 되어서는 안 됩니다.
- 금지되는 시작 문구(및 비슷한 표현):"괜찮아요" "심호흡하세요" "걱정 마세요" "안녕하세요" "이 괘가 당신에게 말하고 싶은 것은".
- 공감은 가능하지만 첫 문장이 아닌 중간이나 끝에 두세요.

기타: 자연스러운 회화체로 한국어로 쓰고, 글머리 기호는 사용하지 말며, 질문을 다시 말하지 마세요.`
            : `You are an I Ching diviner giving a quick one-hexagram Yes/No reading. The verdict (${verdictLabel}) is already decided by the system based on the traditional auspicious/inauspicious tendency of the hexagram — do NOT re-judge yes/no. Your task: in around 60 words, explain WHY this is the answer and what this hexagram wants to remind the querent.

Opening rules (very important):
- The first sentence MUST go straight into the hexagram's name, image, judgment text, or the heart of the verdict. Do NOT open with any generic comforting line.
- The opening line MUST vary naturally with the drawn hexagram and the question — never a template.
- Forbidden openers (and any close paraphrase): "It's okay", "Take a deep breath", "Don't worry", "Hey there", "Sweetheart", "I hear you", "This hexagram is telling you".
- Empathy is welcome, but bury it in the middle or the end — not in the first sentence.

Other rules: conversational tone in English, no bullets, do not restate the question.`;

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, safeLocale);

    const userMessage =
      safeLocale === "zh"
        ? `問題:${question}\n\n抽到的卦:第 ${hex.number} 卦 ${hex.nameZh}(${hex.nameEn})\n卦辭:${classicalJudgment}\n白話:${judgmentModern}\n\n結論:${verdictLabel}\n\n請用約 80 字解釋這個答案。`
        : safeLocale === "ja"
          ? `質問:${question}\n\n引いた卦:第 ${hex.number} 卦 ${hexName}\n卦辞(原文):${classicalJudgment}\n卦辞(現代訳):${judgmentModern}\n\n結論:${verdictLabel}\n\n約 80 字で、この答えになる理由を説明してください。`
          : safeLocale === "ko"
            ? `질문: ${question}\n\n뽑힌 괘: 제 ${hex.number}괘 ${hexName}\n괘사(원문): ${classicalJudgment}\n괘사(현대 번역): ${judgmentModern}\n\n결론: ${verdictLabel}\n\n약 80자로 이 답이 나온 이유를 설명해 주세요.`
            : `Question: ${question}\n\nDrawn hexagram: ${hex.number}. ${hexName}\nJudgment (classical): ${classicalJudgment}\nJudgment (modern): ${judgmentModern}\n\nVerdict: ${verdictLabel}\n\nPlease explain in ~60 words why.`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: withSafetyPreamble(systemPrompt, safeLocale) },
          { role: "user", content: userMessage },
        ],
        max_tokens: 300,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API error (iching/yesno):", response.status, err);
      if (user) {
        await refundCredits({
          userId: user.id,
          amount: cost,
          errorMessage: `iching/yesno deepseek ${response.status}: ${err.slice(0, 200)}`,
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = response.body!.getReader();

    const readable = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;
              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) controller.enqueue(encoder.encode(content));
              } catch {
                // skip
              }
            }
          }
        } catch (e) {
          console.error("IChing YesNo stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-YesNo-Verdict": verdict,
      },
    });
  } catch (error) {
    console.error("IChing YesNo API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get reading" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
