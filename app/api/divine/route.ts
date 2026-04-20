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
    } = body;

    const hexagram = getHexagramByNumber(hexagramNumber);
    const relatingHex = relatingHexagramNumber ? getHexagramByNumber(relatingHexagramNumber) : null;
    const isZh = locale === "zh";
    const isFollowUp = Boolean(previousContext && previousContext.trim().length > 0);

    const systemPrompt = isZh
      ? (isFollowUp
        ? `你是一位精通易經的占卜師。這是問事者就同一件事所做的「衍伸占卜」——你已經幫他看過前一輪卦象,也跟他在聊天框裡對話過。現在他針對同件事提出更深入的問題,又抽了一卦。請把「前一輪卦象 + 先前對話 + 新卦象」串成連貫的延伸解說,直接呼應前面講過的脈絡(例如:「承接前面提到的...」、「相較先前那卦,這次...」),約300字。卦辭原文系統已顯示,不要重複。使用繁體中文,用段落書寫,不要列點。`
        : `你是一位精通易經的占卜師。卦辭原文與白話翻譯已由系統顯示，不需要重複。你只需針對問事者的問題，結合卦象給出約300字的個人化分析與建議。語氣親切、淺顯易懂，使用繁體中文。不要列點，用段落形式書寫。`)
      : (isFollowUp
        ? `You are a wise I Ching consultant. This is a FOLLOW-UP reading on the same matter — you've already read a prior hexagram for this querent and chatted with them about it. They're now asking a deeper question on the same topic and drew a new hexagram. Weave "prior hexagram + earlier conversation + new hexagram" into a coherent continuation, explicitly referencing the prior context ("Building on what we discussed...", "Compared to the earlier hexagram..."). Around 150 words. Hexagram texts are already shown. Warm, flowing paragraphs, no bullets.`
        : `You are a wise I Ching consultant. The hexagram texts and translations are already shown by the system. Provide ONLY a ~150-word personalized analysis and advice based on the querent's specific question and the hexagram. Write in flowing paragraphs, not bullet points. Be warm and practical.`);

    // 把對話紀錄壓成文字塊放進 user message — 比放進 messages[] 省 token,
    // 也能確保 AI 把它當成「我之前說過的話」而不是當前輪次的對話。
    const chatExcerpt = (chatHistory ?? [])
      .slice(-6) // 只帶最近 6 句避免 prompt 太長
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
      ? (isFollowUp ? `新問題(${category}):${question}` : `問題（${category}）：${question}`)
      : (isFollowUp ? `New question (${category}): ${question}` : `Question (${category}): ${question}`);

    const userMessage = isZh
      ? `${contextBlock}${newQuestionLine}\n\n本卦：第${hexagramNumber}卦 ${hexagramName}\n卦辭：${hexagram?.judgmentZh}\n象辭：${hexagram?.imageZh}\n${changingLines.length > 0 ? `變爻：第${changingLines.map((l: number) => l + 1).join("、")}爻` : "無變爻"}${relatingHex ? `\n之卦：第${relatingHex.number}卦 ${relatingHex.nameZh}` : ""}\n\n${isFollowUp ? "請承接前面的脈絡,針對我這次的新問題與新卦象,給出連貫的延伸解說,約300字。" : "請直接給出針對我問題的分析與建議，約300字。"}`
      : `${contextBlock}${newQuestionLine}\n\nHexagram ${hexagramNumber}: ${hexagramName}\nJudgment: ${hexagram?.judgmentEn}\nImage: ${hexagram?.imageEn}\n${changingLines.length > 0 ? `Changing lines: ${changingLines.map((l: number) => l + 1).join(", ")}` : "No changing lines"}${relatingHex ? `\nRelating: ${relatingHex.number} - ${relatingHex.nameEn}` : ""}\n\n${isFollowUp ? "Continue from the prior context; weave a coherent follow-up reading for my new question and new hexagram. Around 150 words." : "Give me personalized advice for my question, around 150 words."}`;

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
