/**
 * POST /api/admin/blog/backfill-translations — 把所有 ja/ko 為 NULL 的 blog_posts
 * 用 AI 補上翻譯。en 不在預設範圍內(舊的 18 篇 backfill seed 時已經有 en)。
 *
 * 等同於 scripts/backfill-blog-translations.mjs 的功能,但走 web 觸發,免使用者
 * 開 terminal。寫入用 service_role,寫完 revalidateTag('blog-posts')。
 *
 * 一次處理一篇,避免 deepseek 短時間打太多 call。整體可能 2-5 分鐘,所以
 * maxDuration 拉到上限。
 *
 * 要不要連 en 一起重翻可以 query string ?lang=all(會覆蓋既有 en)。
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { assertAdmin } from "@/lib/admin/apiAuth";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { translatePost, type TargetLang } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 分鐘上限(Vercel hobby/pro 都允許)

interface PostRow {
  id: string;
  slug: string;
  title_zh: string;
  excerpt_zh: string;
  body_zh: string[] | null;
  title_en: string | null;
  body_en: string[] | null;
  title_ja: string | null;
  body_ja: string[] | null;
  title_ko: string | null;
  body_ko: string[] | null;
}

function langsNeeded(post: PostRow, mode: "missing-only" | "all"): TargetLang[] {
  if (mode === "all") return ["en", "ja", "ko"];
  const out: TargetLang[] = [];
  if (post.title_en == null || post.body_en == null) out.push("en");
  if (post.title_ja == null || post.body_ja == null) out.push("ja");
  if (post.title_ko == null || post.body_ko == null) out.push("ko");
  return out;
}

export async function POST(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;
  const { user: actor } = auth.ctx;

  const url = new URL(req.url);
  const mode = url.searchParams.get("lang") === "all" ? "all" : "missing-only";

  const supabase = createAdminClient();
  const { data: posts, error: fetchErr } = await supabase
    .from("blog_posts")
    .select(
      "id, slug, title_zh, excerpt_zh, body_zh, title_en, body_en, title_ja, body_ja, title_ko, body_ko"
    )
    .order("published_at", { ascending: false });
  if (fetchErr) {
    return NextResponse.json({ error: "db_error", detail: fetchErr.message }, { status: 500 });
  }

  const summary: {
    slug: string;
    translated: TargetLang[];
    skipped: boolean;
    errors: { lang: TargetLang; message: string }[];
  }[] = [];
  let totalTranslated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const post of (posts ?? []) as PostRow[]) {
    const langs = langsNeeded(post, mode);
    if (langs.length === 0) {
      summary.push({ slug: post.slug, translated: [], skipped: true, errors: [] });
      totalSkipped++;
      continue;
    }

    const zh = {
      title: post.title_zh,
      excerpt: post.excerpt_zh,
      body: post.body_zh ?? [],
    };

    const patch: Record<string, unknown> = {};
    const succeeded: TargetLang[] = [];
    const errors: { lang: TargetLang; message: string }[] = [];

    for (const lang of langs) {
      try {
        const t = await translatePost(zh, lang);
        patch[`title_${lang}`] = t.title;
        patch[`excerpt_${lang}`] = t.excerpt;
        patch[`body_${lang}`] = t.body;
        succeeded.push(lang);
        totalTranslated++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ lang, message: msg });
        totalFailed++;
        console.error(`[backfill] ${post.slug} ${lang}:`, msg);
      }
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await supabase
        .from("blog_posts")
        .update(patch)
        .eq("id", post.id);
      if (updateErr) {
        errors.push({ lang: "en", message: `db update: ${updateErr.message}` });
        totalFailed++;
      }
    }

    summary.push({ slug: post.slug, translated: succeeded, skipped: false, errors });
  }

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "blog.backfill_translations",
    targetType: "blog_post",
    targetId: "*",
    payload: {
      mode,
      totalPosts: posts?.length ?? 0,
      totalTranslated,
      totalSkipped,
      totalFailed,
    },
  });

  revalidateTag("blog-posts");

  return NextResponse.json({
    ok: true,
    mode,
    totalPosts: posts?.length ?? 0,
    totalTranslated,
    totalSkipped,
    totalFailed,
    summary,
  });
}
