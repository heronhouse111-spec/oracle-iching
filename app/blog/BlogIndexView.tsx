"use client";

/**
 * BlogIndexView — /blog 索引頁的 client view。
 * 切語系時 useLanguage() 變動,React 直接 re-render,不會雙語並列。
 */

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { pickTitle, pickExcerpt, type BlogPost } from "@/lib/blog";

interface Props {
  posts: BlogPost[];
}

export default function BlogIndexView({ posts }: Props) {
  const { t, locale } = useLanguage();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <h1
          className="text-gold-gradient"
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
        >
          {t("部落格", "Blog", "ブログ", "블로그")}
        </h1>
        <p style={{ color: "#c0c0d0", fontSize: 14, marginTop: 8, fontStyle: "italic" }}>
          {t(
            "塔羅 × 易經 · 深度文章",
            "Tarot × I Ching · Deep dives",
            "タロット × 易経 · 深掘り記事",
            "타로 × 주역 · 깊이 있는 글"
          )}
        </p>
      </header>

      {posts.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: "center",
            color: "rgba(192,192,208,0.55)",
            fontSize: 14,
          }}
        >
          {t("尚無文章", "No posts yet", "記事がまだありません", "아직 게시물이 없습니다")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {posts.map((post) => {
            const title = pickTitle(post, locale);
            const excerpt = pickExcerpt(post, locale);
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{
                  display: "flex",
                  gap: 14,
                  background: "rgba(13,13,43,0.5)",
                  border: "1px solid rgba(212,168,85,0.2)",
                  borderRadius: 14,
                  padding: 16,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {post.heroImageUrl && (
                  <div
                    style={{
                      width: 96,
                      flexShrink: 0,
                      aspectRatio: "1 / 1",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "1px solid rgba(212,168,85,0.2)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.heroImageUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "rgba(212,168,85,0.6)", letterSpacing: 1, marginBottom: 6 }}>
                    {post.publishedAt}
                  </div>
                  <h2
                    style={{
                      fontFamily: "'Noto Serif TC', serif",
                      fontSize: 19,
                      color: "#d4a855",
                      margin: "0 0 6px",
                    }}
                  >
                    {title}
                  </h2>
                  <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    {excerpt}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
