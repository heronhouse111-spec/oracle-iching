/**
 * /api/iching/plum — 梅花易數 · 時間起卦
 *
 * 客端依當下 Date 計算上下卦 + 動爻(見 lib/iching/plum.ts),把所有結果送來這裡。
 * Server 端:
 *   - 用 primaryLines / transformedLines 反查本卦與之卦
 *   - 拼出含「公式 + 本卦 + 動爻 + 之卦」的 user prompt 給 DeepSeek 流式回覆
 *   - 扣 CREDIT_COSTS.PLUM(5 點),失敗自動退款
 *   - 寫入 divinations 表,method='plum'
 *
 * 回傳:
 *   - body 是 streaming AI 文字
 *   - X-Plum-PrimaryNumber:本卦編號 1-64
 *   - X-Plum-RelatingNumber:之卦編號 1-64
 *   - X-Plum-ChangingLine:動爻位 1-6
 */

import { NextRequest } from "next/server";
import {
  findHexagram,
  trigramNames,
  hexagramAuspice,
  type Hexagram,
} from "@/data/hexagrams";
import { appendPersonaPrompt } from "@/lib/personas";
import { resolvePersonaServer } from "@/lib/personasDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
  CREDIT_COSTS,
} from "@/lib/credits";
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

function isLineArray(arr: unknown): arr is number[] {
  return (
    Array.isArray(arr) &&
    arr.length === 6 &&
    arr.every((l) => l === 0 || l === 1)
  );
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
      locale,
      castAtIso,
      numbers,
      sumUpper,
      sumLower,
      upperIndex,
      lowerIndex,
      changingLine,
      primaryLines,
      transformedLines,
      personaId,
    }: {
      question: string;
      category?: Category;
      locale: Locale;
      castAtIso?: string;
      numbers: { year: number; month: number; day: number; hour: number; minute: number };
      sumUpper: number;
      sumLower: number;
      upperIndex: number;
      lowerIndex: number;
      changingLine: number;
      primaryLines: number[];
      transformedLines: number[];
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
    if (!isLineArray(primaryLines) || !isLineArray(transformedLines)) {
      return new Response(
        JSON.stringify({ error: "primaryLines / transformedLines must be 6 entries of 0|1" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (
      !Number.isInteger(changingLine) ||
      changingLine < 1 ||
      changingLine > 6
    ) {
      return new Response(JSON.stringify({ error: "changingLine must be 1..6" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const primaryHex = findHexagram(primaryLines);
    const transformedHex = findHexagram(transformedLines);
    if (!primaryHex || !transformedHex) {
      return new Response(JSON.stringify({ error: "Could not resolve hexagram" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const upper = trigramNames[primaryHex.upperTrigram];
    const lower = trigramNames[primaryHex.lowerTrigram];
    const auspice = hexagramAuspice[primaryHex.number];

    // ──────────────────────────────────────────
    // 點數 + 訂閱身份
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
    const cost = CREDIT_COSTS.PLUM;

    if (user) {
      try {
        await spendCredits({
          userId: user.id,
          amount: cost,
          reason: "spend_plum",
          metadata: {
            kind: "iching",
            method: "plum",
            primaryHex: primaryHex.number,
            relatingHex: transformedHex.number,
            changingLine,
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
        console.error("[iching/plum] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // ──────────────────────────────────────────
    // 拼 prompt
    // ──────────────────────────────────────────
    const formatHex = (h: Hexagram) =>
      pickStr(safeLocale, h.nameZh, h.nameEn, h.nameJa, h.nameKo);
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

    // 註:本 codebase 的 Hexagram.lines 只是 6 個 0/1,不含每爻爻辭。AI 模型自行回想
    // 該卦該爻的爻辭即可,prompt 只需要明確指出「第 N 爻動」。
    const auspiceLabel =
      auspice === "great"
        ? pickStr(safeLocale, "大吉", "Auspicious", "大吉", "대길")
        : auspice === "challenge"
          ? pickStr(safeLocale, "艱難", "Challenging", "艱難", "험난")
          : pickStr(safeLocale, "中性", "Mixed", "中性", "중성");

    const castMoment = castAtIso
      ? `${numbers.year}/${numbers.month}/${numbers.day} ${numbers.hour}:${String(numbers.minute).padStart(2, "0")}`
      : "";

    const baseSystemPrompt =
      safeLocale === "zh"
        ? `你是一位深諳易經、精通梅花易數的占卜師。問事者以「時間起卦」立卦 — 用當下年月日時分,經 mod 8 / mod 6 推得本卦、動爻位置與之卦。

你的任務:
- 讀本卦定基調(事的本相),讀動爻定當下關鍵(此刻該怎麼下手),讀之卦定走向(事如何演變)。
- 給出 350-450 字的解讀。
- 結構:先說本卦示意的基調與氣象,再點出動爻所示「當下這一刻最關鍵的提示」,最後合本卦→之卦的路徑說明事的整體運動方向,並針對問題給具體建議。
- 文字溫暖具體、避免空話,使用繁體中文,以段落書寫(不要列點),不要重複問題本身,不要重新講起卦公式。
- 善用「此刻」「當下這一念」這類梅花占的時間性語感。`
        : safeLocale === "ja"
          ? `あなたは易経と梅花易数に精通した占い師です。相談者は「時間起卦」で立卦 — 現在の年月日時分を mod 8 / mod 6 にかけ、本卦・動爻位置・之卦を導いた。

あなたの任務:
- 本卦で基調(事の本相)、動爻で当下の要(此の瞬間に何を為すべきか)、之卦で行方(事はどう変じるか)を読み取る。
- 350-450 字で解読を提供。
- 構成:まず本卦が示す基調と気象、次に動爻の示す「今この瞬間の最重要示唆」、最後に本卦→之卦の経路で事の運動方向を述べ、問いに具体的な助言をする。
- 文字は温かく具体的に、空疎な言葉を避け、日本語の段落書き(箇条書きは避ける)、質問自体を繰り返さず、起卦公式を再説明しない。
- 「此刻」「今この一念」など梅花占特有の時間感を活かす。`
          : safeLocale === "ko"
            ? `당신은 주역과 매화역수에 정통한 점술사입니다. 질문자는 '시간 기괘'로 점을 세웠습니다 — 현재의 연월일시분을 mod 8 / mod 6 에 걸어 본괘·동효·지괘를 도출했습니다.

당신의 임무:
- 본괘로 기조(일의 본질), 동효로 지금의 핵심(이 순간 무엇을 해야 하는가), 지괘로 흐름(일이 어떻게 변할까)을 읽어내라.
- 350-450자의 해독을 제공하라.
- 구성: 먼저 본괘의 기조와 기상, 이어 동효가 보이는 '지금 이 순간의 가장 중요한 힌트', 마지막으로 본괘→지괘의 경로로 일의 운동 방향을 풀이하며 질문에 구체적 조언을 한다.
- 문장은 따뜻하고 구체적으로, 공허한 말은 피하고, 한국어로 단락을 짓되(글머리 기호 금지) 질문 자체를 반복하지 말고 기괘 공식을 다시 설명하지 말 것.
- '지금 이 순간', '이 한 생각' 같은 매화점 특유의 시간 감각을 살릴 것.`
            : `You are an I Ching diviner skilled in Plum Blossom Numerology. The querent cast via 'time-based casting': from the current year/month/day/hour/minute, applying mod-8 and mod-6 to derive the primary hexagram, the changing-line position, and the relating hexagram.

Your task:
- Use the primary to set the tone (the essence of the matter), the changing line to surface the present pivot (what to do at this very moment), and the relating hexagram to show the trajectory (how the matter unfolds).
- Produce a reading of about 280-360 words.
- Structure: first the primary's tone and atmosphere, then the changing line's sharpest cue for now, finally the path primary → relating to express the overall motion, with concrete advice for the question.
- Warm, specific, English prose paragraphs (no bullets); do not restate the question or re-explain the formula.
- Lean into Plum Blossom's sense of the present moment ('this moment', 'this single thought').`;

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, safeLocale);

    const userMessage =
      safeLocale === "zh"
        ? `問題:${question}
類別:${category}
起卦時刻:${castMoment}

【公式推導】
(年+月+日+時) = ${numbers.year}+${numbers.month}+${numbers.day}+${numbers.hour} = ${sumUpper}
${sumUpper} mod 8 = ${upperIndex} → 上卦 ${upper.zh}(${upperName})
+ 分${numbers.minute} = ${sumLower}
${sumLower} mod 8 = ${lowerIndex} → 下卦 ${lower.zh}(${lowerName})
${sumLower} mod 6 = ${changingLine} → 第 ${changingLine} 爻動

【本卦】
第 ${primaryHex.number} 卦 ${primaryHex.nameZh}(${formatHex(primaryHex)})
吉凶傾向:${auspiceLabel}
卦辭:${judgmentClassical}
卦辭白話:${judgmentModern}
象辭:${imageClassical}
象辭白話:${imageModern}

【動爻】
動於第 ${changingLine} 爻 — 請依此卦此爻的爻辭(汝所熟記)說明當下關鍵。

【之卦】
第 ${transformedHex.number} 卦 ${transformedHex.nameZh}(${formatHex(transformedHex)})

請依系統 prompt 的指示,合參本卦、動爻與之卦,給出針對我問題的解讀。`
        : safeLocale === "ja"
          ? `質問:${question}
カテゴリ:${category}
起卦時刻:${castMoment}

【公式の推導】
(年+月+日+時) = ${numbers.year}+${numbers.month}+${numbers.day}+${numbers.hour} = ${sumUpper}
${sumUpper} mod 8 = ${upperIndex} → 上卦 ${upper.zh}(${upperName})
+ 分${numbers.minute} = ${sumLower}
${sumLower} mod 8 = ${lowerIndex} → 下卦 ${lower.zh}(${lowerName})
${sumLower} mod 6 = ${changingLine} → 第 ${changingLine} 爻 動

【本卦】
第 ${primaryHex.number} 卦 ${primaryHex.nameZh}(${formatHex(primaryHex)})
吉凶傾向:${auspiceLabel}
卦辞(原文):${judgmentClassical}
卦辞(現代訳):${judgmentModern}
象辞(原文):${imageClassical}
象辞(現代訳):${imageModern}

【動爻】
第 ${changingLine} 爻が動く — 此の卦此の爻の爻辞(あなたが熟知するもの)に基づき、当下の要を述べよ。

【之卦】
第 ${transformedHex.number} 卦 ${transformedHex.nameZh}(${formatHex(transformedHex)})

システム指示に従い、本卦・動爻・之卦を合わせ参じて私の問いに解読を。`
          : safeLocale === "ko"
            ? `질문: ${question}
분류: ${category}
기괘 시각: ${castMoment}

【공식 추도】
(년+월+일+시) = ${numbers.year}+${numbers.month}+${numbers.day}+${numbers.hour} = ${sumUpper}
${sumUpper} mod 8 = ${upperIndex} → 상괘 ${upper.zh}(${upperName})
+ 분${numbers.minute} = ${sumLower}
${sumLower} mod 8 = ${lowerIndex} → 하괘 ${lower.zh}(${lowerName})
${sumLower} mod 6 = ${changingLine} → 제 ${changingLine} 효 동

【본괘】
제 ${primaryHex.number}괘 ${primaryHex.nameZh}(${formatHex(primaryHex)})
길흉 경향: ${auspiceLabel}
괘사(원문): ${judgmentClassical}
괘사(현대): ${judgmentModern}
상사(원문): ${imageClassical}
상사(현대): ${imageModern}

【동효】
제 ${changingLine} 효가 동함 — 이 괘 이 효의 효사(당신이 숙지한 것)에 근거해 지금의 핵심을 말하라.

【지괘】
제 ${transformedHex.number}괘 ${transformedHex.nameZh}(${formatHex(transformedHex)})

시스템 지시에 따라 본괘·동효·지괘를 합쳐 제 질문에 해독해 주세요.`
            : `Question: ${question}
Category: ${category}
Cast moment: ${castMoment}

[Formula derivation]
(Y+M+D+H) = ${numbers.year}+${numbers.month}+${numbers.day}+${numbers.hour} = ${sumUpper}
${sumUpper} mod 8 = ${upperIndex} → upper trigram ${upper.zh} (${upperName})
+ minute ${numbers.minute} = ${sumLower}
${sumLower} mod 8 = ${lowerIndex} → lower trigram ${lower.zh} (${lowerName})
${sumLower} mod 6 = ${changingLine} → line ${changingLine} changes

[Primary hexagram]
${primaryHex.number}. ${primaryHex.nameZh} (${formatHex(primaryHex)})
Auspice: ${auspiceLabel}
Judgment (classical): ${judgmentClassical}
Judgment (modern): ${judgmentModern}
Image (classical): ${imageClassical}
Image (modern): ${imageModern}

[Changing line]
Line ${changingLine} is the moving line — base the present-moment cue on the line text you know for this hexagram and this line.

[Relating hexagram]
${transformedHex.number}. ${transformedHex.nameZh} (${formatHex(transformedHex)})

Follow the system instructions: weave primary, changing line, and relating into a concrete reading for my question.`;

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
        max_tokens: 900,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API error (iching/plum):", response.status, err);
      if (user) {
        await refundCredits({
          userId: user.id,
          amount: cost,
          errorMessage: `iching/plum deepseek ${response.status}: ${err.slice(0, 200)}`,
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

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
          console.error("IChing plum stream error:", e);
        } finally {
          controller.close();

          if (user && collectedReading.trim().length > 0) {
            try {
              const admin = createAdminClient();
              await admin.from("divinations").insert({
                user_id: user.id,
                question: question.trim(),
                category,
                hexagram_number: primaryHex.number,
                primary_lines: primaryLines,
                changing_lines: [changingLine - 1],
                relating_hexagram_number: transformedHex.number,
                ai_reading: collectedReading,
                locale: safeLocale,
                method: "plum",
              });
            } catch (e) {
              console.error("[iching/plum] DB insert failed:", e);
            }
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Plum-PrimaryNumber": String(primaryHex.number),
        "X-Plum-RelatingNumber": String(transformedHex.number),
        "X-Plum-ChangingLine": String(changingLine),
      },
    });
  } catch (error) {
    console.error("IChing plum API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get reading" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
