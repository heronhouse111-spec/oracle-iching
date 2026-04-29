import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import {
  getBlogPostBySlug,
  getPublishedBlogPosts,
  getAllPublishedSlugs,
  pickTitle,
  pickExcerpt,
} from "@/lib/blog";
import { getServerLocale, pickByLocale } from "@/lib/serverLocale";
import BlogPostView from "./BlogPostView";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "Article not found" };
  const { locale } = await getServerLocale();

  const title = pickTitle(post, locale);
  const excerpt = pickExcerpt(post, locale);
  const brandSuffix = pickByLocale(
    locale,
    "Tarogram 易問",
    "Tarogram",
    "Tarogram 易問",
    "Tarogram 타로그램"
  );

  return {
    title: `${title} | ${brandSuffix}`,
    description: excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title,
      description: excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      images: post.heroImageUrl ? [{ url: post.heroImageUrl }] : undefined,
    },
  };
}

export default async function BlogSlugPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  // 找上一篇 / 下一篇(以 publishedAt 排序)— 只給 client view 必要欄位以瘦 props
  const sorted = await getPublishedBlogPosts();
  const idx = sorted.findIndex((p) => p.slug === post.slug);
  const prevP = idx > 0 ? sorted[idx - 1] : null;
  const nextP = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  const trim = (p: typeof prevP) =>
    p
      ? {
          slug: p.slug,
          titleZh: p.titleZh,
          titleEn: p.titleEn,
          titleJa: p.titleJa,
          titleKo: p.titleKo,
        }
      : null;

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <BlogPostView post={post} prev={trim(prevP)} next={trim(nextP)} />
    </main>
  );
}
