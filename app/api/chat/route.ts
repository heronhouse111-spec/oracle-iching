import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY not configured" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { messages, hexagramContext, locale } = body;

    const isZh = locale === "zh";

    const systemPrompt = isZh
      ? `你是一位親切的易經算命老師，正在為客人做諮詢。以下是剛才的占卜結果作為背景：
${hexagramContext}

規則：
- 每次回覆控制在100個字左右，簡短精要
- 語氣溫暖親切，像面對面聊天一樣
- 用繁體中文，口語化但帶有智慧感
- 根據卦象回答客人的追問
- 適時給予鼓勵和正面引導
- 不要用列點或編號，用自然對話的方式`
      : `You are a warm, wise I Ching fortune-telling master giving a consultation. Here is the reading context:
${hexagramContext}

Rules:
- Keep each reply around 50 words, concise and insightful
- Be warm and conversational, like a face-to-face chat
- Answer follow-up questions based on the hexagram
- Offer encouragement and positive guidance
- Use natural flowing sentences, no bullet points`;

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: apiMessages,
        max_tokens: 200,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek chat API error:", response.status, err);
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
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        } catch (e) {
          console.error("Chat stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get response" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
