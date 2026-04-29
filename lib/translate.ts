/**
 * lib/translate.ts — 用 DeepSeek 把繁體中文部落格文章翻成 en / ja / ko。
 *
 * 設計:
 *   - 一次 API call 翻整篇(title + excerpt + body 段落陣列),要求模型回 JSON,
 *     比逐欄分批呼叫便宜 + 上下文一致。
 *   - 保留 markdown 慣例:"## " 開頭 = h2、"**xxx**" = inline bold,翻譯後維持。
 *   - 失敗就 throw — 呼叫端決定要 abort save 還是降級存原文。
 */

export type TargetLang = "en" | "ja" | "ko";

const LANG_NAMES: Record<TargetLang, string> = {
  en: "English",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
};

export interface PostContent {
  title: string;
  excerpt: string;
  body: string[];
}

/**
 * 把整篇文章翻成目標語言,回傳同 shape 的 PostContent。
 * 失敗 throw,呼叫端要 try/catch。
 */
export async function translatePost(
  zh: PostContent,
  target: TargetLang
): Promise<PostContent> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  // 用 numbered 段落讓模型不會搞混順序
  const numberedBody = zh.body
    .map((p, i) => `[${i}]\n${p}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a professional translator. Translate Traditional Chinese text into ${LANG_NAMES[target]}.

CRITICAL RULES:
1. Preserve markdown syntax exactly:
   - Lines starting with "## " stay as "## " followed by translated heading
   - Inline **bold** stays as **translated text**
2. Keep the same number of body paragraphs in the same order.
3. Translate proper nouns naturally (Tarogram stays as "Tarogram"; "易經" → "I Ching"; "塔羅" → "tarot"; deity / hexagram / card names use their conventional transliteration).
4. Tone: warm, conversational, slightly informal — same voice as the original. Not overly literal.
5. Output STRICT JSON only. No prose before or after. No code fences.

Output schema:
{
  "title": "translated title",
  "excerpt": "translated excerpt",
  "body": ["translated paragraph 0", "translated paragraph 1", ...]
}`;

  const userMessage = `Translate this blog post.

TITLE:
${zh.title}

EXCERPT:
${zh.excerpt}

BODY (${zh.body.length} paragraphs, separated by --- below; preserve numbering and order in output):

${numberedBody}`;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      // JSON mode — DeepSeek 支援 OpenAI 同款 response_format
      response_format: { type: "json_object" },
      // 翻譯類任務溫度低,確保穩定
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`DeepSeek translate ${target} ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`DeepSeek empty content for ${target}`);
  }

  // JSON 解析 — 模型偶爾會包 ```json ... ```,先 strip 一下保險
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  let parsed: { title?: unknown; excerpt?: unknown; body?: unknown };
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `DeepSeek invalid JSON for ${target}: ${(e as Error).message} | content[0..200]: ${content.slice(0, 200)}`
    );
  }

  if (typeof parsed.title !== "string" || !parsed.title) {
    throw new Error(`DeepSeek missing title for ${target}`);
  }
  if (typeof parsed.excerpt !== "string" || !parsed.excerpt) {
    throw new Error(`DeepSeek missing excerpt for ${target}`);
  }
  if (!Array.isArray(parsed.body) || parsed.body.length !== zh.body.length) {
    throw new Error(
      `DeepSeek body length mismatch for ${target}: expected ${zh.body.length}, got ${
        Array.isArray(parsed.body) ? parsed.body.length : "non-array"
      }`
    );
  }
  for (const p of parsed.body) {
    if (typeof p !== "string") {
      throw new Error(`DeepSeek body contains non-string for ${target}`);
    }
  }

  return {
    title: parsed.title.trim(),
    excerpt: parsed.excerpt.trim(),
    body: (parsed.body as string[]).map((p) => p.trim()),
  };
}

/**
 * 三語平行翻譯。任一語系失敗,該語系欄位回 null,其他兩個語系仍會回成功的版本。
 * 整體永不 throw — 上游負責決定如何處理 null(通常存進 DB 對應 nullable 欄位)。
 */
export async function translatePostToAllLangs(zh: PostContent): Promise<{
  en: PostContent | null;
  ja: PostContent | null;
  ko: PostContent | null;
  errors: { lang: TargetLang; message: string }[];
}> {
  const targets: TargetLang[] = ["en", "ja", "ko"];
  const errors: { lang: TargetLang; message: string }[] = [];

  const settled = await Promise.allSettled(
    targets.map((lang) => translatePost(zh, lang))
  );

  const result: {
    en: PostContent | null;
    ja: PostContent | null;
    ko: PostContent | null;
  } = { en: null, ja: null, ko: null };

  settled.forEach((res, idx) => {
    const lang = targets[idx];
    if (res.status === "fulfilled") {
      result[lang] = res.value;
    } else {
      errors.push({
        lang,
        message: res.reason instanceof Error ? res.reason.message : String(res.reason),
      });
      console.error(`[translate] ${lang} failed:`, res.reason);
    }
  });

  return { ...result, errors };
}
