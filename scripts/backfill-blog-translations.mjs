#!/usr/bin/env node
/**
 * scripts/backfill-blog-translations.mjs
 *
 * 給既有 18 篇 blog_posts 補日韓翻譯(也可選擇覆寫 en)。
 *
 * 使用:
 *   node scripts/backfill-blog-translations.mjs [--missing-only|--all]
 *     --missing-only (預設):只翻 ja/ko 為 NULL 的欄位,不動已存在的翻譯
 *     --all                 :從 zh 重新翻譯所有 en/ja/ko,覆寫既有
 *
 * 需要環境變數:
 *   DATABASE_URL              — Supabase Postgres 直連
 *   DEEPSEEK_API_KEY          — 翻譯 API key
 *   NEXT_PUBLIC_SUPABASE_URL  — REST endpoint
 *   SUPABASE_SERVICE_ROLE_KEY — 寫入用
 *
 * 設計:
 *   - 用 Supabase REST (service_role key) 而不是 pg 直連,避開 DATABASE_URL
 *     password 過期的麻煩。
 *   - 三語平行翻譯,但每篇之間 sequential — 避免短時間打太多 deepseek call。
 *   - 每篇 print 進度 (✓ / ✗),最後印總結。
 */

import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ 缺 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!DEEPSEEK_KEY) {
  console.error("✗ 缺 DEEPSEEK_API_KEY");
  process.exit(1);
}

const mode = process.argv.includes("--all") ? "all" : "missing-only";
console.log(`▶ Mode: ${mode}`);

const LANG_NAMES = {
  en: "English",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
};

async function translatePost(zh, target) {
  const numberedBody = zh.body.map((p, i) => `[${i}]\n${p}`).join("\n\n---\n\n");
  const systemPrompt = `You are a professional translator. Translate Traditional Chinese text into ${LANG_NAMES[target]}.

CRITICAL RULES:
1. Preserve markdown syntax exactly:
   - Lines starting with "## " stay as "## " followed by translated heading
   - Inline **bold** stays as **translated text**
2. Keep the same number of body paragraphs in the same order.
3. Translate proper nouns naturally (Tarogram stays as "Tarogram"; "易經" → "I Ching"; "塔羅" → "tarot").
4. Tone: warm, conversational, slightly informal — same voice as the original.
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
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`deepseek ${target} ${response.status}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`empty content for ${target}`);

  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.title !== "string" || !parsed.title) throw new Error("missing title");
  if (typeof parsed.excerpt !== "string" || !parsed.excerpt) throw new Error("missing excerpt");
  if (!Array.isArray(parsed.body) || parsed.body.length !== zh.body.length) {
    throw new Error(`body length mismatch: expected ${zh.body.length}, got ${parsed.body?.length}`);
  }
  return { title: parsed.title.trim(), excerpt: parsed.excerpt.trim(), body: parsed.body.map((p) => p.trim()) };
}

async function fetchAllPosts() {
  const url = `${SUPABASE_URL}/rest/v1/blog_posts?select=*&order=published_at.desc`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`fetch posts ${res.status}: ${await res.text()}`);
  return res.json();
}

async function updatePost(id, patch) {
  const url = `${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`patch ${res.status}: ${await res.text()}`);
}

function langsToProcess(post) {
  const langs = [];
  if (mode === "all") return ["en", "ja", "ko"];
  // missing-only: 哪些 NULL 就翻哪些
  if (post.title_en == null || post.body_en == null) langs.push("en");
  if (post.title_ja == null || post.body_ja == null) langs.push("ja");
  if (post.title_ko == null || post.body_ko == null) langs.push("ko");
  return langs;
}

async function main() {
  console.log("▶ Fetching blog posts…");
  const posts = await fetchAllPosts();
  console.log(`  Found ${posts.length} posts`);

  let totalTranslated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const post of posts) {
    const langs = langsToProcess(post);
    if (langs.length === 0) {
      console.log(`  ⊘ ${post.slug} — already complete, skip`);
      totalSkipped++;
      continue;
    }

    console.log(`▶ ${post.slug} — translating to ${langs.join(", ")}`);
    const zh = {
      title: post.title_zh,
      excerpt: post.excerpt_zh,
      body: post.body_zh ?? [],
    };

    const patch = {};
    for (const lang of langs) {
      try {
        const t = await translatePost(zh, lang);
        patch[`title_${lang}`] = t.title;
        patch[`excerpt_${lang}`] = t.excerpt;
        patch[`body_${lang}`] = t.body;
        console.log(`  ✓ ${lang}`);
        totalTranslated++;
      } catch (e) {
        console.error(`  ✗ ${lang}: ${e.message}`);
        totalFailed++;
      }
    }

    if (Object.keys(patch).length > 0) {
      try {
        await updatePost(post.id, patch);
        console.log(`  ✓ saved`);
      } catch (e) {
        console.error(`  ✗ save: ${e.message}`);
        totalFailed++;
      }
    }
  }

  console.log("\n──────────────────────────────");
  console.log(`Done. translated=${totalTranslated} skipped=${totalSkipped} failed=${totalFailed}`);
}

main().catch((e) => {
  console.error("✗ Fatal:", e);
  process.exit(1);
});
