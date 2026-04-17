import { NextRequest } from "next/server";
import { getHexagramByNumber } from "@/data/hexagrams";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY not configured" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { hexagramNumber, hexagramName, changingLines, relatingHexagramNumber, question, category, locale } = body;

    const hexagram = getHexagramByNumber(hexagramNumber);
    const relatingHex = relatingHexagramNumber ? getHexagramByNumber(relatingHexagramNumber) : null;
    const isZh = locale === "zh";

    const systemPrompt = isZh
      ? `你是一位精通易經的智慧占卜師，具備深厚的易學修養。你的解讀應包含：
1. 卦象總覽：簡述本卦核心意涵
2. 卦辭解讀：解釋卦辭對問事者的啟示
3. 爻辭分析：若有變爻，深入解讀
4. 綜合建議：結合問題類別給出具體建議
5. 吉凶判斷：整體運勢走向
使用優雅繁體中文，語調兼具古典韻味與現代親和力。`
      : `You are a wise I Ching master. Your reading should include:
1. Hexagram Overview
2. Judgment Interpretation
3. Changing Line Analysis (if any)
4. Practical Advice tailored to the question
5. Fortune Assessment
Speak with warmth, blending ancient wisdom with modern applicability.`;

    const userMessage = isZh
      ? `問題（${category}）：${question}\n\n本卦：第${hexagramNumber}卦 ${hexagramName}\n卦辭：${hexagram?.judgmentZh}\n象辭：${hexagram?.imageZh}\n${changingLines.length > 0 ? `變爻：第${changingLines.map((l: number) => l + 1).join("、")}爻` : "無變爻"}${relatingHex ? `\n之卦：第${relatingHex.number}卦 ${relatingHex.nameZh}` : ""}\n\n請做出詳細解讀。`
      : `Question (${category}): ${question}\n\nHexagram ${hexagramNumber}: ${hexagramName}\nJudgment: ${hexagram?.judgmentEn}\nImage: ${hexagram?.imageEn}\n${changingLines.length > 0 ? `Changing lines: ${changingLines.map((l: number) => l + 1).join(", ")}` : "No changing lines"}${relatingHex ? `\nRelating: ${relatingHex.number} - ${relatingHex.nameEn}` : ""}\n\nPlease provide a detailed reading.`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API error:", response.status, err);
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
