import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import {
  getBlogPostBySlug,
  getPublishedBlogPosts,
  getAllPublishedSlugs,
} from "@/lib/blog";

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

  return {
    title: `${post.titleZh} · ${post.titleEn} | Tarogram 易問`,
    description: post.excerptZh,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.titleZh,
      description: post.excerptZh,
      type: "article",
      publishedTime: post.publishedAt,
      images: post.heroImageUrl ? [{ url: post.heroImageUrl }] : undefined,
    },
  };
}

/** 把每段渲染成 <p>;若以 "## " 開頭則渲染成 <h2> */
function renderParagraph(p: string, key: string, isEn = false) {
  if (p.startsWith("## ")) {
    return (
      <h2
        key={key}
        style={{
          fontFamily: "'Noto Serif TC', serif",
          fontSize: isEn ? 18 : 20,
          color: "#d4a855",
          margin: "28px 0 12px",
          paddingLeft: 10,
          borderLeft: "3px solid rgba(212,168,85,0.6)",
        }}
      >
        {p.slice(3)}
      </h2>
    );
  }
  // 簡易 inline bold:**xxx**
  const parts = p.split(/\*\*(.+?)\*\*/g);
  return (
    <p
      key={key}
      style={{
        color: isEn ? "rgba(232,232,240,0.78)" : "#e8e8f0",
        fontSize: isEn ? 14 : 15,
        lineHeight: isEn ? 1.7 : 1.85,
        margin: "0 0 14px",
        fontStyle: isEn ? "italic" : "normal",
      }}
    >
      {parts.map((seg, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ color: isEn ? "#fff" : "#fff", fontStyle: "normal" }}>
            {seg}
          </strong>
        ) : (
          <span key={i}>{seg}</span>
        )
      )}
    </p>
  );
}

export default async function BlogSlugPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  // 找上一篇 / 下一篇(以 publishedAt 排序)
  const sorted = await getPublishedBlogPosts();
  const idx = sorted.findIndex((p) => p.slug === post.slug);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <article style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
        <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
          <Link href="/blog" style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}>
            ← 部落格
          </Link>
        </nav>

        {post.heroImageUrl && (
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid rgba(212,168,85,0.25)",
              marginBottom: 24,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.heroImageUrl}
              alt={post.titleZh}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        <header style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "rgba(212,168,85,0.6)", letterSpacing: 1, marginBottom: 6 }}>
            {post.publishedAt}
          </div>
          <h1
            className="text-gold-gradient"
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 30,
              fontWeight: 700,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {post.titleZh}
          </h1>
          <p style={{ color: "rgba(192,192,208,0.7)", fontSize: 17, fontStyle: "italic", marginTop: 6 }}>
            {post.titleEn}
          </p>
        </header>

        {/* 中文內文 */}
        <section style={{ marginBottom: 32 }}>
          {post.bodyZh.map((p, i) => renderParagraph(p, `zh-${i}`, false))}
        </section>

        {/* 英文內文(分隔線下方,完整 SEO) */}
        <hr
          style={{
            border: "none",
            borderTop: "1px solid rgba(212,168,85,0.2)",
            margin: "32px 0",
          }}
        />
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              color: "rgba(212,168,85,0.7)",
              fontSize: 12,
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            ENGLISH
          </div>
          {post.bodyEn.map((p, i) => renderParagraph(p, `en-${i}`, true))}
        </section>

        {/* CTA */}
        <section
          style={{
            background: "rgba(13,13,43,0.6)",
            border: "1px solid rgba(212,168,85,0.3)",
            borderRadius: 14,
            padding: 24,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <h3
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 18,
              color: "#d4a855",
              marginBottom: 10,
            }}
          >
            想試試看?
          </h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/"
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                color: "#0a0a1a",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              ✦ 開始占卜
            </Link>
            <Link
              href="/yes-no"
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "#d4a855",
                border: "1px solid #d4a855",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Yes/No
            </Link>
            <Link
              href="/daily"
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "#d4a855",
                border: "1px solid #d4a855",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              每日一卡
            </Link>
          </div>
        </section>

        {/* prev / next */}
        <nav
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {prev ? (
            <Link
              href={`/blog/${prev.slug}`}
              style={{
                padding: 12,
                background: "rgba(13,13,43,0.5)",
                border: "1px solid rgba(212,168,85,0.15)",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 11, color: "rgba(212,168,85,0.6)" }}>← 上一篇</div>
              <div style={{ fontSize: 13, color: "#e8e8f0", marginTop: 4 }}>{prev.titleZh}</div>
            </Link>
          ) : <div />}
          {next ? (
            <Link
              href={`/blog/${next.slug}`}
              style={{
                padding: 12,
                background: "rgba(13,13,43,0.5)",
                border: "1px solid rgba(212,168,85,0.15)",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: 11, color: "rgba(212,168,85,0.6)" }}>下一篇 →</div>
              <div style={{ fontSize: 13, color: "#e8e8f0", marginTop: 4 }}>{next.titleZh}</div>
            </Link>
          ) : <div />}
        </nav>
      </article>
    </main>
  );
}
