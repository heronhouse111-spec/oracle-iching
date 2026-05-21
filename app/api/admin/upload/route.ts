/**
 * POST /api/admin/upload — admin 上傳圖片到 Supabase Storage 'app-images' bucket
 *
 * Multipart form fields:
 *   file: File           (required, image/*)
 *   folder: string       (required, e.g. 'personas' / 'categories' / 'free-tools')
 *   filename?: string    (optional, 沒給就 fallback 到 timestamp + 原檔名)
 *
 * Response: { ok: true, url: string, path: string }
 *
 * 走 service_role(createAdminClient)上傳,繞過 RLS — 我們已經在 assertAdmin 守過,
 * 這裡用 service_role 是為了避免依賴呼叫者 session 的 storage 權限細節。
 *
 * 圖片優化(2026-05):
 *   PNG / JPEG / WEBP 進來會用 sharp resize 到最大邊 MAX_DIMENSION,
 *   並重編碼為 WebP(quality 80)以縮小檔案。SVG / GIF 不動(SVG 已經夠小、
 *   GIF 可能有動畫不適合無腦轉)。
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB(進來的原檔上限)
const MAX_DIMENSION = 1600; // 最大邊長,超過會等比縮
const WEBP_QUALITY = 80;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
const RESAMPLED_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

function safeName(input: string): string {
  // 拿掉路徑分隔 + 非 ASCII;保留 ASCII 字母數字底線連字號小數點
  return input.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

/** 把檔名換副檔名(例如 foo.png → foo.webp)。沒副檔名就直接附加。 */
function swapExtension(name: string, newExt: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${newExt}`;
}

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  const folderRaw = form.get("folder");
  const filenameRaw = form.get("filename");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "validation", detail: "file is required" },
      { status: 400 },
    );
  }
  if (typeof folderRaw !== "string" || !folderRaw.trim()) {
    return NextResponse.json(
      { error: "validation", detail: "folder is required" },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "too_large", detail: `max ${MAX_BYTES / 1024 / 1024} MB` },
      { status: 413 },
    );
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.includes(mime)) {
    return NextResponse.json(
      { error: "bad_type", detail: `allowed: ${ALLOWED_MIME.join(", ")}` },
      { status: 415 },
    );
  }

  const folder = safeName(folderRaw);
  const rawBaseName =
    typeof filenameRaw === "string" && filenameRaw.trim()
      ? safeName(filenameRaw)
      : `${Date.now()}_${safeName(file.name)}`;

  const originalBuf = Buffer.from(await file.arrayBuffer());
  const originalSize = originalBuf.length;

  // 走 sharp 的格式才壓 + 轉 WebP;SVG / GIF 直接原檔上傳。
  let outBuf: Buffer = originalBuf;
  let outMime: string = mime;
  let outBaseName = rawBaseName;
  let resampled = false;

  if (RESAMPLED_MIMES.has(mime)) {
    try {
      outBuf = await sharp(originalBuf, { failOn: "none" })
        .rotate() // 依 EXIF 自動轉正
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      outMime = "image/webp";
      outBaseName = swapExtension(rawBaseName, "webp");
      resampled = true;
    } catch (e) {
      console.error("[upload] sharp failed, falling back to raw upload:", e);
      // sharp 失敗(極少見,例如損毀檔)就退回原檔,不擋使用者
    }
  }

  const path = `${folder}/${outBaseName}`;

  const supabase = createAdminClient();
  const { error: upErr } = await supabase.storage
    .from("app-images")
    .upload(path, outBuf, {
      contentType: outMime,
      upsert: true, // 同名直接覆蓋,讓 admin 「換圖」變簡單
    });

  if (upErr) {
    return NextResponse.json(
      { error: "upload_failed", detail: upErr.message },
      { status: 500 },
    );
  }

  const { data: pub } = supabase.storage.from("app-images").getPublicUrl(path);

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "image.upload",
    targetType: "storage",
    targetId: path,
    payload: {
      mime: outMime,
      original_mime: mime,
      original_size: originalSize,
      output_size: outBuf.length,
      resampled,
      folder,
    },
  });

  return NextResponse.json({
    ok: true,
    url: pub.publicUrl,
    path,
    resampled,
    originalSize,
    outputSize: outBuf.length,
  });
}
