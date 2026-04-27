import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { BLOG_POSTS_BY_DATE } from "@/data/blog";

export const metadata: Metadata = {
  title: "易經 × 塔羅 部落格 · Blog | Tarogram 易問",
  description:
    "塔羅與易經的中英雙語深度文章 — 牌陣解析、占卜入門、AI 占卜、感情事業財運主題。Bilingual articles on tarot and I Ching — spread guides, beginner intros, AI divination, relationship/career/money topics.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Tarogram 易問 · Blog",
    description: "Bilingual deep-dive articles on tarot and I Ching divination.",
  },
};

export default function BlogIndexPage() {
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
        <header style={{ textAlign: "center", marginBottom: 32 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
          >
            部落格 · Blog
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 14, marginTop: 8, fontStyle: "italic" }}>
            塔羅 × 易經 · 中英雙語深度文章
          </p>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {BLOG_POSTS_BY_DATE.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{
                display: "block",
                background: "rgba(13,13,43,0.5)",
                border: "1px solid rgba(212,168,85,0.2)",
                borderRadius: 14,
                padding: 20,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 11, color: "rgba(212,168,85,0.6)", letterSpacing: 1, marginBottom: 6 }}>
                {post.publishedAt}
              </div>
              <h2
                style={{
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 19,
                  color: "#d4a855",
                  margin: "0 0 4px",
                }}
              >
                {post.titleZh}
              </h2>
              <p style={{ color: "rgba(192,192,208,0.65)", fontSize: 13, fontStyle: "italic", margin: "0 0 8px" }}>
                {post.titleEn}
              </p>
              <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                {post.excerptZh}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
