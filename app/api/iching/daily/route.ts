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
import { recordCardObtained } from "@/lib/cardCollection";

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
      locale?: "zh" | "en" | "ja" | "ko";
      personaId?: string;
    };
    type Locale = "zh" | "en" | "ja" | "ko";
    const safeLocale: Locale =
      locale === "zh" || locale === "en" || locale === "ja" || locale === "ko"
        ? locale
        : "zh";
    const pickStr = (
      zh: string,
      en: string,
      ja?: string | null,
      ko?: string | null
    ): string => {
      if (safeLocale === "en") return en;
      if (safeLocale === "ja") return ja || en;
      if (safeLocale === "ko") return ko || en;
      return zh;
    };

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
              message: pickStr(
                "點數不足",
                "Insufficient credits",
                "ポイント不足",
                "포인트 부족"
              ),
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
    const hexName = pickStr(hex.nameZh, hex.nameEn, hex.nameJa, hex.nameKo);

    // 卡牌收藏 — 同 daily 塔羅,只在首次扣點當下記錄
    let collectionIsNew = false;
    let collectionCount = 0;
    let collectionRewards = 0;
    if (!alreadyChargedToday) {
      const r = await recordCardObtained({
        userId: user.id,
        collectionType: "iching",
        cardId: String(hex.number),
        source: "daily",
      });
      collectionIsNew = r.isNew;
      collectionCount = r.distinctCount;
      collectionRewards = r.rewardCredits;
    }
    const judgmentClassical = hex.judgmentZh;
    const judgmentModern = pickStr(
      hex.judgmentVernacularZh,
      hex.judgmentEn,
      hex.judgmentJa,
      hex.judgmentKo
    );
    const imageModern = pickStr(
      hex.imageVernacularZh,
      hex.imageEn,
      hex.imageJa,
      hex.imageKo
    );

    const baseSystemPrompt =
      safeLocale === "zh"
        ? `你是一位深諳易經的占卜師,正在給問事者「今日一卦」的鼓勵訊息。請用約 120 字寫一段溫暖、有畫面感的「今日訊息」,把今天抽到的這一卦與「今天的能量、可以留意什麼、可以做什麼」串起來。語氣像一封朋友的早安訊息,自然口語、繁體中文、不要列點、不要先重述卦名。`
        : safeLocale === "ja"
          ? `あなたは易経に精通した占い師で、相談者に「今日の一卦」の励ましメッセージを届けています。約 120 字で、温かく情景の浮かぶ「今日のメッセージ」を書き、今日引いた卦と「今日のエネルギー、気を配るべきこと、できること」を織り交ぜてください。友人からの朝の挨拶のような口調で、自然な日本語、箇条書きなし、最初に卦名を繰り返さないでください。`
          : safeLocale === "ko"
            ? `당신은 주역에 정통한 점술사로, 질문자에게 "오늘의 한 괘" 격려 메시지를 전합니다. 약 120자로 따뜻하고 그림이 그려지는 "오늘의 메시지"를 써주세요. 오늘 뽑힌 괘와 "오늘의 에너지, 살필 것, 할 수 있는 것"을 엮어주세요. 친구의 아침 인사 같은 어조로, 자연스러운 한국어, 글머리 기호 없음, 첫머리에 괘 이름을 반복하지 마세요.`
            : `You are an I Ching diviner giving a "Today's Hexagram" message. Write a warm, image-rich 100-word "today's message" weaving today's drawn hexagram into "today's energy, what to notice, what to do". Like a friend's good-morning text — conversational English, no bullets, don't restate the hexagram name first.`;

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, safeLocale);

    const userMessage =
      safeLocale === "zh"
        ? `今天抽到的卦:第 ${hex.number} 卦 ${hex.nameZh}(${hex.nameEn})\n卦辭原文:${judgmentClassical}\n白話:${judgmentModern}\n象辭白話:${imageModern}\n\n請寫一段約 120 字的今日訊息。`
        : safeLocale === "ja"
          ? `今日引いた卦:第 ${hex.number} 卦 ${hexName}\n卦辞(原文):${judgmentClassical}\n卦辞(現代訳):${judgmentModern}\n象辞(現代訳):${imageModern}\n\n約 120 字の今日のメッセージを書いてください。`
          : safeLocale === "ko"
            ? `오늘 뽑힌 괘: 제 ${hex.number}괘 ${hexName}\n괘사(원문): ${judgmentClassical}\n괘사(현대 번역): ${judgmentModern}\n상사(현대 번역): ${imageModern}\n\n약 120자의 오늘의 메시지를 써주세요.`
            : `Today's hexagram: ${hex.number}. ${hexName}\nJudgment (classical): ${judgmentClassical}\nJudgment (modern): ${judgmentModern}\nImage (modern): ${imageModern}\n\nPlease write a ~100-word message for today.`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: withSafetyPreamble(systemPrompt, safeLocale) },
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
        "X-Collection-IsNew": collectionIsNew ? "1" : "0",
        "X-Collection-Count": String(collectionCount),
        "X-Collection-Rewards": String(collectionRewards),
      },
    });
  } catch (error) {
    console.error("IChing daily API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get daily hexagram" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
