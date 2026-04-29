import type { Metadata } from "next";
import Header from "@/components/Header";
import { getPublishedBlogPosts } from "@/lib/blog";
import BlogIndexView from "./BlogIndexView";

export const metadata: Metadata = {
  title: "易經 × 塔羅 部落格 · Blog | Tarogram 易問",
  description:
    "塔羅與易經的多語深度文章 — 牌陣解析、占卜入門、AI 占卜、感情事業財運主題。Multilingual articles on tarot and I Ching.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Tarogram 易問 · Blog",
    description: "Multilingual deep-dive articles on tarot and I Ching divination.",
  },
};

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts();
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <BlogIndexView posts={posts} />
    </main>
  );
}
