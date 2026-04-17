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
      ? `你是一位精通易經的占卜師。卦辭原文與白話翻譯已由系統顯示，不需要重複。你只需針對問事者的問題，結合卦象給出約300字的個人化分析與建議。語氣親切、淺顯易懂，使用繁體中文。不要列點，用段落形式書寫。`
      : `You are a wise I Ching consultant. The hexagram texts and translations are already shown by the system. Provide ONLY a ~150-word personalized analysis and advice based on the querent's specific question and the hexagram. Write in flowing paragraphs, not bullet points. Be warm and practical.`;

    const userMessage = isZh
      ? `問題（${category}）：${question}\n\n本卦：第${hexagramNumber}卦 ${hexagramName}\n卦辭：${hexagram?.judgmentZh}\n象辭：${hexagram?.imageZh}\n${changingLines.length > 0 ? `變爻：第${changingLines.map((l: number) => l + 1).join("、")}爻` : "無變爻"}${relatingHex ? `\n之卦：第${relatingHex.number}卦 ${relatingHex.nameZh}` : ""}\n\n請直接給出針對我問題的分析與建議，約300字。`
      : `Question (${category}): ${question}\n\nHexagram ${hexagramNumber}: ${hexagramName}\nJudgment: ${hexagram?.judgmentEn}\nImage: ${hexagram?.imageEn}\n${changingLines.length > 0 ? `Changing lines: ${changingLines.map((l: number) => l + 1).join(", ")}` : "No changing lines"}${relatingHex ? `\nRelating: ${relatingHex.number} - ${relatingHex.nameEn}` : ""}\n\nGive me personalized advice for my question, around 150 words.`;

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
        max_tokens: 500,
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
