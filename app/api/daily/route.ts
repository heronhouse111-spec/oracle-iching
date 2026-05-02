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
import { recordCardObtained } from "@/lib/cardCollection";

type Locale = "zh" | "en" | "ja" | "ko";
function pickStr(
  locale: Locale,
  zh: string,
  en: string,
  ja?: string | null,
  ko?: string | null
): string {
  if (locale === "en") return en;
  if (locale === "ja") return ja || en;
  if (locale === "ko") return ko || en;
  return zh;
}

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
      locale?: Locale;
      personaId?: string;
    };
    // 防呆 + 預設:無值 / 未知值 → zh(沿用先前的預設行為)
    const safeLocale: Locale =
      locale === "zh" || locale === "en" || locale === "ja" || locale === "ko"
        ? locale
        : "zh";

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
              message: pickStr(
                safeLocale,
                "點數不足",
                "Insufficient credits",
                "ポイント不足",
                "포인트 부족"
              ),
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

    // 卡牌收藏 — 只在「真正首次扣點」當下記錄,同日重抽不重複寫入
    // (失敗不影響 daily 主流程,helper 內部已 try-catch)
    let collectionIsNew = false;
    let collectionCount = 0;
    let collectionRewards = 0;
    if (!alreadyChargedToday) {
      const r = await recordCardObtained({
        userId: user.id,
        collectionType: "tarot",
        cardId: card.id,
        cardSubkind: card.suit,
        source: "daily",
      });
      collectionIsNew = r.isNew;
      collectionCount = r.distinctCount;
      collectionRewards = r.rewardCredits;
    }

    const meaning = isReversed
      ? pickStr(
          safeLocale,
          card.reversedMeaningZh,
          card.reversedMeaningEn,
          card.reversedMeaningJa,
          card.reversedMeaningKo
        )
      : pickStr(
          safeLocale,
          card.uprightMeaningZh,
          card.uprightMeaningEn,
          card.uprightMeaningJa,
          card.uprightMeaningKo
        );
    const orientation = pickStr(
      safeLocale,
      isReversed ? "逆位" : "正位",
      isReversed ? "Reversed" : "Upright",
      isReversed ? "逆位置" : "正位置",
      isReversed ? "역방향" : "정방향"
    );
    const cardName = pickStr(safeLocale, card.nameZh, card.nameEn, card.nameJa, card.nameKo);

    const baseSystemPrompt =
      safeLocale === "zh"
        ? `你是一位塔羅占卜師,正在給問事者「今日一卡」的鼓勵訊息。請用約 120 字寫一段溫暖、有畫面感的「今日訊息」,把今天抽到的這張牌與「今天的能量、可以留意什麼、可以做什麼」串起來。語氣像一封朋友的早安訊息,自然口語、繁體中文、不要列點、不要先重述牌名。`
        : safeLocale === "ja"
          ? `あなたはタロット占い師で、相談者に「今日の一枚」の励ましメッセージを届けています。約 120 字で、温かく情景の浮かぶ「今日のメッセージ」を書き、今日引いたカードと「今日のエネルギー、気を配るべきこと、できること」を織り交ぜてください。友人からの朝の挨拶のような口調で、自然な日本語、箇条書きなし、最初にカード名を繰り返さないでください。`
          : safeLocale === "ko"
            ? `당신은 타로 점술사로, 질문자에게 "오늘의 한 장" 격려 메시지를 전합니다. 약 120자로 따뜻하고 그림이 그려지는 "오늘의 메시지"를 써주세요. 오늘 뽑힌 카드와 "오늘의 에너지, 살필 것, 할 수 있는 것"을 엮어주세요. 친구의 아침 인사 같은 어조로, 자연스러운 한국어, 글머리 기호 없음, 첫머리에 카드 이름을 반복하지 마세요.`
            : `You are a tarot reader giving a "Today's Card" message. Write a warm, image-rich 100-word "today's message" weaving today's drawn card into "today's energy, what to notice, what to do". Like a friend's good-morning text — conversational English, no bullets, don't restate the card name first.`;

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, safeLocale);

    const userMessage =
      safeLocale === "zh"
        ? `今天抽到的牌:${cardName}(${orientation})\n牌義:${meaning}\n\n請寫一段約 120 字的今日訊息。`
        : safeLocale === "ja"
          ? `今日引いたカード:${cardName}(${orientation})\nカードの意味:${meaning}\n\n約 120 字の今日のメッセージを書いてください。`
          : safeLocale === "ko"
            ? `오늘 뽑힌 카드: ${cardName}(${orientation})\n카드 의미: ${meaning}\n\n약 120자의 오늘의 메시지를 써주세요.`
            : `Today's card: ${cardName} (${orientation})\nMeaning: ${meaning}\n\nPlease write a ~100-word message for today.`;

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
        "X-Collection-IsNew": collectionIsNew ? "1" : "0",
        "X-Collection-Count": String(collectionCount),
        "X-Collection-Rewards": String(collectionRewards),
      },
    });
  } catch (error) {
    console.error("Daily API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get daily card" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
