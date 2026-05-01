/**
 * /api/iching/direction-hexagram — 方位卦象合參占卜
 *
 * 兩段式占法:
 *   1. 第一段卜方位(後天八卦其一)— 客端透過 CompassWheel 元件產生 directionTrigram
 *   2. 第二段卜六爻(三錢法 6 次)— 客端透過 performDivination() 產生 primaryLines
 *
 * Server 端:
 *   - 用 lines 反查本卦,若有 changingLines 則計算之卦
 *   - 用方位的 trigram 補入「事之所在 / 應於誰」
 *   - 串成 system prompt + user prompt 給 DeepSeek 流式回傳合參解讀
 *   - 扣 CREDIT_COSTS.DIRECTION_HEX(6 點),失敗自動退款
 *   - 寫入 divinations 表,method='direction-hexagram',direction_trigram=<code>
 *
 * 回傳:
 *   - body 是 streaming AI 文字
 *   - X-DH-HexagramNumber:1..64
 *   - X-DH-RelatingNumber:有變爻時為之卦編號,否則為空字串
 *   - X-DH-DirectionTrigram:3-bit binary string(同 request)
 */

import { NextRequest } from "next/server";
import {
  findHexagram,
  trigramNames,
  hexagramAuspice,
  trigramRelationship,
  type Hexagram,
} from "@/data/hexagrams";
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

const VALID_TRIGRAMS = new Set([
  "111", "000", "100", "010", "001", "011", "101", "110",
]);

const RELATIONSHIP_NOTE: Record<
  string,
  { zh: string; en: string; ja: string; ko: string }
> = {
  harmonious: {
    zh: "上下卦同氣比和,氣象一致、力量集中。",
    en: "Same element on top and bottom — energy unified and concentrated.",
    ja: "上下卦が比和し、気が一致し力が集中する。",
    ko: "상하괘가 비화하여 기운이 일치하고 힘이 집중됩니다.",
  },
  ascending: {
    zh: "下卦生上卦,內力滋養外勢,事漸入佳境。",
    en: "Lower trigram nourishes the upper — inner force flows outward, the matter gathers favorable momentum.",
    ja: "下卦が上卦を生じ、内なる力が外へ流れ、事は次第に好転する。",
    ko: "하괘가 상괘를 살려, 안의 힘이 밖으로 흘러 일이 점차 좋아집니다.",
  },
  descending: {
    zh: "上卦生下卦,外部資源滋養內部,但需慎防被動。",
    en: "Upper trigram feeds the lower — outer resources support the inner, but beware of passivity.",
    ja: "上卦が下卦を養い、外の資源が内を支えるが、受動的にならぬよう。",
    ko: "상괘가 하괘를 양육해, 외부 자원이 안을 받치나 수동적이 되지 않도록.",
  },
  rebellious: {
    zh: "下卦剋上卦,內欲突破外框,主動有衝突,宜謀而後動。",
    en: "Lower restrains the upper — inner pushes against outer, conflict from initiative; plan before acting.",
    ja: "下卦が上卦を剋し、内が外を破ろうとし主体的衝突あり。謀ってから動くべし。",
    ko: "하괘가 상괘를 극하여, 안이 밖을 깨려 하니 도모한 뒤 움직이세요.",
  },
  oppressive: {
    zh: "上卦剋下卦,外壓強過內力,事受制於人,宜守不宜進。",
    en: "Upper restrains the lower — outer pressure exceeds inner strength; the matter is constrained, hold rather than advance.",
    ja: "上卦が下卦を剋し、外圧が内を上回り、事は他者に制せられる。守って進まず。",
    ko: "상괘가 하괘를 극하여, 외압이 안의 힘을 넘으니 지키고 나아가지 마세요.",
  },
};

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
      directionTrigram,
      primaryLines,
      changingLines = [],
      locale,
      personaId,
    }: {
      question: string;
      category?: Category;
      directionTrigram: string;
      primaryLines: number[];
      changingLines?: number[];
      locale: Locale;
      personaId?: string;
    } = body;

    const safeLocale: Locale =
      locale === "zh" || locale === "ja" || locale === "ko" ? locale : "en";

    if (!VALID_TRIGRAMS.has(directionTrigram)) {
      return new Response(
        JSON.stringify({ error: `Invalid directionTrigram: ${directionTrigram}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (
      !Array.isArray(primaryLines) ||
      primaryLines.length !== 6 ||
      !primaryLines.every((l) => l === 0 || l === 1)
    ) {
      return new Response(
        JSON.stringify({ error: "primaryLines must be 6 entries of 0 or 1" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (typeof question !== "string" || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Question required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const hex = findHexagram(primaryLines);
    if (!hex) {
      return new Response(JSON.stringify({ error: "Could not resolve hexagram" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 之卦(若有變爻)
    let relatingHex: Hexagram | undefined;
    let relatingLines: number[] | null = null;
    if (Array.isArray(changingLines) && changingLines.length > 0) {
      relatingLines = primaryLines.map((line, i) =>
        changingLines.includes(i) ? (line === 1 ? 0 : 1) : line
      );
      relatingHex = findHexagram(relatingLines);
    }

    const directionTg = trigramNames[directionTrigram];
    const upper = trigramNames[hex.upperTrigram];
    const lower = trigramNames[hex.lowerTrigram];
    const relationship = trigramRelationship(hex.upperTrigram, hex.lowerTrigram);
    const auspice = hexagramAuspice[hex.number];

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
    const cost = CREDIT_COSTS.DIRECTION_HEX;

    if (user) {
      try {
        await spendCredits({
          userId: user.id,
          amount: cost,
          reason: "spend_direction_hex",
          metadata: {
            kind: "iching",
            method: "direction-hexagram",
            hexagramNumber: hex.number,
            directionTrigram,
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
        console.error("[iching/direction-hex] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // ──────────────────────────────────────────
    // 拼 prompt
    // ──────────────────────────────────────────
    const dirName = pickStr(
      safeLocale,
      directionTg.zh,
      directionTg.en,
      directionTg.ja,
      directionTg.ko
    );
    const dirDirection = pickStr(
      safeLocale,
      directionTg.directionZh,
      directionTg.directionEn,
      directionTg.directionJa,
      directionTg.directionKo
    );
    const dirPeople = pickStr(
      safeLocale,
      directionTg.peopleZh,
      directionTg.peopleEn,
      directionTg.peopleJa,
      directionTg.peopleKo
    );
    const dirMatters = pickStr(
      safeLocale,
      directionTg.mattersZh,
      directionTg.mattersEn,
      directionTg.mattersJa,
      directionTg.mattersKo
    );
    const dirAdvice = pickStr(
      safeLocale,
      directionTg.adviceZh,
      directionTg.adviceEn,
      directionTg.adviceJa,
      directionTg.adviceKo
    );

    const hexName = pickStr(safeLocale, hex.nameZh, hex.nameEn, hex.nameJa, hex.nameKo);
    const upperName = pickStr(safeLocale, upper.zh, upper.en, upper.ja, upper.ko);
    const lowerName = pickStr(safeLocale, lower.zh, lower.en, lower.ja, lower.ko);
    const judgmentClassical = hex.judgmentZh;
    const imageClassical = hex.imageZh;
    const judgmentModern = pickStr(
      safeLocale,
      hex.judgmentVernacularZh,
      hex.judgmentEn,
      hex.judgmentJa,
      hex.judgmentKo
    );
    const imageModern = pickStr(
      safeLocale,
      hex.imageVernacularZh,
      hex.imageEn,
      hex.imageJa,
      hex.imageKo
    );

    const auspiceLabel =
      auspice === "great"
        ? pickStr(safeLocale, "大吉", "Auspicious", "大吉", "대길")
        : auspice === "challenge"
          ? pickStr(safeLocale, "艱難", "Challenging", "艱難", "험난")
          : pickStr(safeLocale, "中性", "Mixed", "中性", "중성");

    const relNote = relationship ? RELATIONSHIP_NOTE[relationship] : null;
    const relText = relNote
      ? pickStr(safeLocale, relNote.zh, relNote.en, relNote.ja, relNote.ko)
      : "";

    const changingLineLabel =
      changingLines.length > 0
        ? pickStr(
            safeLocale,
            `變爻:第 ${changingLines.map((l) => l + 1).join("、")} 爻`,
            `Changing lines: ${changingLines.map((l) => l + 1).join(", ")}`,
            `変爻:第 ${changingLines.map((l) => l + 1).join("、")} 爻`,
            `변효: 제 ${changingLines.map((l) => l + 1).join(", ")} 효`
          )
        : pickStr(safeLocale, "無變爻", "No changing lines", "変爻なし", "변효 없음");

    const relatingBlock = relatingHex
      ? pickStr(
          safeLocale,
          `之卦(變後):第 ${relatingHex.number} 卦 ${relatingHex.nameZh}`,
          `Relating hexagram: ${relatingHex.number}. ${relatingHex.nameEn.split(" ")[0]}`,
          `之卦(変後):第 ${relatingHex.number} 卦 ${relatingHex.nameJa ?? relatingHex.nameZh}`,
          `지괘(변화 후): 제 ${relatingHex.number}괘 ${relatingHex.nameKo ?? relatingHex.nameEn.split(" ")[0]}`
        )
      : "";

    const baseSystemPrompt =
      safeLocale === "zh"
        ? `你是一位深諳易經、精通方位卦象合參的占卜師。問事者剛剛完成兩段式占卜:第一段用羅盤卜得後天八卦的某一方位(代表「事之所在 / 應於誰」),第二段用三錢法擲六次得到一個完整的六十四卦(代表「事如何演變」)。

你的任務:
- 把方位的象徵(位置、人事、事理)與卦象的吉凶走勢結合,給出 350-450 字的合參解讀。
- 結構:先承認方位告訴我們什麼(在哪裡、應於誰、什麼性質的事),再說卦象示意的本質與走勢,最後合參兩者並針對問事者的問題給具體建議。
- 文字溫暖具體、避免空話,使用繁體中文,以段落書寫(不要列點),不要重複問題本身。
- 如有變爻,務必納入「之卦」所示的方向。`
        : safeLocale === "ja"
          ? `あなたは易経と方位卦象合参に精通した占い師です。相談者は二段階の占いを終えました:第一段は羅盤で後天八卦の方位を得(「事の在処 / 誰に応じるか」を表す)、第二段は三銭法で六回投げて六十四卦を得ました(「事の行方」を表す)。

あなたの任務:
- 方位の象徴(位置・人事・事理)と卦象の吉凶推移を組み合わせ、350-450 字の合参解読を行う。
- 構成:まず方位が示すこと(どこで、誰に、どんな性質の事)を述べ、次に卦象の本質と推移を語り、最後に両者を合わせ参じて、相談者の問いに具体的な助言をする。
- 文字は温かく具体的に、空疎な言葉を避け、日本語で段落書き(箇条書きは避ける)、質問自体を繰り返さない。
- 変爻があれば之卦の示す方向を必ず織り込む。`
          : safeLocale === "ko"
            ? `당신은 주역과 방위·괘상 합참에 정통한 점술사입니다. 질문자는 두 단계 점을 마쳤습니다: 1단계는 나침반으로 후천팔괘의 방위를 얻었고('일의 자리 / 누구에게 해당하는가' 표상), 2단계는 삼전법으로 여섯 번 던져 64괘를 얻었습니다('일의 흐름' 표상).

당신의 임무:
- 방위의 상징(자리·인사·사리)과 괘상의 길흉 추이를 결합하여 350-450자의 합참 해독을 제공하라.
- 구성: 먼저 방위가 알려주는 바(어디서, 누구에게, 어떤 성질의 일)를 말하고, 이어서 괘상의 본질과 추이를 풀이하며, 마지막으로 양자를 합쳐 질문자의 물음에 구체적 조언을 한다.
- 문장은 따뜻하고 구체적으로, 공허한 말은 피하고, 한국어로 단락을 짓되(글머리 기호 사용 금지) 질문 자체를 반복하지 말 것.
- 변효가 있다면 지괘가 가리키는 방향을 반드시 녹여 넣을 것.`
            : `You are an I Ching diviner skilled in the combined reading of direction and hexagram. The querent has just completed a two-stage divination: Stage 1 spun a compass and obtained a Later-Heaven trigram (representing 'where the matter lies / who is involved'); Stage 2 used the three-coin method six times to derive a complete hexagram (representing 'how the matter unfolds').

Your task:
- Combine the direction's symbolism (location, people, matters) with the hexagram's auspice and movement to produce a combined reading of about 280-360 words.
- Structure: first state what the direction tells us (where, who, what nature of matter); then read the hexagram's essence and movement; finally weave them together with concrete advice for the question.
- Warm, specific tone, no platitudes, English prose paragraphs (no bullets), do not restate the question.
- If changing lines are present, weave in the relating hexagram's direction.`;

    const systemPrompt = appendPersonaPrompt(baseSystemPrompt, persona, safeLocale);

    const userMessage =
      safeLocale === "zh"
        ? `問題:${question}
類別:${category}

【第一段 · 方位】
卦:${directionTg.zh}(${dirName})
方位:${dirDirection}
應於人事:${dirPeople}
事理象徵:${dirMatters}
占斷提示:${dirAdvice}

【第二段 · 六爻卦象】
本卦:第 ${hex.number} 卦 ${hex.nameZh}(${hexName})
上卦:${upper.zh}(${upperName})／下卦:${lower.zh}(${lowerName})
吉凶傾向:${auspiceLabel}
上下卦關係:${relText}
卦辭:${judgmentClassical}
卦辭白話:${judgmentModern}
象辭:${imageClassical}
象辭白話:${imageModern}
${changingLineLabel}
${relatingBlock}

請依系統 prompt 的指示,把方位與卦象合參,給出針對我問題的具體解讀。`
        : safeLocale === "ja"
          ? `質問:${question}
カテゴリ:${category}

【第一段 · 方位】
卦:${directionTg.zh}(${dirName})
方位:${dirDirection}
応じる人事:${dirPeople}
事理の象徴:${dirMatters}
占断のヒント:${dirAdvice}

【第二段 · 六爻卦象】
本卦:第 ${hex.number} 卦 ${hex.nameZh}(${hexName})
上卦:${upper.zh}(${upperName})／下卦:${lower.zh}(${lowerName})
吉凶傾向:${auspiceLabel}
上下卦の関係:${relText}
卦辞(原文):${judgmentClassical}
卦辞(現代訳):${judgmentModern}
象辞(原文):${imageClassical}
象辞(現代訳):${imageModern}
${changingLineLabel}
${relatingBlock}

システム指示に従い、方位と卦象を合わせ参じて私の質問に具体的な解読を。`
          : safeLocale === "ko"
            ? `질문: ${question}
분류: ${category}

【1단 · 방위】
괘: ${directionTg.zh}(${dirName})
방위: ${dirDirection}
해당 인사: ${dirPeople}
사리의 상징: ${dirMatters}
점단의 힌트: ${dirAdvice}

【2단 · 육효 괘상】
본괘: 제 ${hex.number}괘 ${hex.nameZh}(${hexName})
상괘: ${upper.zh}(${upperName}) / 하괘: ${lower.zh}(${lowerName})
길흉 경향: ${auspiceLabel}
상하괘 관계: ${relText}
괘사(원문): ${judgmentClassical}
괘사(현대): ${judgmentModern}
상사(원문): ${imageClassical}
상사(현대): ${imageModern}
${changingLineLabel}
${relatingBlock}

시스템 지시에 따라 방위와 괘상을 합쳐 제 질문에 구체적으로 해독해 주세요.`
            : `Question: ${question}
Category: ${category}

[Stage 1 · Direction]
Trigram: ${directionTg.zh} (${dirName})
Direction: ${dirDirection}
Who it concerns: ${dirPeople}
Symbolism of matter: ${dirMatters}
Divinatory hint: ${dirAdvice}

[Stage 2 · Six-Line Hexagram]
Primary: ${hex.number}. ${hex.nameZh} (${hexName})
Upper: ${upper.zh} (${upperName}) / Lower: ${lower.zh} (${lowerName})
Auspice: ${auspiceLabel}
Trigram relationship: ${relText}
Judgment (classical): ${judgmentClassical}
Judgment (modern): ${judgmentModern}
Image (classical): ${imageClassical}
Image (modern): ${imageModern}
${changingLineLabel}
${relatingBlock}

Follow the system instructions: combine direction and hexagram into a concrete reading for my question.`;

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
      console.error("DeepSeek API error (iching/direction-hex):", response.status, err);
      if (user) {
        await refundCredits({
          userId: user.id,
          amount: cost,
          errorMessage: `iching/direction-hex deepseek ${response.status}: ${err.slice(0, 200)}`,
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────
    // 流式吐字 + 同時收集成完整 reading 寫入 DB(在 finally 階段做)
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
          console.error("IChing direction-hex stream error:", e);
        } finally {
          controller.close();

          // DB insert 由前端 saveDivination 處理(method='direction-hexagram')— 這裡不再寫,
          // 避免跟 home page result step 的 saveDivination 雙寫造成 duplicate row。
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-DH-HexagramNumber": String(hex.number),
        "X-DH-RelatingNumber": relatingHex ? String(relatingHex.number) : "",
        "X-DH-DirectionTrigram": directionTrigram,
      },
    });
  } catch (error) {
    console.error("IChing direction-hex API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get reading" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
