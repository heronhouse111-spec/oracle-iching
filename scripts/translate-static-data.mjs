#!/usr/bin/env node
/**
 * scripts/translate-static-data.mjs
 *
 * 把 data/{spreads,tarot,hexagrams}.ts 裡的繁中字串透過 DeepSeek 翻成 ja/ko,
 * 寫進 data/translations/{spreads,tarot,hexagrams,trigrams}.{ja,ko}.json。
 *
 * data/*.ts 在 module init 時會 import 這些 JSON 並合併進對應結構,
 * view 端的 t(zh, en, ja, ko) 自然就拿到日韓翻譯。
 *
 * 使用:
 *   node scripts/translate-static-data.mjs              # 只翻缺的(預設)
 *   node scripts/translate-static-data.mjs --all        # 強制重翻全部
 *   node scripts/translate-static-data.mjs --only spreads        # 只跑 spreads
 *   node scripts/translate-static-data.mjs --only tarot,hexagrams
 *
 * 設計:
 *   - 每個 entity (spreads / tarot / hexagrams / trigrams) 各自一個 batch
 *     prompt 給 DeepSeek,要求回 strict JSON,降低 round-trip 數量。
 *   - tarot/hexagrams 因為太多,以 BATCH_SIZE 分批(預設 12)。
 *   - 每批內容都帶 zh + en 給模型參考(專有名詞品質會比較穩),要求輸出對應 lang。
 *   - missing-only 模式:JSON 已存在 entry 的就跳過,允許多次跑補翻。
 *   - 翻譯失敗該批就 fallback 到「en 不變」,不阻擋其他批。
 *
 * 需要環境變數:
 *   DEEPSEEK_API_KEY  (從 .env.local 自動讀)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { setDefaultResultOrder } from "node:dns";

setDefaultResultOrder("ipv4first");

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// ──────────────────────────────────────────
// .env.local loader (避免依賴 dotenv)
// ──────────────────────────────────────────
function loadEnvLocal() {
  const envFile = resolve(repoRoot, ".env.local");
  if (!existsSync(envFile)) return;
  const raw = readFileSync(envFile, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
if (!DEEPSEEK_KEY) {
  console.error("✗ 缺 DEEPSEEK_API_KEY (放在 .env.local 即可)");
  process.exit(1);
}

// ──────────────────────────────────────────
// CLI args
// ──────────────────────────────────────────
const argv = process.argv.slice(2);
const FORCE_ALL = argv.includes("--all");
const onlyArg = argv.indexOf("--only");
const ONLY = onlyArg >= 0 && argv[onlyArg + 1]
  ? argv[onlyArg + 1].split(",").map((s) => s.trim()).filter(Boolean)
  : null;

const BATCH_SIZE = 12;
const TARGETS = ["ja", "ko"];

// ──────────────────────────────────────────
// 載入 source data — 用 dynamic import 讀 .ts 是不行的,
// 所以這裡簡單做:讀檔 + 自己解析(只抓我們需要的欄位)。
// ──────────────────────────────────────────

/** 用 eval-like 方式從 .ts 讀資料太脆,改用 tsx 編譯 + dynamic import */
async function loadSourceData() {
  // 取巧:用 node --experimental-strip-types 不行,因 import 鏈包含 next/cache 等。
  // 改寫:把要的常數用 regex 抓,或者另行寫一份純資料模組。
  // 但 spreads/tarot/hexagrams 有 helper 函式 + buildMinor 動態組牌,純資料模組會走音。
  // ───→ 折衷:直接用 tsc transient,把純 const data 暴露成 .mjs。已寫成 scripts/_extract-static-data.mjs。
  throw new Error("loadSourceData not implemented — see _extract-static-data.mjs");
}

// 簡單方案:直接從 .ts 用 regex 抓需要的字段
function extractSpreadsFromSource() {
  const src = readFileSync(resolve(repoRoot, "data/spreads.ts"), "utf8");
  const spreads = [];

  // 抓每一個 spread const block — 從 "const XXX: Spread = {" 到下一個 "};"
  const reBlock = /const\s+\w+\s*:\s*Spread\s*=\s*\{([\s\S]*?)\n\};/g;
  let m;
  while ((m = reBlock.exec(src))) {
    const body = m[1];
    const id = grabString(body, /\bid:\s*"([^"]+)"/);
    if (!id) continue;
    const nameZh = grabString(body, /\bnameZh:\s*"([^"]+)"/);
    const nameEn = grabString(body, /\bnameEn:\s*"([^"]+)"/);
    const taglineZh = grabString(body, /\btaglineZh:\s*"([^"]+)"/);
    const taglineEn = grabString(body, /\btaglineEn:\s*"([^"]+)"/);
    const whenZh = grabString(body, /\bwhenZh:\s*\n?\s*"([^"]+)"/);
    const whenEn = grabString(body, /\bwhenEn:\s*\n?\s*"([^"]+)"/);

    // positions array
    const positions = [];
    const posBlockMatch = body.match(/positions:\s*\[([\s\S]*?)\]\s*,?\s*\}?\s*$/);
    if (posBlockMatch) {
      const rePos = /\{[\s\S]*?key:\s*"([^"]+)"[\s\S]*?labelZh:\s*"([^"]+)"[\s\S]*?labelEn:\s*"([^"]+)"[\s\S]*?descZh:\s*"([^"]+)"[\s\S]*?descEn:\s*"([^"]+)"[\s\S]*?\}/g;
      let pm;
      while ((pm = rePos.exec(posBlockMatch[1]))) {
        positions.push({
          key: pm[1],
          labelZh: pm[2],
          labelEn: pm[3],
          descZh: pm[4],
          descEn: pm[5],
        });
      }
    }

    spreads.push({ id, nameZh, nameEn, taglineZh, taglineEn, whenZh, whenEn, positions });
  }
  return spreads;
}

function extractTarotFromSource() {
  const src = readFileSync(resolve(repoRoot, "data/tarot.ts"), "utf8");
  // 抓 MAJOR — 從 const MAJOR: TarotCard[] = [ 到下一個 "];"
  const cards = [];

  // Major Arcana
  const majorMatch = src.match(/const\s+MAJOR\s*:\s*TarotCard\[\]\s*=\s*\[([\s\S]*?)\n\];/);
  if (majorMatch) {
    const reCard = /\{[\s\S]*?id:\s*"([^"]+)"[\s\S]*?nameZh:\s*"([^"]+)"[\s\S]*?nameEn:\s*"([^"]+)"[\s\S]*?uprightMeaningZh:\s*"([^"]+)"[\s\S]*?uprightMeaningEn:\s*"([^"]+)"[\s\S]*?reversedMeaningZh:\s*"([^"]+)"[\s\S]*?reversedMeaningEn:\s*"([^"]+)"[\s\S]*?keywordsUprightZh:\s*\[([^\]]+)\][\s\S]*?keywordsUprightEn:\s*\[([^\]]+)\][\s\S]*?keywordsReversedZh:\s*\[([^\]]+)\][\s\S]*?keywordsReversedEn:\s*\[([^\]]+)\][\s\S]*?\}/g;
    let cm;
    while ((cm = reCard.exec(majorMatch[1]))) {
      cards.push({
        id: cm[1],
        nameZh: cm[2],
        nameEn: cm[3],
        uprightMeaningZh: cm[4],
        uprightMeaningEn: cm[5],
        reversedMeaningZh: cm[6],
        reversedMeaningEn: cm[7],
        keywordsUprightZh: parseStringArray(cm[8]),
        keywordsUprightEn: parseStringArray(cm[9]),
        keywordsReversedZh: parseStringArray(cm[10]),
        keywordsReversedEn: parseStringArray(cm[11]),
      });
    }
  }

  // Minor Arcana — WANDS / CUPS / SWORDS / PENTACLES 共用 MinorData[] 結構
  // 對應 buildMinor 產出的 id = `${suit}-${num.padStart(2,'0')}`,name 從 SUIT_NAMES_*
  const SUIT_NAMES_ZH = { wands: "權杖", cups: "聖杯", swords: "寶劍", pentacles: "錢幣" };
  const SUIT_NAMES_EN = { wands: "Wands", cups: "Cups", swords: "Swords", pentacles: "Pentacles" };
  const COURT_ZH = ["侍者", "騎士", "王后", "國王"];
  const COURT_EN = ["Page", "Knight", "Queen", "King"];

  const suitDataNames = ["WANDS", "CUPS", "SWORDS", "PENTACLES"];
  const suitKeys = ["wands", "cups", "swords", "pentacles"];
  for (let si = 0; si < suitDataNames.length; si++) {
    const suitData = suitDataNames[si];
    const suitKey = suitKeys[si];
    const reArr = new RegExp(`const\\s+${suitData}\\s*:\\s*MinorData\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\n\\];`);
    const arrMatch = src.match(reArr);
    if (!arrMatch) continue;

    const reEntry = /\{\s*uprightZh:\s*"([^"]+)"[\s\S]*?uprightEn:\s*"([^"]+)"[\s\S]*?reversedZh:\s*"([^"]+)"[\s\S]*?reversedEn:\s*"([^"]+)"[\s\S]*?keywordsUprightZh:\s*\[([^\]]+)\][\s\S]*?keywordsUprightEn:\s*\[([^\]]+)\][\s\S]*?keywordsReversedZh:\s*\[([^\]]+)\][\s\S]*?keywordsReversedEn:\s*\[([^\]]+)\]\s*\}/g;
    const entries = [];
    let em;
    while ((em = reEntry.exec(arrMatch[1]))) {
      entries.push({
        uprightZh: em[1],
        uprightEn: em[2],
        reversedZh: em[3],
        reversedEn: em[4],
        keywordsUprightZh: parseStringArray(em[5]),
        keywordsUprightEn: parseStringArray(em[6]),
        keywordsReversedZh: parseStringArray(em[7]),
        keywordsReversedEn: parseStringArray(em[8]),
      });
    }

    for (let i = 0; i < entries.length; i++) {
      const num = i + 1;
      const e = entries[i];
      let nameZh, nameEn;
      if (num === 1) {
        nameZh = `${SUIT_NAMES_ZH[suitKey]}一`;
        nameEn = `Ace of ${SUIT_NAMES_EN[suitKey]}`;
      } else if (num <= 10) {
        nameZh = `${SUIT_NAMES_ZH[suitKey]}${num}`;
        nameEn = `${num} of ${SUIT_NAMES_EN[suitKey]}`;
      } else {
        const ci = num - 11;
        nameZh = `${SUIT_NAMES_ZH[suitKey]}${COURT_ZH[ci]}`;
        nameEn = `${COURT_EN[ci]} of ${SUIT_NAMES_EN[suitKey]}`;
      }
      cards.push({
        id: `${suitKey}-${String(num).padStart(2, "0")}`,
        nameZh,
        nameEn,
        uprightMeaningZh: e.uprightZh,
        uprightMeaningEn: e.uprightEn,
        reversedMeaningZh: e.reversedZh,
        reversedMeaningEn: e.reversedEn,
        keywordsUprightZh: e.keywordsUprightZh,
        keywordsUprightEn: e.keywordsUprightEn,
        keywordsReversedZh: e.keywordsReversedZh,
        keywordsReversedEn: e.keywordsReversedEn,
      });
    }
  }

  return cards;
}

function extractHexagramsFromSource() {
  const src = readFileSync(resolve(repoRoot, "data/hexagrams.ts"), "utf8");
  const hexagrams = [];
  // 每個 entry 在 hexagrams const array 裡面,結構是 { number: N, nameZh: "...", ... }
  const reHex = /\{\s*number:\s*(\d+)\s*,\s*nameZh:\s*"([^"]+)"\s*,\s*nameEn:\s*"([^"]+)"[\s\S]*?judgmentZh:\s*"([^"]+)",\s*judgmentEn:\s*"([^"]+)",[\s\S]*?imageZh:\s*"([^"]+)",\s*imageEn:\s*"([^"]+)",[\s\S]*?judgmentVernacularZh:\s*"([^"]+)",\s*imageVernacularZh:\s*"([^"]+)",?\s*\}/g;
  let m;
  while ((m = reHex.exec(src))) {
    hexagrams.push({
      number: parseInt(m[1], 10),
      nameZh: m[2],
      nameEn: m[3],
      judgmentZh: m[4],
      judgmentEn: m[5],
      imageZh: m[6],
      imageEn: m[7],
      judgmentVernacularZh: m[8],
      imageVernacularZh: m[9],
    });
  }
  return hexagrams;
}

function extractTrigramsFromSource() {
  const src = readFileSync(resolve(repoRoot, "data/hexagrams.ts"), "utf8");
  const reLine = /"(\d{3})":\s*\{\s*zh:\s*"([^"]+)",\s*en:\s*"([^"]+)",\s*symbol:\s*"([^"]+)"\s*\}/g;
  const out = [];
  let m;
  while ((m = reLine.exec(src))) {
    out.push({ code: m[1], zh: m[2], en: m[3], symbol: m[4] });
  }
  return out;
}

function grabString(src, regex) {
  const m = regex.exec(src);
  return m ? m[1] : "";
}
function parseStringArray(raw) {
  // raw 形如:"a", "b", "c"
  return Array.from(raw.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
}

// ──────────────────────────────────────────
// DeepSeek translate — 通用 batch helper
// ──────────────────────────────────────────

const LANG_NAMES = {
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
};

async function translateBatch({ systemPrompt, userMessage, expectShape }) {
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
      max_tokens: 8000,
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`deepseek ${response.status}: ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("deepseek empty content");
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("deepseek non-object response");
  }
  return parsed;
}

// ──────────────────────────────────────────
// JSON file IO
// ──────────────────────────────────────────
function loadJsonMap(file) {
  const p = resolve(repoRoot, file);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8") || "{}");
  } catch {
    return {};
  }
}
function saveJsonMap(file, map) {
  const p = resolve(repoRoot, file);
  // sort keys for deterministic diffs
  const sorted = {};
  for (const k of Object.keys(map).sort()) sorted[k] = map[k];
  writeFileSync(p, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

// ──────────────────────────────────────────
// 1. Spreads
// ──────────────────────────────────────────
async function translateSpreads() {
  const spreads = extractSpreadsFromSource();
  console.log(`▶ spreads: ${spreads.length} entries`);

  for (const lang of TARGETS) {
    const file = `data/translations/spreads.${lang}.json`;
    const map = loadJsonMap(file);
    const need = spreads.filter((s) => FORCE_ALL || !map[s.id]);
    if (need.length === 0) {
      console.log(`  ⊘ ${lang}: complete`);
      continue;
    }
    console.log(`  ▶ ${lang}: translating ${need.length} spreads`);

    const systemPrompt = `You are a professional translator. Translate Traditional Chinese tarot-spread descriptions into ${LANG_NAMES[lang]}.

CRITICAL RULES:
1. Keep proper nouns natural (Tarot, Celtic Cross, etc.). Tarot concepts already have established translations in ${LANG_NAMES[lang]} — use them.
2. Keep "name" short (under ~12 chars in JA, similar in KO). "tagline" is one short sentence. "when" is the longer paragraph.
3. Preserve tone: warm, conversational, helpful — same voice as the original.
4. Output STRICT JSON only, no prose, no code fences.

Output schema (returns ONLY entries you were asked to translate):
{
  "<spread.id>": {
    "name": "...",
    "tagline": "...",
    "when": "...",
    "positions": {
      "<position.key>": { "label": "...", "desc": "..." },
      ...
    }
  },
  ...
}`;

    const items = need.map((s) => ({
      id: s.id,
      zh: { name: s.nameZh, tagline: s.taglineZh, when: s.whenZh },
      en: { name: s.nameEn, tagline: s.taglineEn, when: s.whenEn },
      positions: s.positions.map((p) => ({
        key: p.key,
        zh: { label: p.labelZh, desc: p.descZh },
        en: { label: p.labelEn, desc: p.descEn },
      })),
    }));

    const userMessage = `Translate these tarot spreads from Traditional Chinese (zh) into ${LANG_NAMES[lang]}. The English (en) version is provided as reference for proper-noun conventions only.

INPUT:
${JSON.stringify(items, null, 2)}

Return STRICT JSON in the schema described.`;

    try {
      const parsed = await translateBatch({ systemPrompt, userMessage });
      let added = 0;
      for (const s of need) {
        const tr = parsed[s.id];
        if (!tr || typeof tr !== "object") continue;
        map[s.id] = {
          name: typeof tr.name === "string" ? tr.name : undefined,
          tagline: typeof tr.tagline === "string" ? tr.tagline : undefined,
          when: typeof tr.when === "string" ? tr.when : undefined,
          positions: {},
        };
        if (tr.positions && typeof tr.positions === "object") {
          for (const pkey of Object.keys(tr.positions)) {
            const pp = tr.positions[pkey];
            if (pp && typeof pp === "object") {
              map[s.id].positions[pkey] = {
                label: typeof pp.label === "string" ? pp.label : undefined,
                desc: typeof pp.desc === "string" ? pp.desc : undefined,
              };
            }
          }
        }
        added++;
      }
      saveJsonMap(file, map);
      console.log(`  ✓ ${lang}: +${added} translated`);
    } catch (e) {
      console.error(`  ✗ ${lang}: ${e.message}`);
    }
  }
}

// ──────────────────────────────────────────
// 2. Tarot
// ──────────────────────────────────────────
async function translateTarot() {
  const cards = extractTarotFromSource();
  console.log(`▶ tarot: ${cards.length} cards`);

  for (const lang of TARGETS) {
    const file = `data/translations/tarot.${lang}.json`;
    const map = loadJsonMap(file);
    const need = cards.filter((c) => FORCE_ALL || !map[c.id]);
    if (need.length === 0) {
      console.log(`  ⊘ ${lang}: complete`);
      continue;
    }
    console.log(`  ▶ ${lang}: translating ${need.length} cards (in batches of ${BATCH_SIZE})`);

    const systemPrompt = `You are a professional translator. Translate Traditional Chinese Rider-Waite tarot card meanings into ${LANG_NAMES[lang]}.

CRITICAL RULES:
1. Card names: use the established ${LANG_NAMES[lang]} convention (e.g. "The Fool" → "愚者" / "바보"; "The Magician" → "魔術師" / "마술사"). For minor arcana the source is a generated like "聖杯一" — use natural ${LANG_NAMES[lang]} equivalents like "カップのエース" / "컵 에이스".
2. uprightMeaning / reversedMeaning are ~1-2 sentences each. Preserve tone.
3. keywordsUpright / keywordsReversed are arrays of short keywords (1-3 words each). Translate each keyword.
4. The same number of keywords MUST come back in each array (preserve length).
5. Output STRICT JSON only.

Output schema:
{
  "<card.id>": {
    "name": "...",
    "uprightMeaning": "...",
    "reversedMeaning": "...",
    "keywordsUpright": ["...","..."],
    "keywordsReversed": ["...","..."]
  },
  ...
}`;

    let totalAdded = 0;
    for (let i = 0; i < need.length; i += BATCH_SIZE) {
      const batch = need.slice(i, i + BATCH_SIZE);
      const items = batch.map((c) => ({
        id: c.id,
        zh: {
          name: c.nameZh,
          uprightMeaning: c.uprightMeaningZh,
          reversedMeaning: c.reversedMeaningZh,
          keywordsUpright: c.keywordsUprightZh,
          keywordsReversed: c.keywordsReversedZh,
        },
        en: {
          name: c.nameEn,
          uprightMeaning: c.uprightMeaningEn,
          reversedMeaning: c.reversedMeaningEn,
          keywordsUpright: c.keywordsUprightEn,
          keywordsReversed: c.keywordsReversedEn,
        },
      }));
      const userMessage = `Translate these tarot cards from Traditional Chinese (zh) into ${LANG_NAMES[lang]}. English (en) is reference for proper-noun conventions only.

INPUT:
${JSON.stringify(items, null, 2)}

Return STRICT JSON keyed by card.id.`;
      try {
        const parsed = await translateBatch({ systemPrompt, userMessage });
        for (const c of batch) {
          const tr = parsed[c.id];
          if (!tr || typeof tr !== "object") continue;
          map[c.id] = {
            name: typeof tr.name === "string" ? tr.name : undefined,
            uprightMeaning: typeof tr.uprightMeaning === "string" ? tr.uprightMeaning : undefined,
            reversedMeaning: typeof tr.reversedMeaning === "string" ? tr.reversedMeaning : undefined,
            keywordsUpright: Array.isArray(tr.keywordsUpright) ? tr.keywordsUpright.map(String) : undefined,
            keywordsReversed: Array.isArray(tr.keywordsReversed) ? tr.keywordsReversed.map(String) : undefined,
          };
          totalAdded++;
        }
        // 中途存檔,即使後續批失敗也不會丟前面
        saveJsonMap(file, map);
        console.log(`    ✓ batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(need.length / BATCH_SIZE)} (${batch.length} cards)`);
      } catch (e) {
        console.error(`    ✗ batch ${Math.floor(i / BATCH_SIZE) + 1}: ${e.message}`);
      }
    }
    console.log(`  ✓ ${lang}: +${totalAdded} translated`);
  }
}

// ──────────────────────────────────────────
// 3. Hexagrams
// ──────────────────────────────────────────
async function translateHexagrams() {
  const hexagrams = extractHexagramsFromSource();
  console.log(`▶ hexagrams: ${hexagrams.length} entries`);

  for (const lang of TARGETS) {
    const file = `data/translations/hexagrams.${lang}.json`;
    const map = loadJsonMap(file);
    const need = hexagrams.filter((h) => FORCE_ALL || !map[String(h.number)]);
    if (need.length === 0) {
      console.log(`  ⊘ ${lang}: complete`);
      continue;
    }
    console.log(`  ▶ ${lang}: translating ${need.length} hexagrams (batches of ${BATCH_SIZE})`);

    const systemPrompt = `You are a professional translator specializing in I Ching (Book of Changes). Translate I Ching hexagram material into ${LANG_NAMES[lang]}.

CRITICAL RULES:
1. The "name" field is the hexagram name (e.g. 乾 / Qian / The Creative). In ${LANG_NAMES[lang]}, use the established traditional rendering (Japanese: typically the same Chinese character read in 音読 — e.g. "乾" stays "乾" or "けん"; for clarity translate to a short ${LANG_NAMES[lang]} phrase like "乾(けん) — 創造").
2. "judgmentModern" is the modern-prose translation of the classical 卦辭 (judgment text). The reference is the classical zh + the existing English vernacular. Output a 1-2 sentence ${LANG_NAMES[lang]} version that explains the meaning to a contemporary reader (NOT a literal translation of classical Chinese).
3. "imageModern" is the modern-prose translation of the classical 象辭 (image text), same treatment.
4. Tone: warm, accessible, slightly literary. Avoid overly academic phrasing.
5. Output STRICT JSON only.

Output schema:
{
  "<hexagram.number>": {
    "name": "...",
    "judgmentModern": "...",
    "imageModern": "..."
  },
  ...
}`;

    let totalAdded = 0;
    for (let i = 0; i < need.length; i += BATCH_SIZE) {
      const batch = need.slice(i, i + BATCH_SIZE);
      const items = batch.map((h) => ({
        number: h.number,
        zh: { name: h.nameZh, judgmentClassical: h.judgmentZh, judgmentVernacular: h.judgmentVernacularZh, imageClassical: h.imageZh, imageVernacular: h.imageVernacularZh },
        en: { name: h.nameEn, judgmentModern: h.judgmentEn, imageModern: h.imageEn },
      }));
      const userMessage = `Translate these I Ching hexagrams to ${LANG_NAMES[lang]}.

For each hexagram you have:
- zh.name = traditional Chinese name (single character usually)
- zh.judgmentClassical = classical text 卦辭 (don't translate this — it's the original; only included for reference)
- zh.judgmentVernacular = Chinese-language modern translation of the judgment
- zh.imageClassical = classical text 象辭 (also reference only)
- zh.imageVernacular = Chinese-language modern translation of the image
- en.name / en.judgmentModern / en.imageModern = published English version

Output: ${LANG_NAMES[lang]} "name" + ${LANG_NAMES[lang]} "judgmentModern" + ${LANG_NAMES[lang]} "imageModern".

INPUT:
${JSON.stringify(items, null, 2)}

Return STRICT JSON keyed by hexagram.number (as string).`;
      try {
        const parsed = await translateBatch({ systemPrompt, userMessage });
        for (const h of batch) {
          const key = String(h.number);
          const tr = parsed[key];
          if (!tr || typeof tr !== "object") continue;
          map[key] = {
            name: typeof tr.name === "string" ? tr.name : undefined,
            judgmentModern: typeof tr.judgmentModern === "string" ? tr.judgmentModern : undefined,
            imageModern: typeof tr.imageModern === "string" ? tr.imageModern : undefined,
          };
          totalAdded++;
        }
        saveJsonMap(file, map);
        console.log(`    ✓ batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(need.length / BATCH_SIZE)} (${batch.length} hex)`);
      } catch (e) {
        console.error(`    ✗ batch ${Math.floor(i / BATCH_SIZE) + 1}: ${e.message}`);
      }
    }
    console.log(`  ✓ ${lang}: +${totalAdded} translated`);
  }
}

// ──────────────────────────────────────────
// 4. Trigrams
// ──────────────────────────────────────────
async function translateTrigrams() {
  const trigrams = extractTrigramsFromSource();
  console.log(`▶ trigrams: ${trigrams.length} entries`);

  for (const lang of TARGETS) {
    const file = `data/translations/trigrams.${lang}.json`;
    const map = loadJsonMap(file);
    const need = trigrams.filter((t) => FORCE_ALL || !map[t.code]);
    if (need.length === 0) {
      console.log(`  ⊘ ${lang}: complete`);
      continue;
    }

    const systemPrompt = `You are a professional translator. Translate the 8 trigrams (八卦) from I Ching into ${LANG_NAMES[lang]}.

CRITICAL RULES:
1. Each trigram is a single concept (Heaven/Earth/Thunder/Water/Mountain/Wind/Fire/Lake) with a Chinese-character name.
2. In ${LANG_NAMES[lang]}, use the established convention. Format: "<character> (<element/keyword>)".
   - Japanese examples: "乾（天）" → "乾（天）" (kept), "離（火）" → "離（火）".
   - Korean examples: "乾（天）" → "건(하늘)", "離（火）" → "리(불)".
3. Output STRICT JSON only, mapping trigram code → translated string.

Output schema:
{
  "<code>": "translated name",
  ...
}`;

    const items = need.map((tg) => ({ code: tg.code, zh: tg.zh, en: tg.en, symbol: tg.symbol }));
    const userMessage = `Translate the trigram names to ${LANG_NAMES[lang]}.

INPUT:
${JSON.stringify(items, null, 2)}

Return STRICT JSON keyed by code (a 3-digit string like "111").`;

    try {
      const parsed = await translateBatch({ systemPrompt, userMessage });
      let added = 0;
      for (const tg of need) {
        const v = parsed[tg.code];
        if (typeof v === "string" && v) {
          map[tg.code] = v;
          added++;
        }
      }
      saveJsonMap(file, map);
      console.log(`  ✓ ${lang}: +${added}`);
    } catch (e) {
      console.error(`  ✗ ${lang}: ${e.message}`);
    }
  }
}

// ──────────────────────────────────────────
// Main
// ──────────────────────────────────────────
function shouldRun(name) {
  if (!ONLY) return true;
  return ONLY.includes(name);
}

async function main() {
  console.log(`▶ Mode: ${FORCE_ALL ? "force-all" : "missing-only"}${ONLY ? `, only=${ONLY.join(",")}` : ""}`);
  if (shouldRun("trigrams")) await translateTrigrams();
  if (shouldRun("spreads")) await translateSpreads();
  if (shouldRun("hexagrams")) await translateHexagrams();
  if (shouldRun("tarot")) await translateTarot();
  console.log("\n✓ Done.");
}

main().catch((e) => {
  console.error("✗ Fatal:", e);
  process.exit(1);
});
