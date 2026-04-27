import { NextRequest } from "next/server";
import { getCardById, SUIT_NAMES_ZH, SUIT_NAMES_EN } from "@/data/tarot";
import { getSpread, type Spread } from "@/data/spreads";
import { resolvePersona, appendPersonaPrompt } from "@/lib/personas";
import { createClient } from "@/lib/supabase/server";
import {
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
  CREDIT_COSTS,
} from "@/lib/credits";
import { withSafetyPreamble } from "@/lib/ai/guardrail";

// 客戶端送來的「抽牌結果」— position 改為任意 string,給多牌陣用
interface DrawnCardRequest {
  cardId: string;
  position: string;
  isReversed: boolean;
}

/**
 * 多牌陣加價表 — cardCount → cost
 * 3 卡走原本 TAROT(5),5/10/12 卡各自獨立費率(避免一張卡都加 1 點不夠勸退濫用)
 */
function tarotCostFor(spread: Spread, isFollowUp: boolean): number {
  if (isFollowUp) return CREDIT_COSTS.TAROT_FOLLOWUP;
  switch (spread.cardCount) {
    case 3: return CREDIT_COSTS.TAROT;
    case 5: return CREDIT_COSTS.TAROT_5_CARD;
    case 10: return CREDIT_COSTS.TAROT_10_CARD;
    case 12: return CREDIT_COSTS.TAROT_12_CARD;
    default: return CREDIT_COSTS.TAROT;
  }
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
      // 新增 — 預設 three-card 維持向後相容
      spreadId,
      personaId,
      depth,
    }: {
      cards: DrawnCardRequest[];
      question: string;
      category: string;
      locale: "zh" | "en";
      previousContext?: string | null;
      chatHistory?: { role: "user" | "assistant"; content: string }[] | null;
      spreadId?: string;
      personaId?: string;
      depth?: "quick" | "deep";
    } = body;

    const spread = getSpread(spreadId);
    const isDeep = depth === "deep";

    if (!Array.isArray(cards) || cards.length !== spread.cardCount) {
      return new Response(
        JSON.stringify({
          error: `Spread ${spread.id} requires exactly ${spread.cardCount} cards (got ${
            Array.isArray(cards) ? cards.length : "non-array"
          })`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 把每張卡的 id + position 查回完整資料(不信任客戶端帶的牌義)
    const enriched = cards.map((c) => {
      const card = getCardById(c.cardId);
      const posMeta = spread.positions.find((p) => p.key === c.position);
      return { ...c, card, posMeta };
    });

    for (const e of enriched) {
      if (!e.card || !e.posMeta) {
        return new Response(
          JSON.stringify({
            error: `Unknown card id or position for spread ${spread.id}: ${e.cardId} / ${e.position}`,
          }),
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

    // 訂閱判定 — 給 persona 解鎖 + Deep Insight 解鎖判斷用
    let isActiveSubscriber = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle();
      isActiveSubscriber = Boolean(profile?.is_active);
    }

    // Deep Insight 限訂閱戶 — 非訂閱戶傳 deep 自動降級為 quick
    const effectiveDepth: "quick" | "deep" =
      isDeep && isActiveSubscriber ? "deep" : "quick";

    // Persona — premium 人格在非訂閱戶會自動退回 default
    const persona = resolvePersona(personaId, isActiveSubscriber);

    let cost = tarotCostFor(spread, isFollowUp);
    if (effectiveDepth === "deep") cost += CREDIT_COSTS.DEEP_INSIGHT_SURCHARGE;
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
            spreadId: spread.id,
            personaId: persona.id,
            depth: effectiveDepth,
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
    } else if (spread.cardCount > 3) {
      // 訪客不能跑大牌陣(避免吃資源 + 引導註冊)
      return new Response(
        JSON.stringify({ error: "LOGIN_REQUIRED", message: "Please sign in to use larger spreads" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 字數規格:Quick 約 200 字 / Deep 約 500 字
    const wordTargetZh = effectiveDepth === "deep" ? "約 500 字" : "約 200 字";
    const wordTargetEn = effectiveDepth === "deep" ? "around 350 words" : "around 150 words";
    const spreadNameZh = spread.nameZh;
    const spreadNameEn = spread.nameEn;

    const baseSystemZh = isFollowUp
      ? `你是一位深諳塔羅的占卜師。這是問事者就同一件事所做的「衍伸占卜」——你已經幫他做過前一輪(易經或塔羅)的解盤,也跟他在聊天框裡對話過。現在他針對同件事提出更深入的問題,又抽了「${spreadNameZh}」(${spread.cardCount} 張)。請把「前一輪結果 + 先前對話 + 新牌陣」串成連貫的延伸解說,直接呼應前面講過的脈絡(例如「承接剛才我們談到的...」),${wordTargetZh}。每張牌的牌義系統已提供,不要逐張複述,而是把整個牌陣串成回應問題的故事。使用繁體中文,用段落書寫,不要列點。`
      : `你是一位深諳塔羅的占卜師。使用者用「${spreadNameZh}」(${spread.cardCount} 張)針對一個問題占卜。每張牌的牌義(正位/逆位)以及它在牌陣中對應的位置與意義已由系統提供,你不需要重複牌義,而是要把所有牌串成一個針對問事者具體問題的連貫故事,並給出實際可行的建議。${effectiveDepth === "deep" ? "Deep Insight 模式 — 請特別交叉比對牌之間的關係(例如哪兩張牌互相呼應、哪一張在拖後腿)、揭示牌組合背後的潛在模式,並給出具體可執行的下一步。" : ""}語氣溫暖、貼近生活。${wordTargetZh},用段落書寫,不要列點。使用繁體中文。`;

    const baseSystemEn = isFollowUp
      ? `You are a skilled tarot reader. This is a FOLLOW-UP reading on the same matter — you've already done a prior reading (I Ching or tarot) for this querent and chatted with them. They're asking a deeper question and drew the "${spreadNameEn}" (${spread.cardCount} cards). Weave "prior result + earlier conversation + new spread" into a coherent continuation, explicitly referencing the prior context. ${wordTargetEn}. Card meanings are already provided — don't restate; weave the whole spread into a story answering their question. Warm flowing paragraphs, no bullets.`
      : `You are a skilled tarot reader. The querent drew the "${spreadNameEn}" (${spread.cardCount} cards) for a specific question. Card meanings (upright/reversed) and each position's significance are provided by the system — do NOT simply repeat them. Weave the entire spread into a coherent narrative about the querent's actual question and give practical, concrete advice. ${effectiveDepth === "deep" ? "Deep Insight mode — cross-reference relationships between cards (which echo each other, which holds back), reveal latent patterns, and give specific actionable next steps." : ""}Warm tone, ${wordTargetEn}, flowing paragraphs (no bullets).`;

    const baseSystemPrompt = isZh ? baseSystemZh : baseSystemEn;
    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, locale);

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

    // 組裝 user message — 含問題 + 每張牌的位置/名稱/正逆位/牌義/位置意義
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
          return `【${pos.labelZh} — ${pos.descZh}】\n${card.nameZh}(${suitZh}・${orientationZh})\n牌義:${meaning}`;
        }
        return `[${pos.labelEn} — ${pos.descEn}]\n${card.nameEn} (${suitEn}, ${orientationEn})\nMeaning: ${meaning}`;
      })
      .join("\n\n");

    const newQuestionLine = isZh
      ? (isFollowUp ? `新問題(${category}):${question}` : `問題(${category}):${question}`)
      : (isFollowUp ? `New question (${category}): ${question}` : `Question (${category}): ${question}`);

    const userMessage = isZh
      ? `${contextBlock}${newQuestionLine}\n\n本次牌陣:${spreadNameZh}(共 ${spread.cardCount} 張)\n\n${cardDescriptions}\n\n${isFollowUp ? `請承接前面的脈絡,針對我這次的新問題與這個牌陣,給出連貫的延伸解說,${wordTargetZh}。` : `請把整個牌陣串成一個連貫的故事,回應我的具體問題,並給出實際可行的建議,${wordTargetZh}。`}`
      : `${contextBlock}${newQuestionLine}\n\nSpread: ${spreadNameEn} (${spread.cardCount} cards)\n\n${cardDescriptions}\n\n${isFollowUp ? `Continue from the prior context; weave a coherent follow-up reading from this new spread for my new question. ${wordTargetEn}.` : `Weave the whole spread into a coherent narrative addressing my specific question, with practical advice. ${wordTargetEn}.`}`;

    const maxTokens = effectiveDepth === "deep" ? 1400 : 600;

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
        max_tokens: maxTokens,
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
