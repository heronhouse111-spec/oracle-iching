import { NextRequest } from "next/server";
import { getCardById, THREE_CARD_POSITIONS, SUIT_NAMES_ZH, SUIT_NAMES_EN } from "@/data/tarot";
import { createClient } from "@/lib/supabase/server";
import {
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
  CREDIT_COSTS,
} from "@/lib/credits";
import { withSafetyPreamble } from "@/lib/ai/guardrail";

// 客戶端送來的「抽牌結果」
interface DrawnCardRequest {
  cardId: string;
  position: "past" | "present" | "future";
  isReversed: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const {
      cards,
      question,
      category,
      locale,
      // 衍伸問題繼續占卜(跟 /api/divine 同樣的機制)
      previousContext,
      chatHistory,
    }: {
      cards: DrawnCardRequest[];
      question: string;
      category: string;
      locale: "zh" | "en";
      previousContext?: string | null;
      chatHistory?: { role: "user" | "assistant"; content: string }[] | null;
    } = body;

    if (!Array.isArray(cards) || cards.length !== 3) {
      return new Response(JSON.stringify({ error: "Must provide exactly 3 cards" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 把每張卡的 id 查回完整資料(避免信任客戶端自己帶的牌義)
    const enriched = cards.map((c) => {
      const card = getCardById(c.cardId);
      const posMeta = THREE_CARD_POSITIONS.find((p) => p.key === c.position);
      return { ...c, card, posMeta };
    });

    for (const e of enriched) {
      if (!e.card || !e.posMeta) {
        return new Response(
          JSON.stringify({ error: `Unknown card id or position: ${e.cardId} / ${e.position}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const isZh = locale === "zh";
    const isFollowUp = Boolean(previousContext && previousContext.trim().length > 0);

    // ──────────────────────────────────────────
    // 點數扣款(登入者才扣,訪客維持 1 次免費占卜的漏斗)
    // ──────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const cost = isFollowUp ? CREDIT_COSTS.TAROT_FOLLOWUP : CREDIT_COSTS.TAROT;
    const reason = isFollowUp ? "spend_tarot_followup" : "spend_tarot";

    if (user) {
      try {
        await spendCredits({
          userId: user.id,
          amount: cost,
          reason,
          metadata: {
            category,
            isFollowUp,
            locale,
            cards: cards.map((c) => ({ id: c.cardId, pos: c.position, rev: c.isReversed })),
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
        console.error("[tarot] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
    } else if (isFollowUp) {
      return new Response(
        JSON.stringify({ error: "LOGIN_REQUIRED", message: "Please sign in to continue" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = isZh
      ? (isFollowUp
        ? `你是一位深諳塔羅的占卜師。這是問事者就同一件事所做的「衍伸占卜」——你已經幫他做過前一輪(易經或塔羅)的解盤,也跟他在聊天框裡對話過。現在他針對同件事提出更深入的問題,又抽了三張牌(過去-現在-未來)。請把「前一輪結果 + 先前對話 + 新三張牌」串成連貫的延伸解說,直接呼應前面講過的脈絡(例如「承接剛才我們談到的...」、「相較先前那卦/那次抽牌,這三張牌...」),約300字。每張牌的牌義系統已提供,不要逐張複述。使用繁體中文,用段落書寫,不要列點。`
        : `你是一位深諳塔羅的占卜師。使用者用三張牌陣(過去-現在-未來)針對一個問題占卜。每張牌的牌義(正位/逆位)已由系統提供,你**不需要重複牌義**,而是要把三張牌串成一個針對問事者具體問題的連貫故事,並給出實際可行的建議。語氣溫暖、貼近生活。約 300 字,用段落書寫,不要列點。使用繁體中文。`)
      : (isFollowUp
        ? `You are a skilled tarot reader. This is a FOLLOW-UP reading on the same matter — you've already read a prior reading for this querent (I Ching or tarot) and chatted with them. They're asking a deeper question on the same topic and drew three new cards (past-present-future). Weave "prior result + earlier conversation + new three cards" into a coherent continuation, explicitly referencing the prior context ("Building on what we discussed...", "Compared to the earlier reading, these three cards..."). Around 150 words. Card meanings are already provided — don't restate each one. Warm flowing paragraphs, no bullets.`
        : `You are a skilled tarot reader. The querent drew three cards in a past-present-future spread for a specific question. The card meanings (upright/reversed) are provided by the system — do NOT simply repeat them. Instead, weave the three cards into a coherent narrative about the querent's actual question and give practical, concrete advice. Warm tone, around 150 words, flowing paragraphs (no bullets).`);

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

    // 組裝 user message — 含問題 + 三張牌各自位置/名稱/正逆位/牌義
    const cardDescriptions = enriched
      .map((e) => {
        const card = e.card!;
        const pos = e.posMeta!;
        const suitZh = SUIT_NAMES_ZH[card.suit];
        const suitEn = SUIT_NAMES_EN[card.suit];
        const meaning = e.isReversed
          ? (isZh ? card.reversedMeaningZh : card.reversedMeaningEn)
          : (isZh ? card.uprightMeaningZh : card.uprightMeaningEn);
        const orientationZh = e.isReversed ? "逆位" : "正位";
        const orientationEn = e.isReversed ? "Reversed" : "Upright";
        if (isZh) {
          return `【${pos.labelZh}】${card.nameZh}(${suitZh}・${orientationZh})\n牌義:${meaning}`;
        }
        return `[${pos.labelEn}] ${card.nameEn} (${suitEn}, ${orientationEn})\nMeaning: ${meaning}`;
      })
      .join("\n\n");

    const newQuestionLine = isZh
      ? (isFollowUp ? `新問題(${category}):${question}` : `問題(${category}):${question}`)
      : (isFollowUp ? `New question (${category}): ${question}` : `Question (${category}): ${question}`);

    const userMessage = isZh
      ? `${contextBlock}${newQuestionLine}\n\n這次抽到的三張牌:\n\n${cardDescriptions}\n\n${isFollowUp ? "請承接前面的脈絡,針對我這次的新問題與這三張新牌,給出連貫的延伸解說,約 300 字。" : "請把這三張牌串成一個連貫的故事,回應我的具體問題,並給出實際可行的建議,約 300 字。"}`
      : `${contextBlock}${newQuestionLine}\n\nThree cards drawn this round:\n\n${cardDescriptions}\n\n${isFollowUp ? "Continue from the prior context; weave a coherent follow-up reading from these three new cards for my new question. Around 150 words." : "Weave these three cards into a coherent narrative addressing my specific question, with practical advice. Around 150 words."}`;

    // DeepSeek API is OpenAI-compatible
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
        max_tokens: 600,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API error (tarot):", response.status, err);
      if (user) {
        await refundCredits({
          userId: user.id,
          amount: cost,
          errorMessage: `tarot deepseek ${response.status}: ${err.slice(0, 200)}`,
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse SSE stream from DeepSeek and forward as plain text(跟 /api/divine 同一套邏輯)
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
          console.error("Tarot stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  } catch (error) {
    console.error("Tarot API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get tarot reading" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
