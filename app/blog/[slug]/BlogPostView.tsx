"use client";

/**
 * BlogPostView — /blog/[slug] 詳細頁的 client view。
 *
 * 切語系時 useLanguage() 變動,React 直接 re-render,內文文字立刻換成新語系。
 * 不再雙語並列。如果某語系 ja/ko 翻譯失敗(欄位 null),pickXxx 會 fallback
 * 到 en 再 fallback 到 zh,使用者不會看到空白。
 */

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  pickTitle,
  pickExcerpt,
  pickBody,
  type BlogPost,
} from "@/lib/blog";

interface PrevNext {
  slug: string;
  titleZh: string;
  titleEn: string | null;
  titleJa: string | null;
  titleKo: string | null;
}

interface Props {
  post: BlogPost;
  prev: PrevNext | null;
  next: PrevNext | null;
}

/** 把每段渲染成 <p>;若以 "## " 開頭則渲染成 <h2> */
function renderParagraph(p: string, key: string) {
  if (p.startsWith("## ")) {
    return (
      <h2
        key={key}
        style={{
          fontFamily: "'Noto Serif TC', serif",
          fontSize: 20,
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
        color: "#e8e8f0",
        fontSize: 15,
        lineHeight: 1.85,
        margin: "0 0 14px",
      }}
    >
      {parts.map((seg, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ color: "#fff" }}>
            {seg}
          </strong>
        ) : (
          <span key={i}>{seg}</span>
        )
      )}
    </p>
  );
}

function pickPrevNextTitle(
  pn: PrevNext,
  locale: "zh" | "en" | "ja" | "ko"
): string {
  if (locale === "zh") return pn.titleZh;
  if (locale === "en") return pn.titleEn ?? pn.titleZh;
  if (locale === "ja") return pn.titleJa ?? pn.titleEn ?? pn.titleZh;
  return pn.titleKo ?? pn.titleEn ?? pn.titleZh;
}

export default function BlogPostView({ post, prev, next }: Props) {
  const { t, locale } = useLanguage();

  const title = pickTitle(post, locale);
  const excerpt = pickExcerpt(post, locale);
  const body = pickBody(post, locale);

  return (
    <article style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
      <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
        <Link href="/blog" style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}>
          ← {t("部落格", "Blog", "ブログ", "블로그")}
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
            alt={title}
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
          {title}
        </h1>
        <p style={{ color: "rgba(192,192,208,0.75)", fontSize: 15, marginTop: 10, lineHeight: 1.7 }}>
          {excerpt}
        </p>
      </header>

      <section style={{ marginBottom: 32 }}>
        {body.map((p, i) => renderParagraph(p, `${i}`))}
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
          {t("想試試看?", "Want to try it?", "試してみる?", "직접 해 볼까요?")}
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
            ✦ {t("開始占卜", "Start Reading", "占いを始める", "점 시작하기")}
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
            {t("每日一卡", "Daily Card", "毎日のカード", "오늘의 카드")}
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
            <div style={{ fontSize: 11, color: "rgba(212,168,85,0.6)" }}>
              ← {t("上一篇", "Previous", "前の記事", "이전")}
            </div>
            <div style={{ fontSize: 13, color: "#e8e8f0", marginTop: 4 }}>
              {pickPrevNextTitle(prev, locale)}
            </div>
          </Link>
        ) : (
          <div />
        )}
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
            <div style={{ fontSize: 11, color: "rgba(212,168,85,0.6)" }}>
              {t("下一篇", "Next", "次の記事", "다음")} →
            </div>
            <div style={{ fontSize: 13, color: "#e8e8f0", marginTop: 4 }}>
              {pickPrevNextTitle(next, locale)}
            </div>
          </Link>
        ) : (
          <div />
        )}
      </nav>
    </article>
  );
}
