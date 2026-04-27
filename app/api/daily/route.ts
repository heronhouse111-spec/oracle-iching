/**
 * /api/daily — 每日一卡(Daily Card)
 *
 * 設計:
 *   - 必須登入(訪客導向 /login)
 *   - 後端用「user.id + 今天日期(UTC+8 台北時間)」當 seed → 同一天同一人永遠抽到同一張
 *   - 同 user 同日重抽不再扣點(查 credit_transactions today + reason='spend_daily')
 *   - AI 給一段 ~120 字的「今日訊息」短文,語氣鼓勵性
 */

import { NextRequest } from "next/server";
import { tarotDeck, type DrawnCard } from "@/data/tarot";
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

/** 取台北今天日期字串(YYYY-MM-DD,UTC+8) */
function taipeiTodayKey(): string {
  const now = new Date();
  const taipei = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return taipei.toISOString().slice(0, 10);
}

/** Deterministic 抽卡:user.id + dateKey 為 seed */
function drawCardForUser(userId: string, dateKey: string): DrawnCard {
  const seed = `${userId}|${dateKey}`;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  }
  const idx = h % tarotDeck.length;
  const isReversed = ((h >>> 16) & 1) === 1;
  return { card: tarotDeck[idx], isReversed };
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
        JSON.stringify({ error: "LOGIN_REQUIRED", message: "Please sign in for daily card" }),
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

    // 同日重抽 → 不再扣點。查 credit_transactions 今天有沒有 spend_daily 記錄
    const dateKey = taipeiTodayKey();
    const admin = createAdminClient();
    const startOfDay = new Date(`${dateKey}T00:00:00+08:00`).toISOString();
    const { data: existingTx } = await admin
      .from("credit_transactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("reason", "spend_daily")
      .gte("created_at", startOfDay)
      .limit(1);

    const alreadyChargedToday = Array.isArray(existingTx) && existingTx.length > 0;

    if (!alreadyChargedToday) {
      try {
        await spendCredits({
          userId: user.id,
          amount: CREDIT_COSTS.DAILY,
          reason: "spend_daily",
          metadata: { dateKey, locale, personaId: persona.id },
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
        console.error("[daily] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 抽今天的牌(deterministic)
    const drawn = drawCardForUser(user.id, dateKey);
    const card = drawn.card;
    const isReversed = drawn.isReversed;

    const meaning = isReversed
      ? (isZh ? card.reversedMeaningZh : card.reversedMeaningEn)
      : (isZh ? card.uprightMeaningZh : card.uprightMeaningEn);
    const orientationZh = isReversed ? "逆位" : "正位";
    const orientationEn = isReversed ? "Reversed" : "Upright";
    const cardName = isZh ? card.nameZh : card.nameEn;

    const baseSystemPrompt = isZh
      ? `你是一位塔羅占卜師,正在給問事者「今日一卡」的鼓勵訊息。請用約 120 字寫一段溫暖、有畫面感的「今日訊息」,把今天抽到的這張牌與「今天的能量、可以留意什麼、可以做什麼」串起來。語氣像一封朋友的早安訊息,自然口語、繁體中文、不要列點、不要先重述牌名。`
      : `You are a tarot reader giving a "Today's Card" message. Write a warm, image-rich 100-word "today's message" weaving today's drawn card into "today's energy, what to notice, what to do". Like a friend's good-morning text — conversational, no bullets, don't restate the card name first.`;

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, locale ?? "zh");

    const userMessage = isZh
      ? `今天抽到的牌:${cardName}(${orientationZh})\n牌義:${meaning}\n\n請寫一段約 120 字的今日訊息。`
      : `Today's card: ${cardName} (${orientationEn})\nMeaning: ${meaning}\n\nPlease write a ~100-word message for today.`;

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
      console.error("DeepSeek API error (daily):", response.status, err);
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
          console.error("Daily stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Daily-CardId": card.id,
        "X-Daily-Reversed": isReversed ? "1" : "0",
        "X-Daily-Date": dateKey,
        "X-Daily-Reread": alreadyChargedToday ? "1" : "0",
      },
    });
  } catch (error) {
    console.error("Daily API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get daily card" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
