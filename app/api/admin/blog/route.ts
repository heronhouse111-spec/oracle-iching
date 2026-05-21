/**
 * GET  /api/admin/blog — 列全部文章(含 unpublished),按 published_at desc
 * POST /api/admin/blog — 新增一篇:admin 只給中文,server 自動翻譯成 en/ja/ko 後一起存。
 *
 * 寫入用 service_role,繞過 RLS。寫完 revalidateTag('blog-posts') 戳掉
 * lib/blog.ts 的 unstable_cache,讓前台 /blog 立即看到新內容。
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { translatePostToAllLangs } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 翻譯三語平行可能 ~10s,放寬 timeout
export const maxDuration = 60;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;
const ALLOWED_CATEGORIES = new Set(["intro", "spread", "card", "topic", "ai"]);

interface CreateBody {
  slug?: string;
  category?: string;
  publishedAt?: string;
  published?: boolean;
  heroImageUrl?: string | null;
  titleZh?: string;
  excerptZh?: string;
  bodyZh?: string[];
}

function validate(body: CreateBody): string | null {
  if (!body.slug || !SLUG_RE.test(body.slug)) {
    return "slug 必須是小寫字母 / 數字 / 連字號,2-81 字";
  }
  if (!body.category || !ALLOWED_CATEGORIES.has(body.category)) {
    return "category 必須是 intro / spread / card / topic / ai 其中之一";
  }
  if (!body.publishedAt || !/^\d{4}-\d{2}-\d{2}$/.test(body.publishedAt)) {
    return "publishedAt 必須是 YYYY-MM-DD 日期格式";
  }
  if (typeof body.titleZh !== "string" || !body.titleZh) return "titleZh required";
  if (typeof body.excerptZh !== "string" || !body.excerptZh) return "excerptZh required";
  if (!Array.isArray(body.bodyZh) || body.bodyZh.length === 0) {
    return "bodyZh 至少需要一個段落";
  }
  if (body.bodyZh.some((p) => typeof p !== "string")) {
    return "bodyZh 內容必須全部是字串";
  }
  return null;
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "id, slug, category, published_at, published, hero_image_url, " +
      "title_zh, title_en, excerpt_zh, excerpt_en, " +
      "body_zh, body_en, body_ja, body_ko, " +
      "updated_at"
    )
    .order("published_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ error: "validation", detail: validationError }, { status: 400 });
  }

  // ── AI 翻譯 zh → en / ja / ko ────────────────────────────
  // 任一語系失敗 → 該欄位存 null,前台會 fallback 到其他語系或 zh。
  // 整體永不 throw — admin save 不會被翻譯失敗擋住。
  const translations = await translatePostToAllLangs({
    title: body.titleZh!,
    excerpt: body.excerptZh!,
    body: body.bodyZh!,
  });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      slug: body.slug!,
      category: body.category!,
      published_at: body.publishedAt!,
      published: body.published ?? true,
      hero_image_url: body.heroImageUrl ?? null,
      title_zh: body.titleZh!,
      excerpt_zh: body.excerptZh!,
      body_zh: body.bodyZh!,
      // schema 有 NOT NULL on en — 翻譯失敗時用 zh 當佔位讓 insert 成功
      title_en: translations.en?.title ?? body.titleZh!,
      excerpt_en: translations.en?.excerpt ?? body.excerptZh!,
      body_en: translations.en?.body ?? body.bodyZh!,
      title_ja: translations.ja?.title ?? null,
      excerpt_ja: translations.ja?.excerpt ?? null,
      body_ja: translations.ja?.body ?? null,
      title_ko: translations.ko?.title ?? null,
      excerpt_ko: translations.ko?.excerpt ?? null,
      body_ko: translations.ko?.body ?? null,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json(
      { error: status === 409 ? "duplicate_slug" : "db_error", detail: error.message },
      { status }
    );
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "blog.post.create",
    targetType: "blog_post",
    targetId: data.id,
    payload: {
      slug: data.slug,
      category: data.category,
      published: data.published,
      translationErrors: translations.errors.length > 0 ? translations.errors : undefined,
    },
  });

  revalidateTag("blog-posts");

  return NextResponse.json({
    ok: true,
    post: data,
    translationWarnings: translations.errors,
  });
}
