/**
 * GET  /api/admin/blog — 列全部文章(含 unpublished),按 published_at desc
 * POST /api/admin/blog — 新增一篇
 *
 * 寫入用 service_role,繞過 RLS。寫完 revalidateTag('blog-posts') 戳掉
 * lib/blog.ts 的 unstable_cache,讓前台 /blog 立即看到新內容。
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

interface CreateBody {
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

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "id, slug, category, published_at, published, hero_image_url, title_zh, title_en, excerpt_zh, excerpt_en, body_zh, body_en, updated_at"
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
      title_en: body.titleEn!,
      excerpt_zh: body.excerptZh!,
      excerpt_en: body.excerptEn!,
      body_zh: body.bodyZh!,
      body_en: body.bodyEn!,
      created_by: actor.id,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation (slug 重複)
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
    payload: { slug: data.slug, category: data.category, published: data.published },
  });

  revalidateTag("blog-posts");

  return NextResponse.json({ ok: true, post: data });
}
