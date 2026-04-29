"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import BlogPostEditor, { type BlogPostFormValue } from "../../BlogPostEditor";

interface RawPost {
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

function rawToForm(p: RawPost): BlogPostFormValue {
  return {
    slug: p.slug,
    category: p.category,
    publishedAt: p.published_at,
    published: p.published,
    heroImageUrl: p.hero_image_url,
    titleZh: p.title_zh,
    titleEn: p.title_en,
    excerptZh: p.excerpt_zh,
    excerptEn: p.excerpt_en,
    bodyZhText: (p.body_zh ?? []).join("\n\n"),
    bodyEnText: (p.body_en ?? []).join("\n\n"),
  };
}

export default function EditBlogPostPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [initial, setInitial] = useState<BlogPostFormValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/blog/${id}`, { cache: "no-store" });
        if (res.status === 401) {
          window.location.href = "/?redirect=/admin/blog";
          return;
        }
        if (res.status === 404) {
          setError("找不到這篇文章 — 可能已被刪除");
          return;
        }
        if (!res.ok) {
          setError(`HTTP ${res.status}`);
          return;
        }
        const { post } = (await res.json()) as { post: RawPost };
        if (!cancelled) setInitial(rawToForm(post));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
          編輯文章
        </h1>
        <p style={{ fontSize: 12, color: "rgba(192,192,208,0.55)", marginBottom: 24 }}>
          儲存變更後最多 60 秒前台 /blog 與 /blog/[slug] 會更新。
        </p>

        {error && (
          <div
            style={{
              padding: 12,
              border: "1px solid rgba(248,113,113,0.4)",
              background: "rgba(248,113,113,0.08)",
              borderRadius: 8,
              color: "#fca5a5",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {!initial && !error && (
          <div style={{ color: "rgba(192,192,208,0.55)", padding: 24 }}>載入中…</div>
        )}

        {initial && id && (
          <BlogPostEditor mode="edit" postId={id} initial={initial} />
        )}
      </main>
    </div>
  );
}
