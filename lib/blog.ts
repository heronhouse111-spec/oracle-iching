/**
 * lib/blog.ts — server-side blog reader for /blog and /blog/[slug].
 *
 * 跟 lib/uiImages.ts / lib/ichingImages.ts 同一套 pattern:plain anon-key
 * supabase client(避開 cookies 觸發 dynamic API)+ unstable_cache 60s,
 * 讓 /blog 跟 /blog/[slug] 維持 static / SSG。後台 /admin/blog 改文章後,
 * /api/admin/blog/[id] PUT 完成 revalidateTag('blog-posts') 立即清快取。
 *
 * 公開介面只回 published=true 的(由 RLS policy 在 SQL 端再保險一次)。
 *
 * 多語系:每篇 row 同時帶 zh/en/ja/ko 四欄,server 端把所有語系包成一個物件
 * 丟給 client view,client view 用 useLanguage() 動態挑欄位 — 這樣切語系
 * 就不必 router.refresh(),也不會雙語一起渲染。
 */

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

export interface BlogPost {
  id: string;
  slug: string;
  category: "intro" | "spread" | "card" | "topic" | "ai" | string;
  publishedAt: string;
  published: boolean;
  heroImageUrl: string | null;
  // zh 永遠有(必填),其他語系 ja/ko 可能 null(翻譯失敗或還沒翻)
  titleZh: string;
  titleEn: string | null;
  titleJa: string | null;
  titleKo: string | null;
  excerptZh: string;
  excerptEn: string | null;
  excerptJa: string | null;
  excerptKo: string | null;
  bodyZh: string[];
  bodyEn: string[] | null;
  bodyJa: string[] | null;
  bodyKo: string[] | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

interface RawRow {
  id: string;
  slug: string;
  category: string;
  published_at: string;
  published: boolean;
  hero_image_url: string | null;
  title_zh: string;
  title_en: string | null;
  title_ja: string | null;
  title_ko: string | null;
  excerpt_zh: string;
  excerpt_en: string | null;
  excerpt_ja: string | null;
  excerpt_ko: string | null;
  body_zh: string[] | null;
  body_en: string[] | null;
  body_ja: string[] | null;
  body_ko: string[] | null;
}

function rowToPost(r: RawRow): BlogPost {
  return {
    id: r.id,
    slug: r.slug,
    category: r.category,
    publishedAt: r.published_at,
    published: r.published,
    heroImageUrl: r.hero_image_url,
    titleZh: r.title_zh,
    titleEn: r.title_en,
    titleJa: r.title_ja,
    titleKo: r.title_ko,
    excerptZh: r.excerpt_zh,
    excerptEn: r.excerpt_en,
    excerptJa: r.excerpt_ja,
    excerptKo: r.excerpt_ko,
    bodyZh: r.body_zh ?? [],
    bodyEn: r.body_en,
    bodyJa: r.body_ja,
    bodyKo: r.body_ko,
  };
}

const SELECT_COLS =
  "id, slug, category, published_at, published, hero_image_url, " +
  "title_zh, title_en, title_ja, title_ko, " +
  "excerpt_zh, excerpt_en, excerpt_ja, excerpt_ko, " +
  "body_zh, body_en, body_ja, body_ko";

async function fetchAllPublished(): Promise<BlogPost[]> {
  if (!supabaseUrl || !supabaseAnonKey) return [];
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .from("blog_posts")
      .select(SELECT_COLS)
      .eq("published", true)
      .order("published_at", { ascending: false });
    if (error || !data) return [];
    return (data as RawRow[]).map(rowToPost);
  } catch {
    return [];
  }
}

/**
 * 取所有已上架的文章,按 publishedAt desc 排序(最新在前)。
 * 60s cache + revalidateTag('blog-posts') 由 admin PUT/DELETE 戳掉。
 */
export const getPublishedBlogPosts = unstable_cache(
  fetchAllPublished,
  ["blog-posts-published-list"],
  { revalidate: 60, tags: ["blog-posts"] }
);

async function fetchBySlug(slug: string): Promise<BlogPost | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .from("blog_posts")
      .select(SELECT_COLS)
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (error || !data) return null;
    return rowToPost(data as RawRow);
  } catch {
    return null;
  }
}

/** 拿單篇 — slug 是 URL 識別 */
export const getBlogPostBySlug = unstable_cache(
  fetchBySlug,
  ["blog-post-by-slug"],
  { revalidate: 60, tags: ["blog-posts"] }
);

/**
 * 給 /blog/[slug] 的 generateStaticParams 用 — 所有 published slug 列表。
 * 不快取(build-time 一次性呼叫,加 cache 反而干擾 build pipeline)。
 */
export async function getAllPublishedSlugs(): Promise<string[]> {
  if (!supabaseUrl || !supabaseAnonKey) return [];
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .from("blog_posts")
      .select("slug")
      .eq("published", true);
    if (error || !data) return [];
    return (data as { slug: string }[]).map((r) => r.slug);
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────
// Locale-picking helpers (給 client view 用)
// ──────────────────────────────────────────

/** 依 locale 挑 title;如果該語系是 null 就 fallback 到 en → zh */
export function pickTitle(p: BlogPost, locale: "zh" | "en" | "ja" | "ko"): string {
  if (locale === "zh") return p.titleZh;
  if (locale === "en") return p.titleEn ?? p.titleZh;
  if (locale === "ja") return p.titleJa ?? p.titleEn ?? p.titleZh;
  return p.titleKo ?? p.titleEn ?? p.titleZh;
}

export function pickExcerpt(p: BlogPost, locale: "zh" | "en" | "ja" | "ko"): string {
  if (locale === "zh") return p.excerptZh;
  if (locale === "en") return p.excerptEn ?? p.excerptZh;
  if (locale === "ja") return p.excerptJa ?? p.excerptEn ?? p.excerptZh;
  return p.excerptKo ?? p.excerptEn ?? p.excerptZh;
}

export function pickBody(p: BlogPost, locale: "zh" | "en" | "ja" | "ko"): string[] {
  if (locale === "zh") return p.bodyZh;
  if (locale === "en") return p.bodyEn ?? p.bodyZh;
  if (locale === "ja") return p.bodyJa ?? p.bodyEn ?? p.bodyZh;
  return p.bodyKo ?? p.bodyEn ?? p.bodyZh;
}
