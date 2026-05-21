#!/usr/bin/env node
/**
 * scripts/backfill-storage-webp.mjs
 *
 * 把 Supabase Storage 'app-images' bucket 既有的 PNG / JPEG / 大 WebP
 * 重新壓成 WebP(quality 80,最大邊 1600 px),並回寫所有 DB 表 / JSON map
 * 中對應的 URL 引用。
 *
 * 為什麼要做:
 *   commit 1 已經讓「未來」上傳的圖會自動瘦身,但既有的圖(personas / blog hero
 *   / 首頁 CTA / 64 卦插圖等)還是原檔大小。這個 script 一次性把它們也補上。
 *
 * 影響的 DB:
 *   - app_content.value (key='ui_images')      — JSON map { slot: url }
 *   - app_content.value (key='iching_images')  — JSON map { "1".."64": url }
 *   - personas.image_url
 *   - blog_posts.hero_image_url
 *
 * 行為:
 *   - 預設是 DRY-RUN(只印變動,不寫)。確認沒問題加 --apply。
 *   - --apply 會:① 下載原檔 ② sharp → WebP ③ 上傳新 .webp 檔
 *                ④ 更新所有 DB 表的 url ⑤ 刪原檔(若 --keep-original 則保留)
 *   - SVG / GIF 跳過(不轉)。已經是 .webp 也跳過。
 *
 * 使用:
 *   node scripts/backfill-storage-webp.mjs              # dry-run
 *   node scripts/backfill-storage-webp.mjs --apply      # 真寫
 *   node scripts/backfill-storage-webp.mjs --apply --keep-original
 *
 * 需要環境變數(從 .env.local 自動讀):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { setDefaultResultOrder } from "node:dns";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

setDefaultResultOrder("ipv4first");

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ 缺 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const KEEP_ORIGINAL = process.argv.includes("--keep-original");
const BUCKET = "app-images";
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 80;

console.log(
  `▶ mode = ${APPLY ? (KEEP_ORIGINAL ? "APPLY (keep originals)" : "APPLY") : "DRY-RUN"}`,
);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

/** 走訪 bucket 所有檔(遞迴展開資料夾)。 */
async function listAllFiles(prefix = "") {
  const out = [];
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000, offset: 0 });
  if (error) throw error;
  for (const item of data ?? []) {
    if (!item.name) continue;
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null && !item.metadata) {
      // 資料夾(沒 metadata 的 entry)
      const sub = await listAllFiles(full);
      out.push(...sub);
    } else {
      out.push({ path: full, size: item.metadata?.size ?? 0 });
    }
  }
  return out;
}

function shouldConvert(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".svg") || lower.endsWith(".gif")) return false;
  if (lower.endsWith(".webp")) return false;
  return /\.(png|jpe?g)$/i.test(lower);
}

function publicUrlFor(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function newPathFor(oldPath) {
  return oldPath.replace(/\.(png|jpe?g)$/i, ".webp");
}

function fmtBytes(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  if (n > 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

/** 下載 + sharp 轉 WebP。回傳新 buffer。 */
async function transcodeFromStorage(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`download failed: ${error.message}`);
  const arrayBuf = await data.arrayBuffer();
  const inputBuf = Buffer.from(arrayBuf);
  const outBuf = await sharp(inputBuf, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return { inputSize: inputBuf.length, outBuf };
}

/** 上傳 WebP 到新 path。 */
async function uploadWebp(newPath, buf) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, buf, {
      contentType: "image/webp",
      upsert: true,
    });
  if (error) throw new Error(`upload failed: ${error.message}`);
}

/** 刪原檔。 */
async function removeOriginal(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`remove failed: ${error.message}`);
}

/** 把 obj 內所有 string value 套用 urlMap 替換,深度遞迴。 */
function rewriteUrls(obj, urlMap) {
  if (typeof obj === "string") {
    return urlMap.get(obj) ?? obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => rewriteUrls(v, urlMap));
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = rewriteUrls(v, urlMap);
    }
    return out;
  }
  return obj;
}

async function rewriteAppContent(key, urlMap) {
  const { data, error } = await supabase
    .from("app_content")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  if (!data?.value) {
    console.log(`  app_content[${key}] 不存在,跳過`);
    return 0;
  }
  const original = data.value;
  const updated = rewriteUrls(original, urlMap);
  if (JSON.stringify(original) === JSON.stringify(updated)) {
    console.log(`  app_content[${key}] 沒有 URL 命中,跳過`);
    return 0;
  }
  const changedKeys = Object.keys(updated).filter(
    (k) => updated[k] !== original[k],
  );
  console.log(`  app_content[${key}] 將更新 ${changedKeys.length} 個 entry`);
  if (!APPLY) return changedKeys.length;
  const { error: upErr } = await supabase
    .from("app_content")
    .update({ value: updated })
    .eq("key", key);
  if (upErr) throw upErr;
  return changedKeys.length;
}

async function rewriteTableColumn(table, column, urlMap) {
  const { data, error } = await supabase.from(table).select(`id, ${column}`);
  if (error) throw error;
  let count = 0;
  for (const row of data ?? []) {
    const oldUrl = row[column];
    if (typeof oldUrl !== "string") continue;
    const newUrl = urlMap.get(oldUrl);
    if (!newUrl || newUrl === oldUrl) continue;
    count++;
    if (!APPLY) continue;
    const { error: upErr } = await supabase
      .from(table)
      .update({ [column]: newUrl })
      .eq("id", row.id);
    if (upErr) throw upErr;
  }
  console.log(`  ${table}.${column} 將更新 ${count} 筆`);
  return count;
}

async function main() {
  console.log("\n→ 列出 bucket 內所有檔");
  const files = await listAllFiles();
  console.log(`  共 ${files.length} 個檔`);

  const candidates = files.filter((f) => shouldConvert(f.path));
  console.log(`  其中 ${candidates.length} 個需要轉 WebP`);

  if (candidates.length === 0) {
    console.log("沒東西要做,結束。");
    return;
  }

  // url 對照表(舊 → 新)
  const urlMap = new Map();
  let totalIn = 0;
  let totalOut = 0;
  let okCount = 0;
  let failCount = 0;

  console.log("\n→ 逐檔 transcode");
  for (const f of candidates) {
    const oldPath = f.path;
    const newPath = newPathFor(oldPath);
    const oldUrl = publicUrlFor(oldPath);
    const newUrl = publicUrlFor(newPath);
    try {
      const { inputSize, outBuf } = await transcodeFromStorage(oldPath);
      totalIn += inputSize;
      totalOut += outBuf.length;
      const ratio = ((1 - outBuf.length / inputSize) * 100).toFixed(0);
      console.log(
        `  ${oldPath} → ${newPath}  ${fmtBytes(inputSize)} → ${fmtBytes(outBuf.length)}  (-${ratio}%)`,
      );
      if (APPLY) {
        await uploadWebp(newPath, outBuf);
      }
      urlMap.set(oldUrl, newUrl);
      okCount++;
    } catch (e) {
      console.error(`  ✗ ${oldPath}:${e.message}`);
      failCount++;
    }
  }

  console.log(`\n  成功 ${okCount} / 失敗 ${failCount}`);
  if (urlMap.size === 0) {
    console.log("沒成功轉換,跳過 DB 更新");
    return;
  }

  console.log("\n→ 更新 DB 引用");
  await rewriteAppContent("ui_images", urlMap);
  await rewriteAppContent("iching_images", urlMap);
  await rewriteTableColumn("personas", "image_url", urlMap);
  await rewriteTableColumn("blog_posts", "hero_image_url", urlMap);

  if (APPLY && !KEEP_ORIGINAL) {
    console.log("\n→ 刪除已轉換的原檔");
    let removed = 0;
    for (const [oldUrl, newUrl] of urlMap.entries()) {
      if (oldUrl === newUrl) continue;
      // 從 oldUrl 反推 path
      const idx = oldUrl.indexOf(`/${BUCKET}/`);
      if (idx < 0) continue;
      const oldPath = oldUrl.slice(idx + `/${BUCKET}/`.length);
      try {
        await removeOriginal(oldPath);
        removed++;
      } catch (e) {
        console.error(`  ✗ remove ${oldPath}: ${e.message}`);
      }
    }
    console.log(`  共刪除 ${removed} 個原檔`);
  } else if (APPLY) {
    console.log("\n  (--keep-original 指定,保留原檔)");
  }

  console.log("\n=== 總計 ===");
  console.log(`處理: ${okCount} 個檔`);
  console.log(`原始: ${fmtBytes(totalIn)}`);
  console.log(`輸出: ${fmtBytes(totalOut)}`);
  if (totalIn > 0) {
    const saved = ((1 - totalOut / totalIn) * 100).toFixed(1);
    console.log(`節省: ${fmtBytes(totalIn - totalOut)}  (-${saved}%)`);
  }
  if (!APPLY) {
    console.log(
      "\n(以上為 dry-run,沒寫任何資料。確認後加 --apply 真正執行。)",
    );
  }
}

main().catch((e) => {
  console.error("\n✗ FATAL:", e);
  process.exit(1);
});
