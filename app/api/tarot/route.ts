import { NextRequest } from "next/server";
import { getCardById, THREE_CARD_POSITIONS, SUIT_NAMES_ZH, SUIT_NAMES_EN } from "@/data/tarot";

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
    }: {
      cards: DrawnCardRequest[];
      question: string;
      category: string;
      locale: "zh" | "en";
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

    const systemPrompt = isZh
      ? `你是一位深諳塔羅的占卜師。使用者用三張牌陣(過去-現在-未來)針對一個問題占卜。每張牌的牌義(正位/逆位)已由系統提供,你**不需要重複牌義**,而是要把三張牌串成一個針對問事者具體問題的連貫故事,並給出實際可行的建議。語氣溫暖、貼近生活。約 300 字,用段落書寫,不要列點。使用繁體中文。`
      : `You are a skilled tarot reader. The querent drew three cards in a past-present-future spread for a specific question. The card meanings (upright/reversed) are provided by the system — do NOT simply repeat them. Instead, weave the three cards into a coherent narrative about the querent's actual question and give practical, concrete advice. Warm tone, around 150 words, flowing paragraphs (no bullets).`;

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

    const userMessage = isZh
      ? `問題(${category}):${question}\n\n占卜結果:\n\n${cardDescriptions}\n\n請把這三張牌串成一個連貫的故事,回應我的具體問題,並給出實際可行的建議,約 300 字。`
      : `Question (${category}): ${question}\n\nTarot reading:\n\n${cardDescriptions}\n\nWeave these three cards into a coherent narrative addressing my specific question, with practical advice. Around 150 words.`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 600,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API error (tarot):", response.status, err);
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
