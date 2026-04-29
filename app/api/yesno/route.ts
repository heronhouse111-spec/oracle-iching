/**
 * /api/yesno — Yes/No 一張牌占卜(輕量入口)
 *
 * 設計:
 *   - 訪客可玩 1 次(無 cookie 防濫用,以 IP/UA 不刻意擋,品牌信任 + 漏斗轉換)
 *   - 已登入扣 1 點(CREDIT_COSTS.YESNO)
 *   - 後端決定 verdict(yes / no / depends)— 大牌正逆位 + 小牌花色傾向 → 規則表
 *   - AI 給一段 ~80 字的解釋,串起 verdict、牌義、問事者問題
 *
 * 為何 verdict 由後端決定:
 *   - 同一張牌的「yes/no 傾向」不應該被 AI 自由發揮(否則同樣的牌可能一次 yes 一次 no)
 *   - 規則寫死後 AI 只負責解釋「為何是這個答案」,輸出穩定
 */

import { NextRequest } from "next/server";
import { getCardById, type TarotCard } from "@/data/tarot";
import { appendPersonaPrompt } from "@/lib/personas";
import { resolvePersonaServer } from "@/lib/personasDb";
import { createClient } from "@/lib/supabase/server";
import {
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
  CREDIT_COSTS,
} from "@/lib/credits";
import { withSafetyPreamble } from "@/lib/ai/guardrail";

export type YesNoVerdict = "yes" | "no" | "depends";

/**
 * Yes/No 規則:
 *   大阿爾克那 — 多數正向(太陽、星星、世界、命運之輪正位)為 yes,
 *                負向(死神、惡魔、塔、月亮、隱者逆位)為 no,
 *                中性(愚者、魔術師、女祭司)看正逆位
 *   小阿爾克那 — 聖杯/錢幣偏 yes、寶劍偏 no、權杖看正逆;
 *                逆位整體 -1 維度
 *
 * 設計上以「不要過度承諾」為原則,模糊邊界傾向 depends。
 */
function decideVerdict(card: TarotCard, isReversed: boolean): YesNoVerdict {
  // 大阿爾克那 — 用 number 對照正逆傾向
  if (card.suit === "major") {
    const yesNumbers = new Set([0, 1, 3, 6, 10, 11, 14, 17, 19, 21]); // 愚者、魔術師、皇后、戀人、命運之輪、正義、節制、星星、太陽、世界
    const noNumbers = new Set([13, 15, 16, 18]); // 死神、惡魔、塔、月亮
    if (yesNumbers.has(card.number)) return isReversed ? "depends" : "yes";
    if (noNumbers.has(card.number)) return isReversed ? "depends" : "no";
    return isReversed ? "no" : "depends"; // 其他大牌(女祭司、教皇、戰車、力量、隱者、倒吊人、審判)→ 正位 depends、逆位 no
  }

  // 小阿爾克那
  // 寶劍 → 偏 no(衝突、阻礙、思想糾結)
  if (card.suit === "swords") return isReversed ? "depends" : "no";
  // 聖杯、錢幣 → 偏 yes(情感豐沛、實際豐盛)
  if (card.suit === "cups" || card.suit === "pentacles") {
    return isReversed ? "depends" : "yes";
  }
  // 權杖 → 看正逆(行動力 → yes;停滯/受阻 → no)
  if (card.suit === "wands") return isReversed ? "no" : "yes";

  return "depends";
}

const VERDICT_LABEL = {
  zh: { yes: "是", no: "否", depends: "看條件" },
  en: { yes: "Yes", no: "No", depends: "It depends" },
  ja: { yes: "はい", no: "いいえ", depends: "条件次第" },
  ko: { yes: "예", no: "아니오", depends: "조건부" },
};

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
      cardId,
      isReversed,
      question,
      locale,
      personaId,
    }: {
      cardId: string;
      isReversed: boolean;
      question: string;
      locale: Locale;
      personaId?: string;
    } = body;
    // 防呆:locale 落入未知值 → 視為 en
    const safeLocale: Locale =
      locale === "zh" || locale === "ja" || locale === "ko" ? locale : "en";

    const card = getCardById(cardId);
    if (!card) {
      return new Response(JSON.stringify({ error: `Unknown card: ${cardId}` }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    if (typeof question !== "string" || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Question required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const verdict = decideVerdict(card, isReversed);
    const verdictLabel = VERDICT_LABEL[safeLocale][verdict];

    // ──────────────────────────────────────────
    // 點數扣款 — 登入者每次 1 點;訪客本路徑允許 1 次免費(由前端 localStorage 限流)
    // ──────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let isActiveSubscriber = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle();
      isActiveSubscriber = Boolean(profile?.is_active);
    }
    const persona = await resolvePersonaServer(personaId, isActiveSubscriber);
    const cost = CREDIT_COSTS.YESNO;

    if (user) {
      try {
        await spendCredits({
          userId: user.id,
          amount: cost,
          reason: "spend_yesno",
          metadata: { cardId, isReversed, verdict, locale, personaId: persona.id },
        });
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          return new Response(
            JSON.stringify({
              error: "INSUFFICIENT_CREDITS",
              required: cost,
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
        console.error("[yesno] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
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
    const cardName = pickStr(
      safeLocale,
      card.nameZh,
      card.nameEn,
      card.nameJa,
      card.nameKo
    );

    // System prompt — 4 語系版本,要求 AI 用對應語言回覆
    const baseSystemPrompt =
      safeLocale === "zh"
        ? `你是一位塔羅占卜師,正在做 Yes/No 一張牌的快速占卜。系統已經根據抽到的牌與牌陣規則決定了「結論」(${verdictLabel}),你不需要重新判定 yes/no,你的任務是用約 80 字的一段話,溫暖地解釋「為什麼是這個答案」、「這張牌想提醒問事者什麼」。語氣自然口語,使用繁體中文,不要列點。先別重述問題,直接給出解釋。`
        : safeLocale === "ja"
          ? `あなたはタロット占い師で、Yes/No 一枚引きの素早い占いをしています。引いたカードとルールに基づき、「結論」(${verdictLabel})はシステムが既に決定済み — yes/no を判定し直さないでください。あなたのタスクは約 80 字の段落で、なぜこの答えなのか、このカードが相談者に伝えたいことを温かく説明すること。会話的な口調で、日本語で書き、箇条書きは避けてください。質問を繰り返さず、直接解説に入ってください。`
          : safeLocale === "ko"
            ? `당신은 타로 점술사로, Yes/No 한 장 뽑기 빠른 점을 봐주고 있습니다. 뽑힌 카드와 규칙에 따라 시스템이 이미 "결론"(${verdictLabel})을 결정했습니다 — yes/no를 다시 판단하지 마세요. 당신의 임무는 약 80자 한 문단으로, 왜 이 답인지, 이 카드가 질문자에게 무엇을 일깨우는지 따뜻하게 설명하는 것입니다. 자연스러운 회화체로 한국어로 쓰고, 글머리 기호는 사용하지 마세요. 질문을 다시 말하지 말고 바로 설명을 시작하세요.`
            : `You are a tarot reader giving a quick one-card Yes/No reading. The verdict (${verdictLabel}) is already decided by the system based on the drawn card and rules — do NOT re-judge yes/no. Your task: in around 60 words, warmly explain WHY this is the answer and what the card wants to remind the querent. Conversational tone in English, no bullets. Don't restate the question; jump straight into the explanation.`;

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, safeLocale);

    const userMessage =
      safeLocale === "zh"
        ? `問題:${question}\n\n抽到的牌:${cardName}(${orientation})\n牌義:${meaning}\n\n結論:${verdictLabel}\n\n請用約 80 字解釋這個答案。`
        : safeLocale === "ja"
          ? `質問:${question}\n\n引いたカード:${cardName}(${orientation})\nカードの意味:${meaning}\n\n結論:${verdictLabel}\n\n約 80 字で、この答えになる理由を説明してください。`
          : safeLocale === "ko"
            ? `질문: ${question}\n\n뽑힌 카드: ${cardName}(${orientation})\n카드 의미: ${meaning}\n\n결론: ${verdictLabel}\n\n약 80자로 이 답이 나온 이유를 설명해 주세요.`
            : `Question: ${question}\n\nDrawn card: ${cardName} (${orientation})\nMeaning: ${meaning}\n\nVerdict: ${verdictLabel}\n\nPlease explain in ~60 words why.`;

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
        max_tokens: 300,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API error (yesno):", response.status, err);
      if (user) {
        await refundCredits({
          userId: user.id,
          amount: cost,
          errorMessage: `yesno deepseek ${response.status}: ${err.slice(0, 200)}`,
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    // 把 verdict 放進 response header,client 可立即顯示而不必等 AI 文字
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
          console.error("YesNo stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-YesNo-Verdict": verdict, // client 從 header 拿 verdict
      },
    });
  } catch (error) {
    console.error("YesNo API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get reading" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
