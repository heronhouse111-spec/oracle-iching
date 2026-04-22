import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
  CREDIT_COSTS,
} from "@/lib/credits";
import { withSafetyPreamble } from "@/lib/ai/guardrail";

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
      messages,
      hexagramContext,
      readingContext,
      divineType,
      locale,
      divinationId,
    }: {
      messages: { role: "user" | "assistant"; content: string }[];
      hexagramContext?: string;
      readingContext?: string;
      divineType?: "iching" | "tarot";
      locale: "zh" | "en";
      divinationId?: string; // 有此欄位 + 已登入 → 聊完會把這輪 user+assistant 訊息 append 到這筆占卜的 chat_messages
    } = body;

    // 新版欄位 readingContext 優先,舊版 hexagramContext 保留相容
    const context = readingContext ?? hexagramContext ?? "";
    const type: "iching" | "tarot" = divineType === "tarot" ? "tarot" : "iching";

    const isZh = locale === "zh";

    // ──────────────────────────────────────────
    // 點數扣款(每一則聊天訊息 = 1 點;訪客目前仍允許免費聊,
    //          未來若要擋訪客聊天,把下面 else 的早 return 打開即可)
    // ──────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const cost = CREDIT_COSTS.CHAT;

    if (user) {
      try {
        await spendCredits({
          userId: user.id,
          amount: cost,
          reason: "spend_chat",
          metadata: { divineType: type, locale },
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
        console.error("[chat] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
    }

    const systemPrompt = isZh
      ? (type === "tarot"
          ? `你是一位親切的塔羅牌占卜師,正在為客人做諮詢。以下是剛才的三張牌占卜結果作為背景:
${context}

規則:
- 每次回覆控制在200個字以內,簡短精要
- 語氣溫暖親切,像面對面聊天一樣
- 用繁體中文,口語化但帶有智慧感
- 根據三張牌(過去/現在/未來)的訊息回答客人的追問
- 適時給予鼓勵和正面引導
- 不要用列點或編號,用自然對話的方式`
          : `你是一位親切的易經算命老師，正在為客人做諮詢。以下是剛才的占卜結果作為背景：
${context}

規則：
- 每次回覆控制在200個字以內，簡短精要
- 語氣溫暖親切，像面對面聊天一樣
- 用繁體中文，口語化但帶有智慧感
- 根據卦象回答客人的追問
- 適時給予鼓勵和正面引導
- 不要用列點或編號，用自然對話的方式`)
      : (type === "tarot"
          ? `You are a warm, wise tarot reader giving a consultation. Here is the three-card reading context:
${context}

Rules:
- Keep each reply around 100 words, concise and insightful
- Be warm and conversational, like a face-to-face chat
- Answer follow-up questions based on the past/present/future cards
- Offer encouragement and positive guidance
- Use natural flowing sentences, no bullet points`
          : `You are a warm, wise I Ching fortune-telling master giving a consultation. Here is the reading context:
${context}

Rules:
- Keep each reply around 100 words, concise and insightful
- Be warm and conversational, like a face-to-face chat
- Answer follow-up questions based on the hexagram
- Offer encouragement and positive guidance
- Use natural flowing sentences, no bullet points`);

    const apiMessages = [
      { role: "system", content: withSafetyPreamble(systemPrompt, locale) },
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
        max_tokens: 400,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek chat API error:", response.status, err);
      if (user) {
        await refundCredits({
          userId: user.id,
          amount: cost,
          errorMessage: `chat deepseek ${response.status}: ${err.slice(0, 200)}`,
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = response.body!.getReader();

    // 收集完整 assistant 回覆,stream 結束後若有 divinationId + user → 附加到 DB
    // 注意:client 送來的 messages[] 裡最後一則是「本輪新 user 訊息」,
    //      前面的是已經持久化過的歷史,所以只 append 最後一則 user + 本輪 assistant 回覆,
    //      避免重複寫入。
    const lastUserMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    let assistantFullText = "";

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
                  assistantFullText += content;
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

          // stream 成功結束 → 持久化本輪聊天(user + assistant 兩則),讓 /history 讀得到。
          // 只有「已登入 + 有 divinationId + lastUserMessage 是 user」的情境才寫,
          // 其他(訪客、被 abort 半途而廢、沒給 id)全部 skip。
          if (
            user &&
            divinationId &&
            lastUserMessage?.role === "user" &&
            lastUserMessage.content &&
            assistantFullText
          ) {
            try {
              const admin = createAdminClient();
              const now = new Date().toISOString();
              const { data: row, error: readErr } = await admin
                .from("divinations")
                .select("chat_messages, user_id")
                .eq("id", divinationId)
                .maybeSingle();

              // RLS 防線:就算 client 傳錯 id 也不能寫到別人的 row
              if (!readErr && row && row.user_id === user.id) {
                const existing = Array.isArray(row.chat_messages) ? row.chat_messages : [];
                const next = [
                  ...existing,
                  { role: "user", content: lastUserMessage.content, createdAt: now },
                  { role: "assistant", content: assistantFullText, createdAt: now },
                ];
                await admin
                  .from("divinations")
                  .update({ chat_messages: next })
                  .eq("id", divinationId);
              }
            } catch (e) {
              console.error("[chat] persist chat_messages failed:", e);
              // 失敗不影響回應(訊息已經串給 client 了),就 log
            }
          }
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
