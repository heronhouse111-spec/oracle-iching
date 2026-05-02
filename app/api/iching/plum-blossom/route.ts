/**
 * /api/iching/plum-blossom — 梅花易數 · 時間起卦
 *
 * 客端傳問題 + 客端時間;server:
 *   1. 用客端時間(epoch ms)起卦,得到本卦/動爻/之卦(lib/plumBlossom)
 *   2. 扣 CREDIT_COSTS.PLUM_BLOSSOM(5),失敗自動退款
 *   3. 串 system + user prompt,呼 DeepSeek 流式吐字
 *   4. 寫入 divinations 表,method='plum-blossom'
 *
 * 為什麼用客端時間:server 可能在 UTC,user 在台灣;同一個 user 同一秒
 * 在不同時區會得到不同卦,這不合「梅花易數靠當下時刻」的精神。直接用
 * 客端送上來的 epoch + tz offset 還原,精確到「使用者按下起卦的那一刻」。
 *
 * 回傳:
 *   - body 是 streaming AI 文字
 *   - X-PB-HexagramNumber:本卦 1..64
 *   - X-PB-RelatingNumber:之卦 1..64
 *   - X-PB-ChangingLine:動爻索引(0..5)
 */

import { NextRequest } from "next/server";
import { castPlumBlossom } from "@/lib/plumBlossom";
import { trigramNames, hexagramAuspice } from "@/data/hexagrams";
import { appendPersonaPrompt } from "@/lib/personas";
import { resolvePersonaServer } from "@/lib/personasDb";
import { createClient } from "@/lib/supabase/server";
import {
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
  CREDIT_COSTS,
} from "@/lib/credits";
import { recordCardObtained, aggregateResults } from "@/lib/cardCollection";
import { withSafetyPreamble } from "@/lib/ai/guardrail";

type Locale = "zh" | "en" | "ja" | "ko";
type Category = "love" | "career" | "wealth" | "health" | "study" | "general";

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
      return new Response(
        JSON.stringify({ error: "DEEPSEEK_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const {
      question,
      category = "general",
      castEpochMs,
      locale,
      personaId,
    }: {
      question: string;
      category?: Category;
      castEpochMs?: number;
      locale: Locale;
      personaId?: string;
    } = body;

    const safeLocale: Locale =
      locale === "zh" || locale === "ja" || locale === "ko" ? locale : "en";

    if (typeof question !== "string" || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Question required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 用客端 epoch 起卦,落在 server 的 Date 物件上(年月日時直接 read)
    const castDate =
      typeof castEpochMs === "number" && Number.isFinite(castEpochMs)
        ? new Date(castEpochMs)
        : new Date();
    const result = castPlumBlossom(castDate);
    const { primaryHex, relatingHex, primaryLines, changingLines, cast } = result;

    const upper = trigramNames[primaryHex.upperTrigram];
    const lower = trigramNames[primaryHex.lowerTrigram];
    const auspice = hexagramAuspice[primaryHex.number];

    // ──────────────────────────────────────────
    // 點數 + 訂閱身份檢查
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
    const cost = CREDIT_COSTS.PLUM_BLOSSOM;

    if (user) {
      try {
        await spendCredits({
          userId: user.id,
          amount: cost,
          reason: "spend_plum_blossom",
          metadata: {
            kind: "iching",
            method: "plum-blossom",
            hexagramNumber: primaryHex.number,
            relatingNumber: relatingHex.number,
            changingLine: changingLines[0],
            locale: safeLocale,
            personaId: persona.id,
          },
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
        console.error("[iching/plum-blossom] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 卡牌收藏 — 本卦 + 之卦(梅花易數一定有變爻,所以一定有之卦)
    let collectionNewCount = 0;
    let collectionFinalCount = 0;
    let collectionRewards = 0;
    if (user) {
      const ids = [String(primaryHex.number)];
      if (relatingHex.number !== primaryHex.number) ids.push(String(relatingHex.number));
      const results = [];
      for (const cid of ids) {
        results.push(
          await recordCardObtained({
            userId: user.id,
            collectionType: "iching",
            cardId: cid,
            source: "plum_blossom",
          }),
        );
      }
      const agg = aggregateResults(results);
      collectionNewCount = agg.newCardCount;
      collectionFinalCount = agg.finalDistinctCount;
      collectionRewards = agg.totalRewardCredits;
    }

    // ──────────────────────────────────────────
    // 拼 prompt
    // ──────────────────────────────────────────
    const hexName = pickStr(
      safeLocale,
      primaryHex.nameZh,
      primaryHex.nameEn,
      primaryHex.nameJa,
      primaryHex.nameKo
    );
    const relName = pickStr(
      safeLocale,
      relatingHex.nameZh,
      relatingHex.nameEn,
      relatingHex.nameJa,
      relatingHex.nameKo
    );
    const upperName = pickStr(safeLocale, upper.zh, upper.en, upper.ja, upper.ko);
    const lowerName = pickStr(safeLocale, lower.zh, lower.en, lower.ja, lower.ko);
    const judgmentClassical = primaryHex.judgmentZh;
    const imageClassical = primaryHex.imageZh;
    const judgmentModern = pickStr(
      safeLocale,
      primaryHex.judgmentVernacularZh,
      primaryHex.judgmentEn,
      primaryHex.judgmentJa,
      primaryHex.judgmentKo
    );
    const imageModern = pickStr(
      safeLocale,
      primaryHex.imageVernacularZh,
      primaryHex.imageEn,
      primaryHex.imageJa,
      primaryHex.imageKo
    );

    const auspiceLabel =
      auspice === "great"
        ? pickStr(safeLocale, "大吉", "Auspicious", "大吉", "대길")
        : auspice === "challenge"
          ? pickStr(safeLocale, "艱難", "Challenging", "艱難", "험난")
          : pickStr(safeLocale, "中性", "Mixed", "中性", "중성");

    const changingLineLabel = pickStr(
      safeLocale,
      `動爻:第 ${changingLines[0] + 1} 爻`,
      `Changing line: line ${changingLines[0] + 1}`,
      `動爻:第 ${changingLines[0] + 1} 爻`,
      `동효: 제 ${changingLines[0] + 1} 효`
    );

    const castInfo = pickStr(
      safeLocale,
      `起卦時刻:${cast.month} 月 ${cast.day} 日 ${cast.shichen} 時辰(年支 ${cast.yearZhi})`,
      `Cast: month ${cast.month} day ${cast.day} shichen ${cast.shichen} (year-zhi ${cast.yearZhi})`,
      `起卦時刻:${cast.month} 月 ${cast.day} 日 ${cast.shichen} 時辰(年支 ${cast.yearZhi})`,
      `기괘 시점: ${cast.month}월 ${cast.day}일 ${cast.shichen} 시진(년지 ${cast.yearZhi})`
    );

    const baseSystemPrompt =
      safeLocale === "zh"
        ? `你是一位深諳易經、擅長梅花易數的占卜師。問事者剛剛用「時間起卦」得到一個本卦,動爻只有一條(這是梅花易數的特色 — 變爻不靠擲錢,而是用問事時刻的數字算出),所以你會看到本卦 + 之卦 + 確切的那一條動爻。

任務:
- 先用一兩句點出本卦的整體氣象(吉/凶/平),再講動爻所示的關鍵時機,最後參之卦看走勢。
- 約 280-360 字,使用繁體中文段落書寫(不要列點)。
- 不要重述問題本身、也不必解釋什麼是梅花易數,直接給解讀。`
        : safeLocale === "ja"
          ? `あなたは易経と梅花易数に精通した占い師です。相談者は「時間起卦」で本卦を得ました。動爻は一つだけ(梅花易数の特徴 — 銭を投げず、問いを立てた時刻の数字から算出)、そのため本卦 + 之卦 + 一つの動爻を参照できます。

任務:
- まず本卦の総合的な気象(吉・凶・平)を一・二行で点描し、次に動爻が示す要の時機を語り、最後に之卦で行方を見る。
- 約 280-360 字、日本語で段落書き(箇条書き不要)。
- 質問自体を繰り返さず、梅花易数とは何かを説明する必要もない。直接解読を。`
          : safeLocale === "ko"
            ? `당신은 주역과 매화역수에 정통한 점술사입니다. 질문자는 '시간 기괘'로 본괘를 얻었습니다. 동효는 단 하나(매화역수의 특징 — 동전을 던지지 않고 질문 시점의 숫자로 산출), 그래서 본괘 + 지괘 + 하나의 동효를 참고할 수 있습니다.

임무:
- 먼저 본괘의 종합 기운(길·흉·평)을 한두 줄로 짚고, 다음 동효가 가리키는 핵심 시기를 말하며, 마지막으로 지괘로 흐름을 본다.
- 약 280-360자, 한국어로 단락 글(글머리 기호 사용 금지).
- 질문 자체를 반복하지 말고, 매화역수가 무엇인지 설명할 필요도 없습니다. 바로 풀이로 들어가세요.`
            : `You are an I Ching diviner versed in Plum Blossom Numerology. The querent has just cast a hexagram by time (no coins; the changing line is computed from the numbers of the moment). You'll see the primary hexagram, the relating hexagram, and exactly one changing line.

Task:
- Open with one or two lines on the primary hexagram's overall mood (auspicious / challenging / mixed). Then read the changing line as the timing pivot. Finally, read the relating hexagram for direction.
- About 220-300 words in English prose paragraphs (no bullets).
- Do not restate the question or explain what Plum Blossom is — go straight into the reading.`;

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, safeLocale);

    const userMessage =
      safeLocale === "zh"
        ? `問題:${question}
類別:${category}
${castInfo}

本卦:第 ${primaryHex.number} 卦 ${primaryHex.nameZh}(${hexName})
上卦:${upper.zh}(${upperName})／下卦:${lower.zh}(${lowerName})
吉凶傾向:${auspiceLabel}
卦辭:${judgmentClassical}
卦辭白話:${judgmentModern}
象辭:${imageClassical}
象辭白話:${imageModern}

${changingLineLabel}
之卦:第 ${relatingHex.number} 卦 ${relatingHex.nameZh}(${relName})

請依系統指示,給出本卦氣象 → 動爻時機 → 之卦走勢的合讀。`
        : safeLocale === "ja"
          ? `質問:${question}
カテゴリ:${category}
${castInfo}

本卦:第 ${primaryHex.number} 卦 ${primaryHex.nameZh}(${hexName})
上卦:${upper.zh}(${upperName})／下卦:${lower.zh}(${lowerName})
吉凶傾向:${auspiceLabel}
卦辞(原文):${judgmentClassical}
卦辞(現代訳):${judgmentModern}
象辞(原文):${imageClassical}
象辞(現代訳):${imageModern}

${changingLineLabel}
之卦:第 ${relatingHex.number} 卦 ${relatingHex.nameZh}(${relName})

システム指示に従い、本卦の気象 → 動爻の時機 → 之卦の行方を統合解読。`
          : safeLocale === "ko"
            ? `질문: ${question}
분류: ${category}
${castInfo}

본괘: 제 ${primaryHex.number}괘 ${primaryHex.nameZh}(${hexName})
상괘: ${upper.zh}(${upperName}) / 하괘: ${lower.zh}(${lowerName})
길흉 경향: ${auspiceLabel}
괘사(원문): ${judgmentClassical}
괘사(현대): ${judgmentModern}
상사(원문): ${imageClassical}
상사(현대): ${imageModern}

${changingLineLabel}
지괘: 제 ${relatingHex.number}괘 ${relatingHex.nameZh}(${relName})

시스템 지시에 따라 본괘의 기운 → 동효의 시기 → 지괘의 흐름을 통합 해독해 주세요.`
            : `Question: ${question}
Category: ${category}
${castInfo}

Primary: ${primaryHex.number}. ${primaryHex.nameZh} (${hexName})
Upper: ${upper.zh} (${upperName}) / Lower: ${lower.zh} (${lowerName})
Auspice: ${auspiceLabel}
Judgment (classical): ${judgmentClassical}
Judgment (modern): ${judgmentModern}
Image (classical): ${imageClassical}
Image (modern): ${imageModern}

${changingLineLabel}
Relating: ${relatingHex.number}. ${relatingHex.nameZh} (${relName})

Per the system instructions, give a combined reading: primary mood → changing-line timing → relating-hexagram direction.`;

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
        max_tokens: 800,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API error (iching/plum-blossom):", response.status, err);
      if (user) {
        await refundCredits({
          userId: user.id,
          amount: cost,
          errorMessage: `iching/plum-blossom deepseek ${response.status}: ${err.slice(0, 200)}`,
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────
    // 流式吐字 + 同時收集寫入 DB
    // ──────────────────────────────────────────
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = response.body!.getReader();
    let collectedReading = "";

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
                  collectedReading += content;
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // skip parse errors mid-stream
              }
            }
          }
        } catch (e) {
          console.error("IChing plum-blossom stream error:", e);
        } finally {
          controller.close();
          // DB insert 由前端 saveDivination 處理(method='plum-blossom')— 這裡不再寫,
          // 避免跟 home page result step 的 saveDivination 雙寫造成 duplicate row。
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-PB-HexagramNumber": String(primaryHex.number),
        "X-PB-RelatingNumber": String(relatingHex.number),
        "X-PB-ChangingLine": String(changingLines[0]),
        "X-Collection-NewCount": String(collectionNewCount),
        "X-Collection-Count": String(collectionFinalCount),
        "X-Collection-Rewards": String(collectionRewards),
      },
    });
  } catch (error) {
    console.error("IChing plum-blossom API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get reading" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
