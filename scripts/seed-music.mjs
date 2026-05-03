#!/usr/bin/env node
/**
 * scripts/seed-music.mjs
 *
 * Phase 27 —— 預生成 32 首平台音樂(Stable Audio API)
 *   - 30 首種子歌 (5 per category × 6 categories,各 60 秒,進排行榜佔位)
 *   - 2 首永久免費歌(180 秒,is_free=true,在 APP 內任何人 0 點播放)
 *
 * 預估成本:~$2.88 USD(32 × $0.09)
 *
 * 使用:
 *   node scripts/seed-music.mjs                       # DRY-RUN(預設)
 *   node scripts/seed-music.mjs --apply               # 真生成
 *   node scripts/seed-music.mjs --apply --free-only   # 只做免費 2 首
 *   node scripts/seed-music.mjs --apply --seed-only   # 只做種子 30 首
 *   node scripts/seed-music.mjs --apply --resume      # 續跑(跳過已存在 title)
 *
 * 需要 .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STABILITY_API_KEY
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { setDefaultResultOrder } from "node:dns";
import { createClient } from "@supabase/supabase-js";

setDefaultResultOrder("ipv4first");

// 本地音檔快取資料夾 — Stable Audio 回傳的 mp3 先存這裡,
// 萬一 Supabase 上傳失敗也不用再呼叫 API 重生(API 是會扣錢的)
const CACHE_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "tmp",
  "seed-music",
);
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

// ────────────────────────────────────────────
// env loading
// ────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  const envFile = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envFile)) return;
  const raw = readFileSync(envFile, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // 去掉成對的引號 / 角括號(2026-05-03:user 把 service_role key 包成 <...>)
    while (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith("<") && val.endsWith(">"))
    ) {
      val = val.slice(1, -1).trim();
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STABILITY_KEY = process.env.STABILITY_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ 缺 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!STABILITY_KEY) {
  console.error("✗ 缺 STABILITY_API_KEY");
  process.exit(1);
}

// ────────────────────────────────────────────
// CLI flags
// ────────────────────────────────────────────
const APPLY = process.argv.includes("--apply");
const FREE_ONLY = process.argv.includes("--free-only");
const SEED_ONLY = process.argv.includes("--seed-only");
const RESUME = process.argv.includes("--resume");

const BUCKET = "app-music";
const STABILITY_URL =
  "https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio";

// ────────────────────────────────────────────
// Track manifest
// ────────────────────────────────────────────
// 每個 category 5 首。Prompt 用英文(Stable Audio 對英文最敏感),
// title 用中文(直接顯示於排行榜)。
const SEED_TRACKS = [
  // ── meditation 冥想 ────────────────────────
  {
    category: "meditation",
    title: "靜謐冥想 01",
    prompt:
      "Slow ambient meditation with soft pads, deep low drone, distant chimes, 60bpm, peaceful and breath-aligning, no melody, instrumental",
  },
  {
    category: "meditation",
    title: "藏鈴頌 01",
    prompt:
      "Tibetan singing bowls, gentle wind, sustained pads, very slow, sacred meditation atmosphere, instrumental",
  },
  {
    category: "meditation",
    title: "晨光冥想 01",
    prompt:
      "Soft piano with deep reverb, slow contemplative ambient, no percussion, peaceful morning meditation",
  },
  {
    category: "meditation",
    title: "森林靜心 01",
    prompt:
      "Forest meditation ambient with leaves rustling softly, distant flute notes, low drone, calming and grounding",
  },
  {
    category: "meditation",
    title: "水晶頌缽 01",
    prompt:
      "Crystal singing bowls, ethereal sustained pads, tinkling bells, deep stillness, meditative drone",
  },

  // ── mystery 神秘 ─────────────────────────
  {
    category: "mystery",
    title: "神諭低語 01",
    prompt:
      "Mysterious oracle ambient, low cinematic drone, sparse bell strikes, suspenseful, instrumental",
  },
  {
    category: "mystery",
    title: "占卜時刻 01",
    prompt:
      "Dark mystical atmosphere with subtle string drones, sparse percussion, divination ritual feel, no vocals",
  },
  {
    category: "mystery",
    title: "古寺殿堂 01",
    prompt:
      "Ancient temple ambient, deep gong, cavernous reverb, mystical and sacred atmosphere",
  },
  {
    category: "mystery",
    title: "霧林夜行 01",
    prompt:
      "Foggy mystic forest at night, eerie sustained drones, whispering wind, soft distant chimes",
  },
  {
    category: "mystery",
    title: "玻璃水晶 01",
    prompt:
      "Ethereal mystery soundscape, glassy synth pads, distant ritual percussion, otherworldly",
  },

  // ── nature 自然 ──────────────────────────
  {
    category: "nature",
    title: "山林溪流 01",
    prompt:
      "Forest stream ambient, water flowing gently, distant birds, soft wind through leaves, peaceful nature",
  },
  {
    category: "nature",
    title: "綿綿細雨 01",
    prompt:
      "Light rain on leaves with soft distant thunder rumble, peaceful forest atmosphere, no music",
  },
  {
    category: "nature",
    title: "晨曦山霧 01",
    prompt:
      "Mountain morning ambient, distant bird calls, soft mountain wind, water trickling, fresh atmosphere",
  },
  {
    category: "nature",
    title: "海浪低吟 01",
    prompt:
      "Ocean waves gentle and continuous, distant seagulls, calming seaside nature ambient",
  },
  {
    category: "nature",
    title: "竹林風鈴 01",
    prompt:
      "Bamboo forest with wind chimes, leaves rustling, peaceful zen garden atmosphere, sparse",
  },

  // ── oriental 東方 ────────────────────────
  {
    category: "oriental",
    title: "古箏小品 01",
    prompt:
      "Traditional Chinese guzheng ambient, soft koto strings, bamboo flute drone, peaceful zen, instrumental",
  },
  {
    category: "oriental",
    title: "尺八禪音 01",
    prompt:
      "Japanese shakuhachi flute with subtle string drone, contemplative oriental ambient, slow",
  },
  {
    category: "oriental",
    title: "宮廷雅韻 01",
    prompt:
      "Ancient Chinese court music ambient, erhu drone, gentle pipa plucking, royal peaceful atmosphere",
  },
  {
    category: "oriental",
    title: "禪庭清音 01",
    prompt:
      "Zen garden ambient with shamisen, soft taiko drum heartbeat, oriental meditation",
  },
  {
    category: "oriental",
    title: "藏寺梵唱 01",
    prompt:
      "Tibetan Buddhist temple, deep chant drone, dungchen horn, spiritual oriental atmosphere, instrumental no lyrics",
  },

  // ── focus 專注 ────────────────────────────
  {
    category: "focus",
    title: "雨中讀書 01",
    prompt:
      "Lofi study beats with gentle rain, soft piano melody, mellow and unobtrusive concentration ambient",
  },
  {
    category: "focus",
    title: "極簡專注 01",
    prompt:
      "Minimalist ambient for focus, slow synthesizer pads, no percussion, deep concentration atmosphere",
  },
  {
    category: "focus",
    title: "咖啡廳爵士 01",
    prompt:
      "Coffee shop ambient with soft jazz piano in background, gentle and unobtrusive, mellow",
  },
  {
    category: "focus",
    title: "圖書館靜謐 01",
    prompt:
      "Library study ambient, very soft texture, peaceful and quiet, deep focus, almost silent",
  },
  {
    category: "focus",
    title: "深度工作 01",
    prompt:
      "Soft electronic beats for deep work, repetitive and hypnotic, productivity ambient, instrumental",
  },

  // ── dream 夢境 ────────────────────────────
  {
    category: "dream",
    title: "雲端漫遊 01",
    prompt:
      "Dreamy ambient soundscape with reverbed pads, distant ethereal tones, floating sensation, instrumental",
  },
  {
    category: "dream",
    title: "星空夜寐 01",
    prompt:
      "Cosmic dream ambient, slow synthesizer, twinkling celestial sounds, deep space sleep",
  },
  {
    category: "dream",
    title: "音樂盒搖籃 01",
    prompt:
      "Lullaby ambient with soft music box melody, twinkling chimes, peaceful sleep atmosphere",
  },
  {
    category: "dream",
    title: "夢境鋼琴 01",
    prompt:
      "Dreamlike piano with heavy reverb, slow and floating, surreal sleep ambient",
  },
  {
    category: "dream",
    title: "清明夢境 01",
    prompt:
      "Lucid dream ambient, evolving synth pads, distant chimes, cloud-floating feel",
  },
];

const FREE_TRACKS = [
  {
    category: "meditation",
    title: "靜心冥想(精選長曲)",
    prompt:
      "Extended deep meditation ambient with Tibetan singing bowls, sustained low drone, distant soft chimes, gentle wind, very peaceful and breath-aligning meditative journey, instrumental no melody",
    duration: 180,
  },
  {
    category: "oriental",
    title: "東方禪境(精選長曲)",
    prompt:
      "Extended zen garden ambient with bamboo flute, gentle koto plucking, water trickling, traditional Asian peaceful atmosphere, contemplative oriental meditation, instrumental",
    duration: 180,
  },
];

// ────────────────────────────────────────────
// Cost estimation
// ────────────────────────────────────────────
function estimateCost() {
  const seedCount = FREE_ONLY ? 0 : SEED_TRACKS.length;
  const freeCount = SEED_ONLY ? 0 : FREE_TRACKS.length;
  const total = seedCount + freeCount;
  const usd = total * 0.09;
  return { seedCount, freeCount, total, usd };
}

// ────────────────────────────────────────────
// Stable Audio call
// ────────────────────────────────────────────
async function generateAudio({ prompt, duration = 60 }) {
  const formData = new FormData();
  formData.set("prompt", prompt);
  formData.set("duration", String(duration));
  formData.set("output_format", "mp3");
  formData.set("model", "stable-audio-2");

  const res = await fetch(STABILITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STABILITY_KEY}`,
      Accept: "audio/*",
    },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "<no body>");
    throw new Error(`Stable Audio ${res.status}: ${errorText.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer;
}

// ────────────────────────────────────────────
// Supabase admin
// ────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function uploadToStorage(storagePath, buffer) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}

async function registerMusic({
  title,
  prompt,
  categoryId,
  storagePath,
  durationSeconds,
  isFree,
  isSeed,
}) {
  const { data, error } = await supabase.rpc("register_generated_music", {
    p_creator_id: null,
    p_title: title,
    p_prompt: prompt,
    p_prompt_locale: "en",
    p_category_id: categoryId,
    p_storage_path: storagePath,
    p_duration_seconds: durationSeconds,
    p_provider: "platform_seed",
    p_provider_track_id: null,
    p_is_seed: isSeed,
    p_is_free: isFree,
    p_publish_now: false,
  });
  if (error) throw new Error(`Register RPC failed: ${error.message}`);
  return data;
}

async function alreadyExists(title) {
  const { data } = await supabase
    .from("generated_music")
    .select("id, title, storage_path")
    .eq("title", title)
    .eq("provider", "platform_seed")
    .maybeSingle();
  return data;
}

function publicUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

// ────────────────────────────────────────────
// Main
// ────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cachePathFor(track) {
  const safeName = track.title.replace(/[^a-zA-Z0-9一-鿿]+/g, "_");
  const duration = track.duration ?? 60;
  return resolve(CACHE_DIR, `${track.category}-${safeName}-${duration}s.mp3`);
}

async function processTrack(track, kind, index, total) {
  const isFree = kind === "free";
  const duration = track.duration ?? 60;
  const tag = `[${index + 1}/${total}]`;
  console.log(
    `${tag} ${kind.toUpperCase().padEnd(4)} | ${track.category.padEnd(10)} | ${track.title}`,
  );
  console.log(`     prompt: ${track.prompt.slice(0, 90)}${track.prompt.length > 90 ? "…" : ""}`);

  // ── DB 已有就完全跳過(不重生、不重傳) ─────────────────
  if (RESUME) {
    const existing = await alreadyExists(track.title);
    if (existing) {
      console.log(`     → DB 已存在,跳過 (id: ${existing.id})`);
      return { skipped: true, ...track };
    }
  }

  if (!APPLY) {
    console.log(`     → DRY-RUN,不執行`);
    return { dryRun: true, ...track };
  }

  // ── 步驟 1:取得音檔(優先讀本地快取,沒才呼叫 API) ──
  let buffer;
  const cachePath = cachePathFor(track);
  if (existsSync(cachePath)) {
    buffer = readFileSync(cachePath);
    console.log(
      `     → 從本地快取讀取 ${(buffer.length / 1024).toFixed(1)} KB(省一次 API 呼叫)`,
    );
  } else {
    const t0 = Date.now();
    console.log(`     → 呼叫 Stable Audio (${duration}s)…`);
    buffer = await generateAudio({ prompt: track.prompt, duration });
    console.log(
      `     → 收到 ${(buffer.length / 1024).toFixed(1)} KB (${Date.now() - t0}ms)`,
    );
    // ✅ 立刻存本地 — 後續上傳 / DB 寫入若失敗,下次 --resume 不用重花錢
    writeFileSync(cachePath, buffer);
    console.log(`     → 已快取到 ${cachePath}`);
  }

  // ── 步驟 2:上傳 Supabase Storage ──────────────────────
  // Storage 不接受非 ASCII 檔名,用 sha1 短 hash 保留 title 唯一性
  const folder = isFree ? "free" : "seed";
  const titleHash = createHash("sha1").update(track.title).digest("hex").slice(0, 8);
  const storagePath = `${folder}/${track.category}-${titleHash}.mp3`;
  await uploadToStorage(storagePath, buffer);
  console.log(`     → 上傳 ${storagePath}`);

  // ── 步驟 3:寫 DB ──────────────────────────────────────
  const musicId = await registerMusic({
    title: track.title,
    prompt: track.prompt,
    categoryId: track.category,
    storagePath,
    durationSeconds: duration,
    isFree,
    isSeed: !isFree,
  });
  console.log(`     → DB id: ${musicId}`);
  console.log(`     → 試聽: ${publicUrl(storagePath)}`);

  return { id: musicId, storagePath, ...track, kind };
}

async function main() {
  const { seedCount, freeCount, total, usd } = estimateCost();
  console.log("════════════════════════════════════════");
  console.log(" Phase 27 — 種子歌預生成");
  console.log("════════════════════════════════════════");
  console.log(` 模式      : ${APPLY ? "APPLY" : "DRY-RUN(加 --apply 才會真做)"}`);
  console.log(` 種子歌    : ${seedCount} 首 × 60s`);
  console.log(` 免費歌    : ${freeCount} 首 × 180s`);
  console.log(` 合計      : ${total} 首`);
  console.log(` 預估成本  : ~$${usd.toFixed(2)} USD`);
  console.log(` 續跑模式  : ${RESUME ? "是(跳過已存在 title)" : "否"}`);
  console.log("════════════════════════════════════════\n");

  const results = [];
  let cursor = 0;

  if (!FREE_ONLY) {
    for (let i = 0; i < SEED_TRACKS.length; i++) {
      try {
        const r = await processTrack(SEED_TRACKS[i], "seed", cursor++, total);
        results.push(r);
      } catch (err) {
        console.error(`     ✗ 失敗:${err.message}`);
        results.push({ error: err.message, ...SEED_TRACKS[i], kind: "seed" });
      }
      if (APPLY && i < SEED_TRACKS.length - 1) await sleep(1500);
    }
  }

  if (!SEED_ONLY) {
    for (let i = 0; i < FREE_TRACKS.length; i++) {
      try {
        const r = await processTrack(FREE_TRACKS[i], "free", cursor++, total);
        results.push(r);
      } catch (err) {
        console.error(`     ✗ 失敗:${err.message}`);
        results.push({ error: err.message, ...FREE_TRACKS[i], kind: "free" });
      }
      if (APPLY && i < FREE_TRACKS.length - 1) await sleep(1500);
    }
  }

  console.log("\n════════════════════════════════════════");
  const ok = results.filter((r) => r.id).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => r.error).length;
  console.log(` 完成:${ok} 成功 / ${skipped} 跳過 / ${failed} 失敗`);
  console.log("════════════════════════════════════════\n");

  if (failed > 0) {
    console.log(" 失敗清單:");
    for (const r of results.filter((rr) => rr.error)) {
      console.log(`  ✗ ${r.kind} | ${r.title}`);
      console.log(`      ${r.error}`);
    }
    console.log("\n  → 修好後可加 --resume 續跑\n");
  }

  if (APPLY && ok > 0) {
    console.log(" 下一步:");
    console.log("   1. 到 Supabase Dashboard → Storage → app-music 試聽每首");
    console.log("   2. 不滿意的用 SQL 軟刪:");
    console.log("        update public.generated_music");
    console.log("           set visibility = 'removed_by_user'");
    console.log("         where title in ('xxx', 'yyy');");
    console.log("   3. 想替換的就 update SEED_TRACKS 對應 title 後再跑 --resume\n");
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
