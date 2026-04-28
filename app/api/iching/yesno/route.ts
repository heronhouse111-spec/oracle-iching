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
import { withSafetyPreamble } from "@/lib/ai/guardrail";

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
};

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
      locale: "zh" | "en";
      personaId?: string;
    } = body;

    const hex = getHexagramByNumber(hexagramNumber);
    if (!hex) {
      return new Response(JSON.stringify({ error: `Unknown hexagram: ${hexagramNumber}` }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    if (typeof question !== "string" || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Question required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const isZh = locale === "zh";
    const verdict = decideVerdict(hex, Boolean(hasChangingLine));
    const verdictLabel = isZh ? VERDICT_LABEL.zh[verdict] : VERDICT_LABEL.en[verdict];

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
    const cost = CREDIT_COSTS.YESNO;

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
              message: isZh ? "點數不足" : "Insufficient credits",
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

    const hexName = isZh ? hex.nameZh : hex.nameEn;
    const judgment = isZh ? hex.judgmentVernacularZh : hex.judgmentEn;
    const classicalJudgment = hex.judgmentZh;

    const baseSystemPrompt = isZh
      ? `你是一位深諳易經的占卜師,正在做 Yes/No 一卦的快速占卜。系統已根據卦象的傳統吉凶傾向決定了「結論」(${verdictLabel}),你不需要重新判定 yes/no,你的任務是用約 80 字的一段話,溫暖地解釋「為什麼是這個答案」、「這一卦想提醒問事者什麼」。語氣自然口語,使用繁體中文,不要列點。先別重述問題,直接給出解釋。`
      : `You are an I Ching diviner giving a quick one-hexagram Yes/No reading. The verdict (${verdictLabel}) is already decided by the system based on the traditional auspicious/inauspicious tendency of the hexagram — do NOT re-judge yes/no. Your task: in around 60 words, warmly explain WHY this is the answer and what this hexagram wants to remind the querent. Conversational tone, no bullets.`;

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, locale);

    const userMessage = isZh
      ? `問題:${question}\n\n抽到的卦:第 ${hex.number} 卦 ${hex.nameZh}(${hex.nameEn})\n卦辭:${classicalJudgment}\n白話:${judgment}\n\n結論:${verdictLabel}\n\n請用約 80 字解釋這個答案。`
      : `Question: ${question}\n\nDrawn hexagram: ${hex.number}. ${hexName}\nJudgment (classical): ${classicalJudgment}\nJudgment (modern): ${judgment}\n\nVerdict: ${verdictLabel}\n\nPlease explain in ~60 words why.`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: withSafetyPreamble(systemPrompt, locale) },
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
