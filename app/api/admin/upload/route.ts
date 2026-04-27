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
 */

import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

function safeName(input: string): string {
  // 拿掉路徑分隔 + 非 ASCII;保留 ASCII 字母數字底線連字號小數點
  return input.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
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
  const baseName =
    typeof filenameRaw === "string" && filenameRaw.trim()
      ? safeName(filenameRaw)
      : `${Date.now()}_${safeName(file.name)}`;
  const path = `${folder}/${baseName}`;

  const supabase = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("app-images")
    .upload(path, buf, {
      contentType: mime,
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
    payload: { mime, sizeBytes: file.size, folder },
  });

  return NextResponse.json({ ok: true, url: pub.publicUrl, path });
}
