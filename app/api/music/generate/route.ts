import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  spendCredits,
  refundCredits,
  InsufficientCreditsError,
  CREDIT_COSTS,
} from "@/lib/credits";
import { moderateMusicText, moderationMessage } from "@/lib/music/moderation";

// Stable Audio 180 秒生成大約 14–20 秒,加上傳 Storage 留 60s buffer 充裕
export const maxDuration = 60;
// 不要 cache(每次都是新生成)
export const dynamic = "force-dynamic";

const STABILITY_URL =
  "https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio";
const BUCKET = "app-music";

// 統一 180 秒(3 分鐘)— Stable Audio API 不論長短都收 9 credits / $0.09,
// 所以給用戶 180s 不增加成本,但循環感大幅降低、體感品質遠優於 60s。
const TRACK_DURATION_SECONDS = 180;
const VALID_CATEGORIES = [
  "meditation",
  "mystery",
  "nature",
  "oriental",
  "focus",
  "dream",
] as const;
const VALID_LOCALES = ["zh", "en", "ja", "ko"] as const;

export async function POST(request: NextRequest) {
  // ── 1. 環境檢查 ──────────────────────────────────────
  const stabilityKey = process.env.STABILITY_API_KEY;
  if (!stabilityKey) {
    return jsonError(500, "MUSIC_API_NOT_CONFIGURED", "Stability API not configured");
  }

  // ── 2. 驗身份(必須登入,訪客不能用) ──────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError(401, "LOGIN_REQUIRED", "Please sign in to generate music");
  }

  // ── 3. 解析 + 驗 body ───────────────────────────────
  let body: {
    prompt?: unknown;
    category?: unknown;
    title?: unknown;
    locale?: unknown;
    isRetry?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_BODY", "Invalid JSON");
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const category = typeof body.category === "string" ? body.category : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const locale = typeof body.locale === "string" ? body.locale : "zh";
  const isRetry = body.isRetry === true;

  if (prompt.length < 5 || prompt.length > 500) {
    return jsonError(400, "INVALID_PROMPT", "Prompt must be 5–500 chars");
  }
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return jsonError(400, "INVALID_CATEGORY", `Category must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }
  if (!VALID_LOCALES.includes(locale as (typeof VALID_LOCALES)[number])) {
    return jsonError(400, "INVALID_LOCALE", "Invalid locale");
  }

  // ── 3.5 Moderation — 扣點前先擋,通不過不收錢、不打 AI ──
  const moderation = await moderateMusicText(prompt, title);
  if (!moderation.allowed) {
    return jsonError(
      422,
      "MODERATION_BLOCKED",
      moderationMessage(moderation, locale as "zh" | "en" | "ja" | "ko"),
      { layer: moderation.layer, detail: moderation.detail },
    );
  }

  // ── 4. 扣點(餘額不足回 402) ─────────────────────
  const cost = isRetry ? CREDIT_COSTS.MUSIC_GENERATE_RETRY : CREDIT_COSTS.MUSIC_GENERATE;
  const reason = isRetry ? "spend_music_generate_retry" : "spend_music_generate";
  try {
    await spendCredits({
      userId: user.id,
      amount: cost,
      reason,
      metadata: { prompt: prompt.slice(0, 200), category, locale },
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return jsonError(402, "INSUFFICIENT_CREDITS", "點數不足", { required: cost });
    }
    console.error("[music/generate] spendCredits failed:", err);
    return jsonError(500, "CREDIT_DEDUCTION_FAILED", "Failed to deduct credits");
  }

  // ── 5. 呼叫 Stable Audio API ────────────────────────
  let audioBuffer: Buffer;
  try {
    const formData = new FormData();
    formData.set("prompt", prompt);
    formData.set("duration", String(TRACK_DURATION_SECONDS));
    formData.set("output_format", "mp3");
    formData.set("model", "stable-audio-2");

    const res = await fetch(STABILITY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stabilityKey}`,
        Accept: "audio/*",
      },
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "<no body>");
      throw new Error(`Stable Audio ${res.status}: ${errorText.slice(0, 200)}`);
    }

    audioBuffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    // AI 失敗 → 全額退款
    await refundCredits({
      userId: user.id,
      amount: cost,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    console.error("[music/generate] Stable Audio failed:", err);
    return jsonError(502, "MUSIC_GENERATION_FAILED", "AI 生成失敗,已自動退點", {
      detail: err instanceof Error ? err.message : "unknown",
    });
  }

  // ── 6. 上傳 Supabase Storage ────────────────────────
  // Storage key 必須 ASCII。用 sha1(user_id + prompt + timestamp) 前 12 chars
  const hashSrc = `${user.id}|${prompt}|${Date.now()}`;
  const fileHash = createHash("sha1").update(hashSrc).digest("hex").slice(0, 12);
  const storagePath = `user/${user.id}/${category}-${fileHash}.mp3`;

  const admin = createAdminClient();
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, audioBuffer, {
      contentType: "audio/mpeg",
      upsert: false,
    });

  if (uploadErr) {
    // Upload 失敗 → 退款(音檔已生成但無法存,只能讓 user 重生)
    await refundCredits({
      userId: user.id,
      amount: cost,
      errorMessage: `Storage upload failed: ${uploadErr.message}`,
    });
    console.error("[music/generate] Storage upload failed:", uploadErr);
    return jsonError(500, "STORAGE_UPLOAD_FAILED", "音檔儲存失敗,已自動退點");
  }

  // ── 7. 寫 DB(預設 private) ─────────────────────────
  const { data: musicId, error: regErr } = await admin.rpc("register_generated_music", {
    p_creator_id: user.id,
    p_title: title || prompt.slice(0, 30),
    p_prompt: prompt,
    p_prompt_locale: locale,
    p_category_id: category,
    p_storage_path: storagePath,
    p_duration_seconds: TRACK_DURATION_SECONDS,
    p_provider: "stable_audio",
    p_provider_track_id: null,
    p_is_seed: false,
    p_is_free: false,
    p_publish_now: false, // 預設 private,用戶決定要不要發布到排行榜
  });

  if (regErr) {
    // DB 註冊失敗 → 把 storage 物件砍掉 + 退款
    await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    await refundCredits({
      userId: user.id,
      amount: cost,
      errorMessage: `DB register failed: ${regErr.message}`,
    });
    console.error("[music/generate] register_generated_music failed:", regErr);
    return jsonError(500, "MUSIC_REGISTER_FAILED", "音檔註冊失敗,已自動退點");
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

  return new Response(
    JSON.stringify({
      success: true,
      musicId,
      title: title || prompt.slice(0, 30),
      category,
      durationSeconds: TRACK_DURATION_SECONDS,
      audioUrl: publicUrl,
      cost,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({ error: code, message, ...extra }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}
