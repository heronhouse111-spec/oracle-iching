/**
 * /api/iching/daily — 每日一卦 (Daily Hexagram)
 *
 * 跟 /api/daily (塔羅版) 同一套規則:
 *   - 必須登入(訪客 → 401)
 *   - 同一天同一人看到同一卦(deterministic by user.id + 台北日期)
 *   - 同日重抽不再扣點 (查 credit_transactions 今天有沒有 spend_daily_iching)
 *   - AI 給一段 ~120 字的「今日訊息」短文
 */

import { NextRequest } from "next/server";
import { hexagrams, type Hexagram } from "@/data/hexagrams";
import { appendPersonaPrompt } from "@/lib/personas";
import { resolvePersonaServer } from "@/lib/personasDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  spendCredits,
  InsufficientCreditsError,
  CREDIT_COSTS,
} from "@/lib/credits";
import { withSafetyPreamble } from "@/lib/ai/guardrail";

/** 取台北今天日期字串 (YYYY-MM-DD, UTC+8) */
function taipeiTodayKey(): string {
  const now = new Date();
  const taipei = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return taipei.toISOString().slice(0, 10);
}

/** Deterministic 抽卦:user.id + dateKey 為 seed → 同人同日永遠抽到同一卦 */
function drawHexagramForUser(userId: string, dateKey: string): Hexagram {
  const seed = `${userId}|${dateKey}|iching`;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  }
  const idx = h % hexagrams.length;
  return hexagrams[idx];
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY not configured" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json().catch(() => ({}));
    const { locale, personaId } = body as {
      locale?: "zh" | "en";
      personaId?: string;
    };
    const isZh = locale === "zh" || locale === undefined;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "LOGIN_REQUIRED", message: "Please sign in for daily hexagram" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let isActiveSubscriber = false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();
    isActiveSubscriber = Boolean(profile?.is_active);
    const persona = await resolvePersonaServer(personaId, isActiveSubscriber);

    // 同日重抽 → 不再扣點
    const dateKey = taipeiTodayKey();
    const admin = createAdminClient();
    const startOfDay = new Date(`${dateKey}T00:00:00+08:00`).toISOString();
    const { data: existingTx } = await admin
      .from("credit_transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("reason", "spend_daily_iching")
      .gte("created_at", startOfDay)
      .limit(1);

    const alreadyChargedToday = Array.isArray(existingTx) && existingTx.length > 0;

    if (!alreadyChargedToday) {
      try {
        await spendCredits({
          userId: user.id,
          amount: CREDIT_COSTS.DAILY,
          reason: "spend_daily_iching",
          metadata: { kind: "iching", dateKey, locale, personaId: persona.id },
        });
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          return new Response(
            JSON.stringify({
              error: "INSUFFICIENT_CREDITS",
              required: CREDIT_COSTS.DAILY,
              message: isZh ? "點數不足" : "Insufficient credits",
            }),
            { status: 402, headers: { "Content-Type": "application/json" } }
          );
        }
        console.error("[iching/daily] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
    }

    const hex = drawHexagramForUser(user.id, dateKey);
    const hexName = isZh ? hex.nameZh : hex.nameEn;
    const judgmentClassical = hex.judgmentZh;
    const judgmentTranslated = isZh ? hex.judgmentVernacularZh : hex.judgmentEn;
    const imageVernacular = isZh ? hex.imageVernacularZh : hex.imageEn;

    const baseSystemPrompt = isZh
      ? `你是一位深諳易經的占卜師,正在給問事者「今日一卦」的鼓勵訊息。請用約 120 字寫一段溫暖、有畫面感的「今日訊息」,把今天抽到的這一卦與「今天的能量、可以留意什麼、可以做什麼」串起來。語氣像一封朋友的早安訊息,自然口語、繁體中文、不要列點、不要先重述卦名。`
      : `You are an I Ching diviner giving a "Today's Hexagram" message. Write a warm, image-rich 100-word "today's message" weaving today's drawn hexagram into "today's energy, what to notice, what to do". Like a friend's good-morning text — conversational, no bullets, don't restate the hexagram name first.`;

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, locale ?? "zh");

    const userMessage = isZh
      ? `今天抽到的卦:第 ${hex.number} 卦 ${hex.nameZh}(${hex.nameEn})\n卦辭原文:${judgmentClassical}\n白話:${judgmentTranslated}\n象辭白話:${imageVernacular}\n\n請寫一段約 120 字的今日訊息。`
      : `Today's hexagram: ${hex.number}. ${hexName}\nJudgment (classical): ${judgmentClassical}\nJudgment (modern): ${judgmentTranslated}\nImage: ${imageVernacular}\n\nPlease write a ~100-word message for today.`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: withSafetyPreamble(systemPrompt, locale ?? "zh") },
          { role: "user", content: userMessage },
        ],
        max_tokens: 400,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API error (iching/daily):", response.status, err);
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
          console.error("IChing daily stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Daily-HexagramNumber": String(hex.number),
        "X-Daily-Date": dateKey,
        "X-Daily-Reread": alreadyChargedToday ? "1" : "0",
      },
    });
  } catch (error) {
    console.error("IChing daily API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get daily hexagram" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
