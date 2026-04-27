import { NextRequest } from "next/server";
import { getHexagramByNumber } from "@/data/hexagrams";
import { createClient } from "@/lib/supabase/server";
import {
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
  CREDIT_COSTS,
} from "@/lib/credits";
import { withSafetyPreamble } from "@/lib/ai/guardrail";
import { resolvePersona, appendPersonaPrompt } from "@/lib/personas";

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
      hexagramName,
      changingLines,
      relatingHexagramNumber,
      question,
      category,
      locale,
      // 衍伸問題繼續占卜:上一輪(或更早的 chain)脈絡 + 對話紀錄,讓 AI
      // 能做連貫的解說,不會當成「第一次占卜」重頭敘述。
      previousContext,
      chatHistory,
      // 新增:占卜師人格 + Quick/Deep 模式(向後相容,沒帶就走預設)
      personaId,
      depth,
    }: {
      hexagramNumber: number;
      hexagramName: string;
      changingLines: number[];
      relatingHexagramNumber?: number | null;
      question: string;
      category: string;
      locale: "zh" | "en";
      previousContext?: string | null;
      chatHistory?: { role: "user" | "assistant"; content: string }[] | null;
      personaId?: string;
      depth?: "quick" | "deep";
    } = body;

    const hexagram = getHexagramByNumber(hexagramNumber);
    const relatingHex = relatingHexagramNumber ? getHexagramByNumber(relatingHexagramNumber) : null;
    const isZh = locale === "zh";
    const isFollowUp = Boolean(previousContext && previousContext.trim().length > 0);

    // ──────────────────────────────────────────
    // 點數扣款 — 登入使用者才扣,訪客(未登入)保留現有 1 次免費占卜的漏斗
    // ──────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 訂閱判定 — 解鎖 premium persona + Deep Insight
    let isActiveSubscriber = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle();
      isActiveSubscriber = Boolean(profile?.is_active);
    }
    const effectiveDepth: "quick" | "deep" =
      depth === "deep" && isActiveSubscriber ? "deep" : "quick";
    const persona = resolvePersona(personaId, isActiveSubscriber);

    let cost = isFollowUp ? CREDIT_COSTS.DIVINE_FOLLOWUP : CREDIT_COSTS.DIVINE;
    if (effectiveDepth === "deep") cost += CREDIT_COSTS.DEEP_INSIGHT_SURCHARGE;
    const reason = isFollowUp ? "spend_divine_followup" : "spend_divine";

    if (user) {
      try {
        await spendCredits({
          userId: user.id,
          amount: cost,
          reason,
          metadata: {
            hexagram: hexagramNumber,
            category,
            isFollowUp,
            locale,
            personaId: persona.id,
            depth: effectiveDepth,
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
        console.error("[divine] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
    } else if (isFollowUp) {
      // 訪客不允許衍伸占卜(需要 chain 資料)
      return new Response(
        JSON.stringify({ error: "LOGIN_REQUIRED", message: "Please sign in to continue" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const wordTargetZh = effectiveDepth === "deep" ? "約 500 字" : "約 300 字";
    const wordTargetEn = effectiveDepth === "deep" ? "around 350 words" : "around 150 words";

    const baseSystemPrompt = isZh
      ? (isFollowUp
        ? `你是一位精通易經的占卜師。這是問事者就同一件事所做的「衍伸占卜」——你已經幫他看過前一輪卦象,也跟他在聊天框裡對話過。現在他針對同件事提出更深入的問題,又抽了一卦。請把「前一輪卦象 + 先前對話 + 新卦象」串成連貫的延伸解說,直接呼應前面講過的脈絡(例如:「承接前面提到的...」、「相較先前那卦,這次...」),${wordTargetZh}。卦辭原文系統已顯示,不要重複。使用繁體中文,用段落書寫,不要列點。`
        : `你是一位精通易經的占卜師。卦辭原文與白話翻譯已由系統顯示,不需要重複。你只需針對問事者的問題,結合卦象給出${wordTargetZh}的個人化分析與建議。${effectiveDepth === "deep" ? "Deep Insight 模式 — 請特別分析卦象的內外卦結構、變爻意涵、之卦的銜接、以及對問事者具體可執行的下一步。" : ""}語氣親切、淺顯易懂,使用繁體中文。不要列點,用段落形式書寫。`)
      : (isFollowUp
        ? `You are a wise I Ching consultant. This is a FOLLOW-UP reading on the same matter — you've already read a prior hexagram for this querent and chatted with them about it. They're now asking a deeper question on the same topic and drew a new hexagram. Weave "prior hexagram + earlier conversation + new hexagram" into a coherent continuation, explicitly referencing the prior context ("Building on what we discussed...", "Compared to the earlier hexagram..."). ${wordTargetEn}. Hexagram texts are already shown. Warm, flowing paragraphs, no bullets.`
        : `You are a wise I Ching consultant. The hexagram texts and translations are already shown by the system. Provide a personalized analysis and advice based on the querent's specific question and the hexagram. ${effectiveDepth === "deep" ? "Deep Insight mode — analyse the inner/outer trigram structure, the meaning of changing lines, the relating hexagram's continuation, and concrete actionable next steps." : ""}${wordTargetEn}. Flowing paragraphs, no bullets. Warm and practical.`);

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, locale);

    // 把對話紀錄壓成文字塊放進 user message
    const chatExcerpt = (chatHistory ?? [])
      .slice(-6)
      .map((m) => {
        const who = isZh
          ? (m.role === "user" ? "問事者" : "老師")
          : (m.role === "user" ? "Querent" : "Master");
        return `${who}: ${m.content}`;
      })
      .join("\n");

    const contextBlock = isFollowUp
      ? (isZh
        ? `【前情提要 — 同一件事的先前占卜與對話】\n${previousContext}\n${chatExcerpt ? `\n【先前聊天紀錄(節錄)】\n${chatExcerpt}\n` : ""}\n`
        : `[PRIOR CONTEXT — earlier reading & chat on the same matter]\n${previousContext}\n${chatExcerpt ? `\n[EARLIER CHAT (excerpt)]\n${chatExcerpt}\n` : ""}\n`)
      : "";

    const newQuestionLine = isZh
      ? (isFollowUp ? `新問題(${category}):${question}` : `問題(${category}):${question}`)
      : (isFollowUp ? `New question (${category}): ${question}` : `Question (${category}): ${question}`);

    const userMessage = isZh
      ? `${contextBlock}${newQuestionLine}\n\n本卦:第${hexagramNumber}卦 ${hexagramName}\n卦辭:${hexagram?.judgmentZh}\n象辭:${hexagram?.imageZh}\n${changingLines.length > 0 ? `變爻:第${changingLines.map((l: number) => l + 1).join("、")}爻` : "無變爻"}${relatingHex ? `\n之卦:第${relatingHex.number}卦 ${relatingHex.nameZh}` : ""}\n\n${isFollowUp ? `請承接前面的脈絡,針對我這次的新問題與新卦象,給出連貫的延伸解說,${wordTargetZh}。` : `請直接給出針對我問題的分析與建議,${wordTargetZh}。`}`
      : `${contextBlock}${newQuestionLine}\n\nHexagram ${hexagramNumber}: ${hexagramName}\nJudgment: ${hexagram?.judgmentEn}\nImage: ${hexagram?.imageEn}\n${changingLines.length > 0 ? `Changing lines: ${changingLines.map((l: number) => l + 1).join(", ")}` : "No changing lines"}${relatingHex ? `\nRelating: ${relatingHex.number} - ${relatingHex.nameEn}` : ""}\n\n${isFollowUp ? `Continue from the prior context; weave a coherent follow-up reading for my new question and new hexagram. ${wordTargetEn}.` : `Give me personalized advice for my question, ${wordTargetEn}.`}`;

    // DeepSeek API is OpenAI-compatible
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: withSafetyPreamble(systemPrompt, locale),
          },
          { role: "user", content: userMessage },
        ],
        max_tokens: effectiveDepth === "deep" ? 1400 : 600,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API error:", response.status, err);
      if (user) {
        await refundCredits({
          userId: user.id,
          amount: cost,
          errorMessage: `divine deepseek ${response.status}: ${err.slice(0, 200)}`,
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    // Parse SSE stream from DeepSeek and forward as plain text
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
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // skip malformed JSON chunks
              }
            }
          }
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  } catch (error) {
    console.error("Divine API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get reading" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
