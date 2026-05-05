import { NextRequest } from "next/server";
import { getCardById, SUIT_NAMES_ZH, SUIT_NAMES_EN } from "@/data/tarot";
import { getSpread, type Spread } from "@/data/spreads";
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
import { recordCardObtained, aggregateResults } from "@/lib/cardCollection";
import { getCreditCost } from "@/lib/creditCostsDb";
import {
  detectTwoChoiceQuestion,
  buildDecisionModePrompt,
} from "@/lib/twoChoice";
import { validateUserText } from "@/lib/validateUserText";

// 客戶端送來的「抽牌結果」— position 改為任意 string,給多牌陣用
interface DrawnCardRequest {
  cardId: string;
  position: string;
  isReversed: boolean;
}

/**
 * 多牌陣加價表 — cardCount → cost
 * 3 卡走原本 TAROT(5),5/10/12 卡各自獨立費率(避免一張卡都加 1 點不夠勸退濫用)
 */
async function tarotCostFor(spread: Spread, isFollowUp: boolean): Promise<number> {
  if (isFollowUp) return getCreditCost("TAROT_FOLLOWUP");
  switch (spread.cardCount) {
    case 3: return getCreditCost("TAROT");
    case 5: return getCreditCost("TAROT_5_CARD");
    case 10: return getCreditCost("TAROT_10_CARD");
    case 12: return getCreditCost("TAROT_12_CARD");
    default: return getCreditCost("TAROT");
  }
}

/**
 * 各牌陣的 AI 解讀篇幅
 *   love-cross  : 600 字 / ~450 words(5 張要彼此呼應,寫得完整)
 *   celtic-cross: 1000 字 / ~750 words(10 張完整人生命題,需要長篇)
 *   其他牌陣 → 沿用 depth 規則:Quick 約 200 / Deep 約 500
 * max_tokens 抓字數 × ~2(中文約 1 token/字,留 buffer 讓模型完成段落)
 */
function tarotWordTargetFor(spread: Spread, isDeep: boolean): {
  zh: string;
  en: string;
  maxTokens: number;
} {
  if (spread.id === "love-cross") {
    return { zh: "約 600 字", en: "around 450 words", maxTokens: 1600 };
  }
  if (spread.id === "celtic-cross") {
    return { zh: "約 1000 字", en: "around 750 words", maxTokens: 2400 };
  }
  return isDeep
    ? { zh: "約 500 字", en: "around 350 words", maxTokens: 1400 }
    : { zh: "約 200 字", en: "around 150 words", maxTokens: 600 };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const {
      cards,
      question,
      category,
      locale,
      // 衍伸問題繼續占卜(跟 /api/divine 同樣的機制)
      previousContext,
      chatHistory,
      // 新增 — 預設 three-card 維持向後相容
      spreadId,
      personaId,
      depth,
      // 二擇一牌陣才有 — 使用者填寫的兩個具體選項。
      // 這兩個欄位也會跟 question 文字偵測一起餵進「強建議模式」,
      // 讓 AI 在二選一場景必須結尾推一邊,不再水球。
      twoOptionA,
      twoOptionB,
    }: {
      cards: DrawnCardRequest[];
      question: string;
      category: string;
      locale: "zh" | "en";
      previousContext?: string | null;
      chatHistory?: { role: "user" | "assistant"; content: string }[] | null;
      spreadId?: string;
      personaId?: string;
      depth?: "quick" | "deep";
      twoOptionA?: string;
      twoOptionB?: string;
    } = body;

    // 對應前端 maxLength={300};二擇一 A/B 標籤前端 200,server 端寬鬆給 300
    {
      const err = validateUserText(question);
      if (err) return err;
      if (twoOptionA != null) {
        const e = validateUserText(twoOptionA, { field: "twoOptionA", allowEmpty: true });
        if (e) return e;
      }
      if (twoOptionB != null) {
        const e = validateUserText(twoOptionB, { field: "twoOptionB", allowEmpty: true });
        if (e) return e;
      }
    }

    const spread = getSpread(spreadId);
    const isDeep = depth === "deep";

    // 二選一才生效;其他牌陣即使誤帶也忽略,避免 prompt 裡出現無意義段落
    const optA = spread.id === "two-options" && typeof twoOptionA === "string" ? twoOptionA.trim().slice(0, 200) : "";
    const optB = spread.id === "two-options" && typeof twoOptionB === "string" ? twoOptionB.trim().slice(0, 200) : "";
    const hasTwoOptions = spread.id === "two-options" && optA.length > 0 && optB.length > 0;

    if (!Array.isArray(cards) || cards.length !== spread.cardCount) {
      return new Response(
        JSON.stringify({
          error: `Spread ${spread.id} requires exactly ${spread.cardCount} cards (got ${
            Array.isArray(cards) ? cards.length : "non-array"
          })`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 把每張卡的 id + position 查回完整資料(不信任客戶端帶的牌義)
    const enriched = cards.map((c) => {
      const card = getCardById(c.cardId);
      const posMeta = spread.positions.find((p) => p.key === c.position);
      return { ...c, card, posMeta };
    });

    for (const e of enriched) {
      if (!e.card || !e.posMeta) {
        return new Response(
          JSON.stringify({
            error: `Unknown card id or position for spread ${spread.id}: ${e.cardId} / ${e.position}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const isZh = locale === "zh";
    const isFollowUp = Boolean(previousContext && previousContext.trim().length > 0);

    // ──────────────────────────────────────────
    // 點數扣款(登入者才扣,訪客維持 1 次免費占卜的漏斗)
    // ──────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 訂閱判定 — 給 persona 解鎖 + Deep Insight 解鎖判斷用
    let isActiveSubscriber = false;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle();
      isActiveSubscriber = Boolean(profile?.is_active);
    }

    // Deep Insight 限訂閱戶 — 非訂閱戶傳 deep 自動降級為 quick
    const effectiveDepth: "quick" | "deep" =
      isDeep && isActiveSubscriber ? "deep" : "quick";

    // Persona — premium 人格在非訂閱戶會自動退回 default
    const persona = await resolvePersonaServer(personaId, isActiveSubscriber);

    let cost = await tarotCostFor(spread, isFollowUp);
    if (effectiveDepth === "deep") cost += await getCreditCost("DEEP_INSIGHT_SURCHARGE");
    const reason = isFollowUp ? "spend_tarot_followup" : "spend_tarot";

    if (user) {
      try {
        await spendCredits({
          userId: user.id,
          amount: cost,
          reason,
          metadata: {
            category,
            isFollowUp,
            locale,
            spreadId: spread.id,
            personaId: persona.id,
            depth: effectiveDepth,
            cards: cards.map((c) => ({ id: c.cardId, pos: c.position, rev: c.isReversed })),
          },
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
        console.error("[tarot] spendCredits failed:", err);
        return new Response(JSON.stringify({ error: "Failed to deduct credits" }), {
          status: 500, headers: { "Content-Type": "application/json" },
        });
      }
    } else if (isFollowUp) {
      return new Response(
        JSON.stringify({ error: "LOGIN_REQUIRED", message: "Please sign in to continue" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    } else if (spread.cardCount > 3) {
      // 訪客不能跑大牌陣(避免吃資源 + 引導註冊)
      return new Response(
        JSON.stringify({ error: "LOGIN_REQUIRED", message: "Please sign in to use larger spreads" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 卡牌收藏 — 塔羅主流程把每張抽到的牌都收進去(去重 dedupe by cardId)
    let collectionNewCount = 0;
    let collectionDupCount = 0;
    let collectionFinalCount = 0;
    let collectionRewards = 0;
    /** 這輪抽到的所有 unique cardId(給 client 顯示 toast 用,順序 = 寫入順序) */
    const collectionCardIds: string[] = [];
    if (user) {
      const seen = new Set<string>();
      const toRecord: Array<{ cardId: string; subkind: string }> = [];
      for (const c of cards) {
        if (seen.has(c.cardId)) continue;
        seen.add(c.cardId);
        const meta = getCardById(c.cardId);
        if (!meta) continue;  // 不認得的 cardId 跳過(client 亂送的 id)
        toRecord.push({ cardId: c.cardId, subkind: meta.suit });
        collectionCardIds.push(c.cardId);
      }
      const results = [];
      for (const item of toRecord) {
        results.push(
          await recordCardObtained({
            userId: user.id,
            collectionType: "tarot",
            cardId: item.cardId,
            cardSubkind: item.subkind as "major" | "wands" | "cups" | "swords" | "pentacles",
            source: "main",
          }),
        );
      }
      const agg = aggregateResults(results);
      collectionNewCount = agg.newCardCount;
      collectionDupCount = results.length - agg.newCardCount;
      collectionFinalCount = agg.finalDistinctCount;
      collectionRewards = agg.totalRewardCredits;
    }

    // 字數規格:愛情十字 600 字 / 凱爾特十字 1000 字 / 其他依 depth(Quick 200、Deep 500)
    const wordTarget = tarotWordTargetFor(spread, effectiveDepth === "deep");
    const wordTargetZh = wordTarget.zh;
    const wordTargetEn = wordTarget.en;
    const spreadNameZh = spread.nameZh;
    const spreadNameEn = spread.nameEn;

    // 二選一專屬指引 — 牌陣的「選擇 A」「選擇 B」位置實際對應的就是使用者寫下的 optA / optB
    const twoOptionsHintZh = hasTwoOptions
      ? `\n注意:此牌陣的「選擇 A」位置代表問事者在思考的具體選項「${optA}」,「選擇 B」位置代表「${optB}」。請在解盤中明確以這兩個具體選項的名稱來談,例如「就 ${optA} 這條路而言...」「相對地若選 ${optB}...」,最後比較兩條路的能量並給出傾向建議。`
      : "";
    const twoOptionsHintEn = hasTwoOptions
      ? `\nNote: in this spread the "Option A" position represents the querent's actual choice "${optA}", and "Option B" represents "${optB}". Refer to these by name in your reading (e.g. "On the ${optA} path..." vs "Whereas if you choose ${optB}..."), then compare the energies and give a directional recommendation at the end.`
      : "";

    const baseSystemZh = isFollowUp
      ? `你是一位深諳塔羅的占卜師。這是問事者就同一件事所做的「衍伸占卜」——你已經幫他做過前一輪(易經或塔羅)的解盤,也跟他在聊天框裡對話過。現在他針對同件事提出更深入的問題,又抽了「${spreadNameZh}」(${spread.cardCount} 張)。請把「前一輪結果 + 先前對話 + 新牌陣」串成連貫的延伸解說,直接呼應前面講過的脈絡(例如「承接剛才我們談到的...」),${wordTargetZh}。每張牌的牌義系統已提供,不要逐張複述,而是把整個牌陣串成回應問題的故事。使用繁體中文,用段落書寫,不要列點。${twoOptionsHintZh}`
      : `你是一位深諳塔羅的占卜師。使用者用「${spreadNameZh}」(${spread.cardCount} 張)針對一個問題占卜。每張牌的牌義(正位/逆位)以及它在牌陣中對應的位置與意義已由系統提供,你不需要重複牌義,而是要把所有牌串成一個針對問事者具體問題的連貫故事,並給出實際可行的建議。${effectiveDepth === "deep" ? "Deep Insight 模式 — 請特別交叉比對牌之間的關係(例如哪兩張牌互相呼應、哪一張在拖後腿)、揭示牌組合背後的潛在模式,並給出具體可執行的下一步。" : ""}語氣溫暖、貼近生活。${wordTargetZh},用段落書寫,不要列點。使用繁體中文。${twoOptionsHintZh}`;

    const baseSystemEn = isFollowUp
      ? `You are a skilled tarot reader. This is a FOLLOW-UP reading on the same matter — you've already done a prior reading (I Ching or tarot) for this querent and chatted with them. They're asking a deeper question and drew the "${spreadNameEn}" (${spread.cardCount} cards). Weave "prior result + earlier conversation + new spread" into a coherent continuation, explicitly referencing the prior context. ${wordTargetEn}. Card meanings are already provided — don't restate; weave the whole spread into a story answering their question. Warm flowing paragraphs, no bullets.${twoOptionsHintEn}`
      : `You are a skilled tarot reader. The querent drew the "${spreadNameEn}" (${spread.cardCount} cards) for a specific question. Card meanings (upright/reversed) and each position's significance are provided by the system — do NOT simply repeat them. Weave the entire spread into a coherent narrative about the querent's actual question and give practical, concrete advice. ${effectiveDepth === "deep" ? "Deep Insight mode — cross-reference relationships between cards (which echo each other, which holds back), reveal latent patterns, and give specific actionable next steps." : ""}Warm tone, ${wordTargetEn}, flowing paragraphs (no bullets).${twoOptionsHintEn}`;

    const baseSystemPrompt = isZh ? baseSystemZh : baseSystemEn;

    // 二擇一強建議模式 — 三種觸發:
    //   1. two-options 牌陣本身(spread.id)
    //   2. 任一牌陣只要使用者帶了結構化 twoOptionA / twoOptionB
    //   3. 任一牌陣的自由文字 question 命中「A 還是 B」之類的 pattern
    // 命中後在 system prompt 末段附上強建議指示,讓 AI 結尾必須推一邊。
    // (主要差別跟前面的 twoOptionsHint 區隔:Hint 只是告訴 AI 哪個位置
    //  對應哪個選項;decision-mode 才強迫 AI 不准水球話。)
    const isTwoChoice =
      hasTwoOptions ||
      spread.id === "two-options" ||
      detectTwoChoiceQuestion(question);

    const systemPromptBase = appendPersonaPrompt(baseSystemPrompt, persona, locale);
    const systemPrompt = isTwoChoice
      ? systemPromptBase +
        buildDecisionModePrompt({
          optionA: hasTwoOptions ? optA : null,
          optionB: hasTwoOptions ? optB : null,
          locale,
        })
      : systemPromptBase;

    const chatExcerpt = (chatHistory ?? [])
      .slice(-6)
      .map((m) => {
        const who = isZh
          ? (m.role === "user" ? "問事者" : "老師")
          : (m.role === "user" ? "Querent" : "Master");
        return `${who}: ${m.content}`;
      })
      .join("\n");

    const contextBlock = isFollowUp
      ? (isZh
        ? `【前情提要 — 同一件事的先前占卜與對話】\n${previousContext}\n${chatExcerpt ? `\n【先前聊天紀錄(節錄)】\n${chatExcerpt}\n` : ""}\n`
        : `[PRIOR CONTEXT — earlier reading & chat on the same matter]\n${previousContext}\n${chatExcerpt ? `\n[EARLIER CHAT (excerpt)]\n${chatExcerpt}\n` : ""}\n`)
      : "";

    // 組裝 user message — 含問題 + 每張牌的位置/名稱/正逆位/牌義/位置意義
    const cardDescriptions = enriched
      .map((e) => {
        const card = e.card!;
        const pos = e.posMeta!;
        const suitZh = SUIT_NAMES_ZH[card.suit];
        const suitEn = SUIT_NAMES_EN[card.suit];
        const meaning = e.isReversed
          ? (isZh ? card.reversedMeaningZh : card.reversedMeaningEn)
          : (isZh ? card.uprightMeaningZh : card.uprightMeaningEn);
        const orientationZh = e.isReversed ? "逆位" : "正位";
        const orientationEn = e.isReversed ? "Reversed" : "Upright";
        if (isZh) {
          return `【${pos.labelZh} — ${pos.descZh}】\n${card.nameZh}(${suitZh}・${orientationZh})\n牌義:${meaning}`;
        }
        return `[${pos.labelEn} — ${pos.descEn}]\n${card.nameEn} (${suitEn}, ${orientationEn})\nMeaning: ${meaning}`;
      })
      .join("\n\n");

    const newQuestionLine = isZh
      ? (isFollowUp ? `新問題(${category}):${question}` : `問題(${category}):${question}`)
      : (isFollowUp ? `New question (${category}): ${question}` : `Question (${category}): ${question}`);

    const optionsBlock = hasTwoOptions
      ? (isZh
          ? `\n\n問事者正在權衡的兩個具體選項:\n  選項 A:${optA}\n  選項 B:${optB}\n(請在解盤中以這兩個名稱稱呼,並比較兩條路的能量。)`
          : `\n\nThe querent is weighing these two concrete options:\n  Option A: ${optA}\n  Option B: ${optB}\n(Refer to them by name in the reading and compare the two paths.)`)
      : "";

    const userMessage = isZh
      ? `${contextBlock}${newQuestionLine}${optionsBlock}\n\n本次牌陣:${spreadNameZh}(共 ${spread.cardCount} 張)\n\n${cardDescriptions}\n\n${isFollowUp ? `請承接前面的脈絡,針對我這次的新問題與這個牌陣,給出連貫的延伸解說,${wordTargetZh}。` : `請把整個牌陣串成一個連貫的故事,回應我的具體問題,並給出實際可行的建議,${wordTargetZh}。`}`
      : `${contextBlock}${newQuestionLine}${optionsBlock}\n\nSpread: ${spreadNameEn} (${spread.cardCount} cards)\n\n${cardDescriptions}\n\n${isFollowUp ? `Continue from the prior context; weave a coherent follow-up reading from this new spread for my new question. ${wordTargetEn}.` : `Weave the whole spread into a coherent narrative addressing my specific question, with practical advice. ${wordTargetEn}.`}`;

    const maxTokens = wordTarget.maxTokens;

    // DeepSeek API is OpenAI-compatible
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: withSafetyPreamble(systemPrompt, locale),
          },
          { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API error (tarot):", response.status, err);
      if (user) {
        await refundCredits({
          userId: user.id,
          amount: cost,
          errorMessage: `tarot deepseek ${response.status}: ${err.slice(0, 200)}`,
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse SSE stream from DeepSeek and forward as plain text(跟 /api/divine 同一套邏輯)
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
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // skip malformed JSON chunks
              }
            }
          }
        } catch (e) {
          console.error("Tarot stream error:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Collection-NewCount": String(collectionNewCount),
        "X-Collection-DupCount": String(collectionDupCount),
        "X-Collection-Count": String(collectionFinalCount),
        "X-Collection-Rewards": String(collectionRewards),
        // 抽到的 unique cardIds(逗號分隔,給 client toast 顯示卡名)
        "X-Collection-CardIds": collectionCardIds.join(","),
      },
    });
  } catch (error) {
    console.error("Tarot API error:", error);
    return new Response(JSON.stringify({ error: "Failed to get tarot reading" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
