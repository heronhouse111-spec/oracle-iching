import type { Metadata } from "next";
import Header from "@/components/Header";
import { getPublishedBlogPosts } from "@/lib/blog";
import { getServerLocale, pickByLocale } from "@/lib/serverLocale";
import BlogIndexView from "./BlogIndexView";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerLocale();
  const title = pickByLocale(
    locale,
    "易經 × 塔羅 部落格 | Tarogram 易問",
    "I Ching × Tarot Blog | Tarogram",
    "易経 × タロット ブログ | Tarogram",
    "주역 × 타로 블로그 | Tarogram"
  );
  const description = pickByLocale(
    locale,
    "塔羅與易經的多語深度文章 — 牌陣解析、占卜入門、AI 占卜、感情事業財運主題。",
    "Multilingual deep-dive articles on tarot and I Ching — spread breakdowns, divination basics, AI readings, love/career/wealth topics.",
    "タロットと易経の多言語深掘り記事 — スプレッド解説、占いの基礎、AI占い、恋愛・仕事・金運のテーマ。",
    "타로와 주역의 다언어 심층 글 — 스프레드 해설, 점치기 기초, AI 점, 연애·커리어·재물 주제."
  );
  return {
    title,
    description,
    alternates: { canonical: "/blog" },
    openGraph: { title, description },
  };
}

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts();
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <BlogIndexView posts={posts} />
    </main>
  );
}
