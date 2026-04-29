/**
 * GET    /api/admin/blog/[id] — 取單篇(admin 用,含 unpublished)
 * PUT    /api/admin/blog/[id] — 更新(整篇覆蓋)
 * DELETE /api/admin/blog/[id] — 刪除
 *
 * 寫入用 service_role,寫完 revalidateTag('blog-posts') 戳掉 cache。
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;
const ALLOWED_CATEGORIES = new Set(["intro", "spread", "card", "topic", "ai"]);

interface UpdateBody {
  slug?: string;
  category?: string;
  publishedAt?: string;
  published?: boolean;
  heroImageUrl?: string | null;
  titleZh?: string;
  titleEn?: string;
  excerptZh?: string;
  excerptEn?: string;
  bodyZh?: string[];
  bodyEn?: string[];
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
  for (const f of ["titleZh", "titleEn", "excerptZh", "excerptEn"] as const) {
    if (typeof body[f] !== "string" || !body[f]) {
      return `${f} required`;
    }
  }
  for (const f of ["bodyZh", "bodyEn"] as const) {
    if (!Array.isArray(body[f]) || body[f]!.length === 0) {
      return `${f} 至少需要一個段落`;
    }
    if (body[f]!.some((p) => typeof p !== "string")) {
      return `${f} 內容必須全部是字串`;
    }
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

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .update({
      slug: body.slug!,
      category: body.category!,
      published_at: body.publishedAt!,
      published: body.published ?? true,
      hero_image_url: body.heroImageUrl ?? null,
      title_zh: body.titleZh!,
      title_en: body.titleEn!,
      excerpt_zh: body.excerptZh!,
      excerpt_en: body.excerptEn!,
      body_zh: body.bodyZh!,
      body_en: body.bodyEn!,
    })
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
    payload: { slug: data.slug, published: data.published },
  });

  revalidateTag("blog-posts");

  return NextResponse.json({ ok: true, post: data });
}

export async function DELETE(_req: NextRequest, ctx: RouteParams) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;
  const { id } = await ctx.params;

  const supabase = createAdminClient();
  // 先撈起來給 audit log 用,再刪
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
