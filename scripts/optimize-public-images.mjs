#!/usr/bin/env node
/**
 * scripts/optimize-public-images.mjs
 *
 * 一次性把 public/ 裡的塔羅 / 易經素材從 JPG 轉成 WebP,
 * 並刪掉不再被引用的大圖(例如 logo-1024.png)。
 *
 * 為什麼要做:
 *   public/tarot/*.jpg 70+ 張、加總 14 MB,user 翻牌、看牌詳情都會載到。
 *   轉 WebP quality 80 可以省掉 60-70% 的位元組,首頁 LCP 大幅改善。
 *
 * 不動的東西:
 *   - PWA icon(logo-XX.png / app-icon-XX.png):manifest.json 規定要 PNG/JPEG。
 *   - opengraph-image.tsx 用 readFileSync 讀 logo-512/128.png,也保留 PNG。
 *   - SVG:本來就小,不需要動。
 *
 * 跑法:
 *   node scripts/optimize-public-images.mjs
 *
 * 跑完會印出每張的壓縮率,和總體節省了多少 MB。
 * idempotent:已經有 .webp 就不重壓。
 */

import { readdir, stat, readFile, writeFile, unlink } from "node:fs/promises";
import { join, extname, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));
const PUBLIC = join(ROOT, "public");

const TARGETS = [
  { dir: join(PUBLIC, "tarot"), match: /\.jpe?g$/i, quality: 80 },
  { dir: join(PUBLIC, "iching", "8grams"), match: /\.jpe?g$/i, quality: 80 },
];

const ORPHAN_FILES = [join(PUBLIC, "logo-1024.png")];

async function listFiles(dir, match) {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => match.test(f));
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function fileSize(p) {
  try {
    const s = await stat(p);
    return s.size;
  } catch {
    return 0;
  }
}

async function convertOne(srcPath, quality) {
  const ext = extname(srcPath);
  const dstPath = srcPath.slice(0, -ext.length) + ".webp";

  const dstSize = await fileSize(dstPath);
  if (dstSize > 0) {
    return { skipped: true, srcPath, dstPath, srcSize: 0, dstSize };
  }

  const srcBuf = await readFile(srcPath);
  const srcSize = srcBuf.length;

  const outBuf = await sharp(srcBuf, { failOn: "none" })
    .rotate()
    .webp({ quality })
    .toBuffer();

  await writeFile(dstPath, outBuf);
  // 刪原檔(WebP 全瀏覽器都支援,留兩份只浪費空間)
  await unlink(srcPath);

  return {
    skipped: false,
    srcPath,
    dstPath,
    srcSize,
    dstSize: outBuf.length,
  };
}

function fmtBytes(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  if (n > 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

async function main() {
  let totalIn = 0;
  let totalOut = 0;
  let converted = 0;
  let skipped = 0;

  for (const target of TARGETS) {
    const files = await listFiles(target.dir, target.match);
    if (!files.length) {
      console.log(`(skip) ${target.dir} — no files`);
      continue;
    }
    console.log(`\n→ ${target.dir} (${files.length} files)`);
    for (const f of files) {
      const srcPath = join(target.dir, f);
      const r = await convertOne(srcPath, target.quality);
      if (r.skipped) {
        skipped++;
        console.log(`  skip ${f} (already converted)`);
        continue;
      }
      totalIn += r.srcSize;
      totalOut += r.dstSize;
      converted++;
      const ratio = ((1 - r.dstSize / r.srcSize) * 100).toFixed(0);
      console.log(
        `  ${basename(r.srcPath)} → ${basename(r.dstPath)}  ${fmtBytes(r.srcSize)} → ${fmtBytes(r.dstSize)}  (-${ratio}%)`,
      );
    }
  }

  console.log("\n→ 刪除不再使用的舊大圖");
  for (const p of ORPHAN_FILES) {
    const sz = await fileSize(p);
    if (sz === 0) {
      console.log(`  skip ${basename(p)} (not present)`);
      continue;
    }
    await unlink(p);
    totalIn += sz;
    converted++;
    console.log(`  deleted ${basename(p)} (${fmtBytes(sz)})`);
  }

  console.log("\n=== 總計 ===");
  console.log(`轉換 / 刪除  : ${converted} 檔`);
  console.log(`已存在略過    : ${skipped} 檔`);
  console.log(`原始總大小    : ${fmtBytes(totalIn)}`);
  console.log(`輸出總大小    : ${fmtBytes(totalOut)}`);
  if (totalIn > 0) {
    const saved = ((1 - totalOut / totalIn) * 100).toFixed(1);
    console.log(`節省          : ${fmtBytes(totalIn - totalOut)}  (-${saved}%)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
