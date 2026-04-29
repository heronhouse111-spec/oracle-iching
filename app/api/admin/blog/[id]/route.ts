/**
 * GET    /api/admin/blog/[id] — 取單篇(admin 用,含 unpublished)
 * PUT    /api/admin/blog/[id] — 更新:admin 改完中文,server 重新翻譯三語覆蓋
 * DELETE /api/admin/blog/[id] — 刪除
 *
 * 寫入用 service_role,寫完 revalidateTag('blog-posts') 戳掉 cache。
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { translatePostToAllLangs } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;
const ALLOWED_CATEGORIES = new Set(["intro", "spread", "card", "topic", "ai"]);

interface UpdateBody {
  slug?: string;
  category?: string;
  publishedAt?: string;
  published?: boolean;
  heroImageUrl?: string | null;
  titleZh?: string;
  excerptZh?: string;
  bodyZh?: string[];
}

function validate(body: UpdateBody): string | null {
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteParams) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ post: data });
}

export async function PUT(req: NextRequest, ctx: RouteParams) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ error: "validation", detail: validationError }, { status: 400 });
  }

  // 重新從 zh 翻譯三語(覆蓋既有翻譯)— 確保所有語系都跟最新中文版同步
  const translations = await translatePostToAllLangs({
    title: body.titleZh!,
    excerpt: body.excerptZh!,
    body: body.bodyZh!,
  });

  const supabase = createAdminClient();
  // 只覆寫翻譯成功的語系欄位 — 失敗的語系保留 DB 既有值,不要把舊翻譯洗掉
  const updatePayload: Record<string, unknown> = {
    slug: body.slug!,
    category: body.category!,
    published_at: body.publishedAt!,
    published: body.published ?? true,
    hero_image_url: body.heroImageUrl ?? null,
    title_zh: body.titleZh!,
    excerpt_zh: body.excerptZh!,
    body_zh: body.bodyZh!,
  };
  if (translations.en) {
    updatePayload.title_en = translations.en.title;
    updatePayload.excerpt_en = translations.en.excerpt;
    updatePayload.body_en = translations.en.body;
  }
  if (translations.ja) {
    updatePayload.title_ja = translations.ja.title;
    updatePayload.excerpt_ja = translations.ja.excerpt;
    updatePayload.body_ja = translations.ja.body;
  }
  if (translations.ko) {
    updatePayload.title_ko = translations.ko.title;
    updatePayload.excerpt_ko = translations.ko.excerpt;
    updatePayload.body_ko = translations.ko.body;
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .update(updatePayload)
    .eq("id", id)
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
    action: "blog.post.update",
    targetType: "blog_post",
    targetId: data.id,
    payload: {
      slug: data.slug,
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

export async function DELETE(_req: NextRequest, ctx: RouteParams) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("blog_posts")
    .select("id, slug")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "blog.post.delete",
    targetType: "blog_post",
    targetId: existing.id,
    payload: { slug: existing.slug },
  });

  revalidateTag("blog-posts");

  return NextResponse.json({ ok: true });
}
