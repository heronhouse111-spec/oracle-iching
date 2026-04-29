"use client";

import Link from "next/link";
import Header from "@/components/Header";
import BlogPostEditor, { type BlogPostFormValue } from "../BlogPostEditor";

const today = new Date().toISOString().slice(0, 10);

const empty: BlogPostFormValue = {
  slug: "",
  category: "intro",
  publishedAt: today,
  published: true,
  heroImageUrl: null,
  titleZh: "",
  titleEn: "",
  excerptZh: "",
  excerptEn: "",
  bodyZhText: "",
  bodyEnText: "",
};

export default function NewBlogPostPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main
        style={{
          paddingTop: 88,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 980,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link
            href="/admin/blog"
            style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", textDecoration: "none" }}
          >
            ← 文章列表
          </Link>
        </div>
        <h1
          className="text-gold-gradient"
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 24, marginBottom: 4 }}
        >
          新增文章
        </h1>
        <p style={{ fontSize: 12, color: "rgba(192,192,208,0.55)", marginBottom: 24 }}>
          填好下面欄位後按「建立文章」。Slug 一旦發布就最好不要改(會影響 SEO 與已分享的連結)。
        </p>
        <BlogPostEditor mode="new" initial={empty} />
      </main>
    </div>
  );
}
