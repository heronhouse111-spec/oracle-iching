/**
 * /api/divine/two-options — 易經二擇一(雙卦比對版)
 *
 * 跟 /api/divine 的差別:
 *   - /api/divine 是「單卦 + 結構化 A/B 標籤」,AI 看一卦推一邊
 *   - 本 endpoint 收「兩個獨立的卦」(hexA = 為 A 起的卦,hexB = 為 B 起的卦),
 *     AI 比對兩卦的吉凶 / 動爻 / 之卦走向,基於兩卦差異做明確推薦
 *
 * 為什麼獨立成新 endpoint:
 *   - 計費不同(IC_TWO_OPTIONS = 10,跟 DIVINE 5 不一樣)
 *   - prompt 結構完全不同(雙卦比對表 + 對比決斷模式)
 *   - 收藏記錄要記兩張卦(主流程只記一張)
 *   - 不引入向後相容包袱,讓 /api/divine 的 single-hex 路徑保持單純
 *
 * 客戶端流程(/iching/two-options/page.tsx):
 *   ask → throwingA(performDivination) → throwingB(performDivination)
 *   → POST 到本 endpoint → 收到 streaming AI 回應
 */

import { NextRequest } from "next/server";
import { getHexagramByNumber } from "@/data/hexagrams";
import { createClient } from "@/lib/supabase/server";
import {
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
} from "@/lib/credits";
import { withSafetyPreamble } from "@/lib/ai/guardrail";
import { appendPersonaPrompt } from "@/lib/personas";
import { resolvePersonaServer } from "@/lib/personasDb";
import { recordCardObtained } from "@/lib/cardCollection";
import { getCreditCost } from "@/lib/creditCostsDb";
import { validateUserText } from "@/lib/validateUserText";

interface CastInput {
  hexagramNumber: number;
  changingLines: number[];
  relatingHexagramNumber: number | null;
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
      question,
      optionA,
      optionB,
      castA,
      castB,
      locale,
      personaId,
    }: {
      question: string;
      optionA: string;
      optionB: string;
      castA: CastInput;
      castB: CastInput;
      locale: "zh" | "en" | "ja" | "ko";
      personaId?: string;
    } = body;

    // ──── 基本欄位驗證 ────
    {
      // question / optionA / optionB 都套 300 字上限(對應前端 maxLength 設定)
      const qErr = validateUserText(question);
      if (qErr) return qErr;
      const aErr = validateUserText(optionA, { field: "optionA" });
      if (aErr) return aErr;
      const bErr = validateUserText(optionB, { field: "optionB" });
      if (bErr) return bErr;
    }
    if (!castA?.hexagramNumber || !castB?.hexagramNumber) {
      return new Response(
        JSON.stringify({ error: "Missing cast hexagrams" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const hexA = getHexagramByNumber(castA.hexagramNumber);
    const hexB = getHexagramByNumber(castB.hexagramNumber);
    const relA = castA.relatingHexagramNumber
      ? getHexagramByNumber(castA.relatingHexagramNumber)
      : null;
    const relB = castB.relatingHexagramNumber
      ? getHexagramByNumber(castB.relatingHexagramNumber)
      : null;
    if (!hexA || !hexB) {
      return new Response(JSON.stringify({ error: "Invalid hexagram number" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const isZh = locale === "zh";
    const isJa = locale === "ja";
    const isKo = locale === "ko";

    // ──── 點數扣款 ────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    const cost = await getCreditCost("IC_TWO_OPTIONS");

    if (user) {
      try {
        await spendCredits({
          userId: user.id,
          amount: cost,
          reason: "spend_ic_two_options",
          metadata: {
            hexA: castA.hexagramNumber,
            hexB: castB.hexagramNumber,
            locale,
            personaId: persona.id,
          },
        });
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          const insufficientMsg = isZh
            ? "點數不足"
            : isJa
              ? "ポイントが不足しています"
              : isKo
                ? "포인트가 부족합니다"
                : "Insufficient credits";
          return new Response(
            JSON.stringify({
              error: "INSUFFICIENT_CREDITS",
              required: cost,
              message: insufficientMsg,
            }),
            { status: 402, headers: { "Content-Type": "application/json" } }
          );
        }
        console.error("[divine/two-options] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
    }
    // 訪客:不扣點、不收藏。允許首次體驗以走漏斗,跟 /api/divine 一致。

    // ──── 卡牌收藏 — 兩卦各記一張(只本卦,不含之卦,跟主流程一致)────
    let collectionNewCount = 0;
    let collectionFinalCount = 0;
    let collectionRewards = 0;
    if (user) {
      const recA = await recordCardObtained({
        userId: user.id,
        collectionType: "iching",
        cardId: String(castA.hexagramNumber),
        source: "ic_two_options",
      });
      const recB = await recordCardObtained({
        userId: user.id,
        collectionType: "iching",
        cardId: String(castB.hexagramNumber),
        source: "ic_two_options",
      });
      collectionNewCount = (recA.isNew ? 1 : 0) + (recB.isNew ? 1 : 0);
      collectionFinalCount = recB.distinctCount; // recB 是後寫入的,reflects 最後狀態
      collectionRewards = recA.rewardCredits + recB.rewardCredits;
    }

    // ──── Prompt 組裝(4 語系)────
    // 字數目標:中文 600 字、英文 ~400 字、日文 ~500 文字、韓文 ~500 자
    const wordTargets = {
      zh: "約 600 字",
      en: "around 400 words",
      ja: "約 500 文字",
      ko: "약 500 자",
    } as const;
    const wordTarget = wordTargets[locale];

    const baseSystemPrompt = isZh
      ? `你是一位精通易經的占卜師。問事者面臨二擇一決策,為「選項 A」與「選項 B」分別起了一卦。請你比對兩卦的吉凶傾向、內外卦結構、變爻意義與之卦走向,基於兩卦的差異給出明確推薦,${wordTarget}。卦辭原文系統已顯示,不要重複。語氣親切但要明確,使用繁體中文,用段落書寫,不要列點。`
      : isJa
        ? `あなたは易経に精通した占い師です。問う者は二択の決断を迫られ、「選択 A」と「選択 B」のためにそれぞれ卦を立てました。両卦の吉凶傾向、内卦・外卦の構成、変爻の意味、之卦の流れを比較し、両卦の違いに基づいて明確な推奨を ${wordTarget} で提示してください。卦辞の原文はすでに表示されているので繰り返さないでください。親しみやすくも明確な口調で、段落形式で書き、箇条書きにはしないでください。`
        : isKo
          ? `당신은 주역에 정통한 점술가입니다. 질문자는 양자택일의 결정을 앞두고 '선택 A'와 '선택 B'를 위해 각각 괘를 세웠습니다. 두 괘의 길흉 경향, 내외 팔괘 구성, 변효의 의미, 지괘의 흐름을 비교하고, 두 괘의 차이를 근거로 ${wordTarget} 분량의 명확한 추천을 제시해 주세요. 괘사 원문은 시스템이 이미 표시했으므로 반복하지 마세요. 친근하지만 분명한 어조로, 단락 형식으로 작성하고 불릿은 사용하지 마세요.`
          : `You are a wise I Ching consultant. The querent faces a two-choice decision and has cast a separate hexagram for Option A and Option B. Compare the two hexagrams — judgment, inner/outer trigram structure, changing lines, and the relating hexagram's direction — and give a clear recommendation grounded in their differences. ${wordTarget}. Hexagram texts are already shown. Warm but committed tone, flowing paragraphs, no bullets.`;

    const verdictRulesZh = `

━━━━━━━━━━━━━━━━━━━━━━━━━━
【雙卦比對 · 二擇一決斷模式 — 必須遵守】
1. 嚴禁「兩個都好 / 兩個都不好 / 看你自己 / 各有利弊」這類水球話。結尾必須「明確推 A 或 B」。
2. 推薦的依據完全來自「比較兩卦的優劣」 — 比較哪一卦的卦辭更吉、變爻走向更順、之卦更利、內外卦更相生、整體更利於進行或更能保護現況。哪一卦比較吉,就推那一邊的選項。請把這個比較過程寫出來。
3. 若兩卦都偏向「不利於現在動」,請建議「暫緩」並比較 A / B 哪一邊較能保護現況,推穩的那邊。
4. 開頭一段先各自簡述兩卦對該選項的訊息,中段做差異比對,結尾一句必須是清楚的決斷,例如:「綜合兩卦,建議你選 A。」或「綜合兩卦,建議你選 B。」 — 結論必須由前面卦象比較的結果決定;若 B 卦更吉就推 B,不可因為 A 列在問題前面就習慣性偏 A。可以附帶提醒(「不過要注意 X」),但決斷本身不可模糊。
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const verdictRulesEn = `

━━━━━━━━━━━━━━━━━━━━━━━━━━
[TWO-HEXAGRAM COMPARISON · DECISION MODE — MUST FOLLOW]
1. Do NOT hedge with "both have merit", "either is fine", "it's up to you", "they're equally valid". You MUST recommend A or B at the end.
2. The recommendation MUST come from comparing the two hexagrams' relative favorability — which judgment is more auspicious, which changing-line direction is smoother, which relating hexagram is more favorable, which trigram pair harmonizes better, which one supports action or better preserves the ground. Recommend the option whose hexagram is more favorable. Show this comparison in your reading.
3. If both hexagrams lean against action, recommend "hold" and identify which of A / B better preserves the current ground — still pick one.
4. Open by briefly characterising what each hexagram says about its option, then compare, and close with a clear verdict like "On balance, I recommend Option A." or "On balance, I recommend Option B." — the verdict must follow from the comparison above; if B's hexagram is more favorable, pick B, do NOT default to A just because it is listed first. A caveat ("watch out for X") is fine — the verdict itself must not be vague.
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const verdictRulesJa = `

━━━━━━━━━━━━━━━━━━━━━━━━━━
【双卦比較 · 二択判定モード — 必ず守ること】
1. 「両方とも良い / どちらでもよい / あなた次第 / 一長一短」のような曖昧な結論は禁止。最後に必ず「A か B のどちらかを明確に推奨」してください。
2. 推奨の根拠は「両卦の優劣を比較すること」に限ります — どちらの卦辞がより吉か、変爻の流れがより順調か、之卦がより有利か、内外卦がより相生か、全体としてどちらが行動に有利または現状の保護に適しているかを比べ、より吉である側の選択肢を推奨してください。この比較過程を読み解きの中に書き出すこと。
3. 両卦とも「動かない方が良い」と示している場合は「保留」を勧めた上で、A / B のどちらが現状を守るかを比較し、安定する側を推してください。
4. 冒頭で各卦が示すメッセージを簡述し、中段で差異を比較し、最終一文は明確な判定で締める。例:「総合的に判断して、A を選ぶことをお勧めします。」または「総合的に判断して、B を選ぶことをお勧めします。」 — 結論は前述の比較から導くこと。B 卦の方が吉なら B を推し、A が問いの先に並んでいるからといって習慣的に A に偏ってはいけない。注意点(「ただし X に気をつけて」)を添えるのは可、ただし判定自体は曖昧にしないこと。
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const verdictRulesKo = `

━━━━━━━━━━━━━━━━━━━━━━━━━━
[양 괘 비교 · 양자택일 판정 모드 — 반드시 따를 것]
1. "둘 다 좋다 / 어느 쪽이든 괜찮다 / 본인 마음 / 각각 장단점이 있다" 같은 모호한 결론은 금지합니다. 마지막에 반드시 "A 또는 B 중 한쪽을 명확히 추천"하세요.
2. 추천의 근거는 오로지 "두 괘의 우열 비교"에서 나와야 합니다 — 어느 쪽 괘사가 더 길한지, 변효의 흐름이 더 순한지, 지괘가 더 유리한지, 내외괘가 더 상생인지, 전체적으로 어느 쪽이 행동에 유리하거나 현 상태를 더 잘 보호하는지를 비교하고, 더 길한 쪽의 선택지를 추천하세요. 이 비교 과정을 풀이 속에 분명히 적어 주세요.
3. 두 괘가 모두 "움직이지 말라"고 시사한다면 '보류'를 권하되 A / B 중 현 상태를 더 잘 보호하는 쪽을 비교해 안정적인 쪽을 추천하세요.
4. 첫 단락에서 각 괘가 해당 선택에 대해 시사하는 바를 간단히 서술하고, 중반에서 차이를 비교하며, 마지막 문장은 분명한 판정으로 끝낼 것. 예: "종합적으로 판단할 때 A 를 추천드립니다." 또는 "종합적으로 판단할 때 B 를 추천드립니다." — 결론은 위의 비교에서 도출되어야 합니다. B 의 괘가 더 길하면 B 를 추천하세요. A 가 앞에 나열돼 있다는 이유로 습관적으로 A 로 기울어서는 안 됩니다. 주의사항("단, X 에 유의하세요")은 가능하지만 판정 자체는 흐릿하게 하지 마세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const verdictRules = isZh
      ? verdictRulesZh
      : isJa
        ? verdictRulesJa
        : isKo
          ? verdictRulesKo
          : verdictRulesEn;

    const systemPromptBase = appendPersonaPrompt(baseSystemPrompt, persona, locale);
    const systemPrompt = systemPromptBase + verdictRules;

    const fmtChanging = (cs: number[]): string => {
      if (cs.length === 0) {
        return isZh
          ? "無變爻"
          : isJa
            ? "変爻なし"
            : isKo
              ? "변효 없음"
              : "No changing lines";
      }
      const numList = cs.map((l) => l + 1);
      if (isZh) return `第${numList.join("、")}爻變`;
      if (isJa) return `第${numList.join("・")}爻が変`;
      if (isKo) return `제${numList.join("·")}효 변`;
      return `Lines ${numList.join(", ")} changing`;
    };

    // 卦名 — zh/ja 取漢字版,ko 也取漢字版(韓文易經傳統用漢字卦名),en 取英譯
    const hexNameLocalized = (h: typeof hexA) =>
      isZh || isJa || isKo ? h.nameZh : h.nameEn;

    const userMessage = isZh
      ? `問題:${question}

【選項 A】:${optionA}
為 A 起的卦 → 第 ${hexA.number} 卦 ${hexA.nameZh}
卦辭:${hexA.judgmentZh}
象辭:${hexA.imageZh}
${fmtChanging(castA.changingLines)}${relA ? `\n之卦:第 ${relA.number} 卦 ${relA.nameZh}` : ""}

【選項 B】:${optionB}
為 B 起的卦 → 第 ${hexB.number} 卦 ${hexB.nameZh}
卦辭:${hexB.judgmentZh}
象辭:${hexB.imageZh}
${fmtChanging(castB.changingLines)}${relB ? `\n之卦:第 ${relB.number} 卦 ${relB.nameZh}` : ""}

請比對兩卦,給出 ${wordTarget} 的分析,結尾明確推 A 或 B。`
      : isJa
        ? `質問:${question}

【選択 A】:${optionA}
A のために立てた卦 → 第 ${hexA.number} 卦 ${hexNameLocalized(hexA)}
卦辞:${hexA.judgmentZh}(原文)
象辞:${hexA.imageZh}(原文)
${fmtChanging(castA.changingLines)}${relA ? `\n之卦:第 ${relA.number} 卦 ${relA.nameZh}` : ""}

【選択 B】:${optionB}
B のために立てた卦 → 第 ${hexB.number} 卦 ${hexNameLocalized(hexB)}
卦辞:${hexB.judgmentZh}(原文)
象辞:${hexB.imageZh}(原文)
${fmtChanging(castB.changingLines)}${relB ? `\n之卦:第 ${relB.number} 卦 ${relB.nameZh}` : ""}

両卦を比較し、${wordTarget} で分析した上で、最後に A か B を明確に推奨してください。日本語で回答してください。`
        : isKo
          ? `질문: ${question}

[선택 A]: ${optionA}
A 를 위해 세운 괘 → 제 ${hexA.number} 괘 ${hexNameLocalized(hexA)}
괘사: ${hexA.judgmentZh} (원문)
상사: ${hexA.imageZh} (원문)
${fmtChanging(castA.changingLines)}${relA ? `\n지괘: 제 ${relA.number} 괘 ${relA.nameZh}` : ""}

[선택 B]: ${optionB}
B 를 위해 세운 괘 → 제 ${hexB.number} 괘 ${hexNameLocalized(hexB)}
괘사: ${hexB.judgmentZh} (원문)
상사: ${hexB.imageZh} (원문)
${fmtChanging(castB.changingLines)}${relB ? `\n지괘: 제 ${relB.number} 괘 ${relB.nameZh}` : ""}

두 괘를 비교하여 ${wordTarget} 분량으로 분석한 뒤, 마지막에 A 또는 B 를 분명히 추천해 주세요. 한국어로 답해 주세요.`
          : `Question: ${question}

[Option A]: ${optionA}
Cast for A → Hexagram ${hexA.number}: ${hexA.nameEn}
Judgment: ${hexA.judgmentEn}
Image: ${hexA.imageEn}
${fmtChanging(castA.changingLines)}${relA ? `\nRelating: ${relA.number} - ${relA.nameEn}` : ""}

[Option B]: ${optionB}
Cast for B → Hexagram ${hexB.number}: ${hexB.nameEn}
Judgment: ${hexB.judgmentEn}
Image: ${hexB.imageEn}
${fmtChanging(castB.changingLines)}${relB ? `\nRelating: ${relB.number} - ${relB.nameEn}` : ""}

Compare the two hexagrams. ${wordTarget}. End with a clear A or B verdict.`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: withSafetyPreamble(systemPrompt, locale) },
          { role: "user", content: userMessage },
        ],
        // 600 中文字 / 400 英文字 / 500 日韓 — 留 token 餘裕避免被截斷
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[divine/two-options] DeepSeek API error:", response.status, err);
      if (user) {
        await refundCredits({
          userId: user.id,
          amount: cost,
          errorMessage: `divine/two-options deepseek ${response.status}: ${err.slice(0, 200)}`,
        });
      }
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
                // skip malformed JSON chunks
              }
            }
          }
        } catch (e) {
          console.error("[divine/two-options] Stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Collection-IsNew": String(collectionNewCount),
        "X-Collection-Count": String(collectionFinalCount),
        "X-Collection-Rewards": String(collectionRewards),
      },
    });
  } catch (error) {
    console.error("[divine/two-options] API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get reading" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
