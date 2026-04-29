/**
 * lib/blog.ts — server-side blog reader for /blog and /blog/[slug].
 *
 * 跟 lib/uiImages.ts / lib/ichingImages.ts 同一套 pattern:plain anon-key
 * supabase client(避開 cookies 觸發 dynamic API)+ unstable_cache 60s,
 * 讓 /blog 跟 /blog/[slug] 維持 static / SSG。後台 /admin/blog 改文章後,
 * /api/admin/blog/[id] PUT 完成 revalidateTag('blog-posts') 立即清快取。
 *
 * 公開介面只回 published=true 的(由 RLS policy 在 SQL 端再保險一次)。
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
  titleZh: string;
  titleEn: string;
  excerptZh: string;
  excerptEn: string;
  bodyZh: string[];
  bodyEn: string[];
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
  title_en: string;
  excerpt_zh: string;
  excerpt_en: string;
  body_zh: string[] | null;
  body_en: string[] | null;
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
    excerptZh: r.excerpt_zh,
    excerptEn: r.excerpt_en,
    bodyZh: r.body_zh ?? [],
    bodyEn: r.body_en ?? [],
  };
}

async function fetchAllPublished(): Promise<BlogPost[]> {
  if (!supabaseUrl || !supabaseAnonKey) return [];
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id, slug, category, published_at, published, hero_image_url, title_zh, title_en, excerpt_zh, excerpt_en, body_zh, body_en"
      )
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
      .select(
        "id, slug, category, published_at, published, hero_image_url, title_zh, title_en, excerpt_zh, excerpt_en, body_zh, body_en"
      )
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
