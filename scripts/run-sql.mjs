#!/usr/bin/env node
/**
 * scripts/run-sql.mjs <path/to/migration.sql>
 *
 * 直接連 Supabase Postgres 跑 SQL migration。讀 .env.local 拿 DATABASE_URL。
 *
 * 用法:
 *   node scripts/run-sql.mjs supabase/phase10_question_inspirations.sql
 *
 * 設計:
 *   - 整個檔案視為單一 transaction(BEGIN / COMMIT)— 任一句失敗就全 rollback
 *   - SQL 內可有 plpgsql function 定義(`$$ ... $$`),所以不能 naive 切分號;
 *     直接把整個檔案內容一次送給 server,讓 Postgres 自己 parse multi-statement
 *   - SSL 強制開(Supabase 預設要 TLS)
 *
 * 安全:DATABASE_URL 永遠只從 env 讀,不把密碼印出來
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { setDefaultResultOrder } from "node:dns";
import pg from "pg";

// 強制 IPv4 優先 — 避開「Supabase host 解析到 IPv6 但本地網路不通」的 ETIMEDOUT
// (常見於 ISP / 路由器只提供 IPv4 出口的環境;Node 18+ 預設會優先 IPv6)
setDefaultResultOrder("ipv4first");

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// ── 載入 .env.local(只在 process.env 沒有時才覆蓋) ──
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
    // 去掉成對引號
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

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("usage: node scripts/run-sql.mjs <path/to/migration.sql>");
  process.exit(2);
}

const fullPath = resolve(repoRoot, sqlPath);
if (!existsSync(fullPath)) {
  console.error(`SQL file not found: ${fullPath}`);
  process.exit(2);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error(
    "DATABASE_URL is not set. Add it to .env.local — see Supabase Dashboard → Project Settings → Database → Connection string (URI)."
  );
  process.exit(2);
}

const sql = readFileSync(fullPath, "utf8");
console.log(`▶ Running ${basename(fullPath)} (${sql.length} chars)…`);

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("✓ Migration applied successfully");
} catch (e) {
  try {
    await client.query("ROLLBACK");
  } catch {
    /* ignore rollback errors */
  }
  console.error("✗ Migration failed:");
  console.error(e instanceof Error ? e.message : String(e));
  if (e && typeof e === "object" && "position" in e) {
    console.error(`  position: ${(e).position}`);
  }
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
