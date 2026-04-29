"use client";

/**
 * LegalDocView — 共用 renderer for /privacy + /terms (and any future legal page).
 *
 * 設計:
 *   - 把 LegalDoc JSON(zh / en / ja / ko 都同 schema)→ 結構化 JSX。
 *   - inline 語法在 paragraph string 裡解:
 *       **xxx**       → <strong>
 *       [text](url)   → 連結;url 開頭 / 走 next/link,其他(http / mailto)走 <a>
 *   - 不依賴外部 markdown 套件 — 占文章兩種 inline 元素就夠用,自己寫小 parser 比拉一個 200KB+ 套件清爽。
 *
 * 為何 client component:
 *   切語系時 useLanguage() 變動 → React state re-render,毋需 router.refresh()。
 *   父頁(app/privacy/page.tsx)把 4 個語系 JSON 都帶進來,這支只挑顯示。
 */

import Link from "next/link";
import type { LegalDoc, SectionBlock } from "@/data/legal/types";

interface Props {
  /** 4 個語系的 LegalDoc;父頁面 import 後傳進來 */
  zh: LegalDoc;
  en: LegalDoc;
  ja: LegalDoc;
  ko: LegalDoc;
  /** 目前 locale */
  locale: "zh" | "en" | "ja" | "ko";
  /** zh-CN 簡體轉換 helper(對 zh 內容過 opencc-js;ja/ko/en 直接 passthrough) */
  cn: (text: string) => string;
}

// 挑對應語系的 doc;如果該語系是空殼(尚未翻譯)→ fallback
function pickDoc(props: Props): LegalDoc {
  const { locale, zh, en, ja, ko } = props;
  if (locale === "zh") return zh;
  if (locale === "en") return en;
  // ja / ko 若 sections 是空 array → 還沒翻譯,fallback 回 en
  if (locale === "ja") return ja.sections.length > 0 ? ja : en;
  return ko.sections.length > 0 ? ko : en;
}

export default function LegalDocView(props: Props) {
  const doc = pickDoc(props);
  const { locale, cn } = props;
  const transform = (s: string) => (locale === "zh" ? cn(s) : s);

  return (
    <article style={articleStyle}>
      <h1
        className="text-gold-gradient"
        style={{
          fontSize: 28,
          fontFamily: "'Noto Serif TC', serif",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {transform(doc.title)}
      </h1>
      <p
        style={{
          color: "rgba(192,192,208,0.6)",
          fontSize: 13,
          marginBottom: 24,
        }}
      >
        {transform(doc.lastUpdated)}
      </p>

      {doc.sections.map((s, i) => (
        <section key={i} style={sectionStyle}>
          {s.heading && (
            <h2 style={sectionHeadingStyle}>{transform(s.heading)}</h2>
          )}
          {s.blocks.map((b, j) => renderBlock(b, j, transform))}
        </section>
      ))}

      {doc.footerNote && (
        <p style={footerNoteStyle}>{transform(doc.footerNote)}</p>
      )}
    </article>
  );
}

// ──────────────────────────────────────────
// Block renderer
// ──────────────────────────────────────────

function renderBlock(
  block: SectionBlock,
  key: number,
  transform: (s: string) => string
) {
  if (block.type === "list" && Array.isArray(block.content)) {
    return (
      <ul key={key} style={listStyle}>
        {block.content.map((item, idx) => (
          <li key={idx}>{renderInline(transform(item))}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "paragraph" && typeof block.content === "string") {
    // 段落字串可能含 \n — 切多段落
    const paras = transform(block.content).split("\n");
    if (paras.length === 1) {
      return (
        <p key={key} style={paragraphStyle}>
          {renderInline(paras[0])}
        </p>
      );
    }
    return (
      <div key={key}>
        {paras.map((p, i) => (
          <p key={i} style={paragraphStyle}>
            {renderInline(p)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// ──────────────────────────────────────────
// Inline syntax: **bold** + [text](url)
// ──────────────────────────────────────────

interface InlineNode {
  kind: "text" | "bold" | "link";
  text: string;
  url?: string;
}

function parseInline(src: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;
  while (i < src.length) {
    // **bold**
    if (src[i] === "*" && src[i + 1] === "*") {
      const close = src.indexOf("**", i + 2);
      if (close > i + 2) {
        nodes.push({ kind: "bold", text: src.slice(i + 2, close) });
        i = close + 2;
        continue;
      }
    }
    // [text](url)
    if (src[i] === "[") {
      const closeBracket = src.indexOf("]", i + 1);
      if (closeBracket > i + 1 && src[closeBracket + 1] === "(") {
        const closeParen = src.indexOf(")", closeBracket + 2);
        if (closeParen > closeBracket + 1) {
          nodes.push({
            kind: "link",
            text: src.slice(i + 1, closeBracket),
            url: src.slice(closeBracket + 2, closeParen),
          });
          i = closeParen + 1;
          continue;
        }
      }
    }
    // 累積純文字直到下一個特殊符號
    const nextStar = src.indexOf("**", i);
    const nextBracket = src.indexOf("[", i);
    let next = -1;
    if (nextStar >= 0 && nextBracket >= 0) next = Math.min(nextStar, nextBracket);
    else if (nextStar >= 0) next = nextStar;
    else if (nextBracket >= 0) next = nextBracket;
    if (next < 0) {
      nodes.push({ kind: "text", text: src.slice(i) });
      break;
    }
    if (next > i) nodes.push({ kind: "text", text: src.slice(i, next) });
    i = next;
    // 防呆:如果 next 對應到的是無效 ** 或 [...]( 結構,當純字元跳過避免無限迴圈
    if (i === next) {
      const oneChar = src[i];
      const last = nodes[nodes.length - 1];
      if (last && last.kind === "text") last.text += oneChar;
      else nodes.push({ kind: "text", text: oneChar });
      i += 1;
    }
  }
  return nodes;
}

function renderInline(src: string): React.ReactNode {
  const nodes = parseInline(src);
  return nodes.map((n, i) => {
    if (n.kind === "bold") {
      return (
        <strong key={i} style={{ color: "#fff" }}>
          {n.text}
        </strong>
      );
    }
    if (n.kind === "link" && n.url) {
      const url = n.url;
      const isInternal = url.startsWith("/");
      const isMail = url.startsWith("mailto:");
      const linkStyle: React.CSSProperties = {
        color: "#d4a855",
        textDecoration: "underline",
      };
      if (isInternal) {
        return (
          <Link key={i} href={url} style={linkStyle}>
            {n.text}
          </Link>
        );
      }
      return (
        <a
          key={i}
          href={url}
          style={linkStyle}
          {...(isMail
            ? {}
            : { target: "_blank", rel: "noopener noreferrer" })}
        >
          {n.text}
        </a>
      );
    }
    return <span key={i}>{n.text}</span>;
  });
}

// ──────────────────────────────────────────
// Styles
// ──────────────────────────────────────────

const articleStyle: React.CSSProperties = {
  color: "rgba(232,232,240,0.9)",
  fontSize: 14,
  lineHeight: 1.85,
  fontFamily: "'Noto Sans TC', sans-serif",
};

const sectionStyle: React.CSSProperties = { marginBottom: 28 };

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 17,
  fontFamily: "'Noto Serif TC', serif",
  fontWeight: 700,
  color: "#d4a855",
  marginTop: 0,
  marginBottom: 10,
};

const paragraphStyle: React.CSSProperties = {
  margin: "0 0 10px",
};

const listStyle: React.CSSProperties = {
  margin: "8px 0 10px",
  paddingLeft: 22,
  color: "rgba(232,232,240,0.85)",
};

const footerNoteStyle: React.CSSProperties = {
  ...paragraphStyle,
  marginTop: 40,
  padding: 16,
  background: "rgba(212,168,85,0.08)",
  border: "1px solid rgba(212,168,85,0.2)",
  borderRadius: 10,
  fontSize: 13,
};
