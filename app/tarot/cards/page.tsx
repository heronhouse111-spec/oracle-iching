import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { tarotDeck, SUIT_NAMES_ZH, SUIT_NAMES_EN } from "@/data/tarot";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "78 張塔羅牌牌意百科 · Tarot Cards Encyclopedia | Tarogram",
  description:
    "Rider-Waite-Smith 78 張塔羅牌完整牌意,正逆位、關鍵字、適用情境。中英雙語對照。Complete Rider-Waite-Smith tarot card meanings, upright & reversed, keywords, contexts. Bilingual.",
  alternates: { canonical: "/tarot/cards" },
  openGraph: {
    title: "78 張塔羅牌牌意百科 · Tarot Cards Encyclopedia",
    description:
      "Complete tarot card meanings — Major Arcana 22, Minor Arcana 56. Upright & reversed.",
  },
};

const SUIT_ORDER: Array<"major" | "wands" | "cups" | "swords" | "pentacles"> = [
  "major", "wands", "cups", "swords", "pentacles",
];

export default function TarotCardsIndexPage() {
  const grouped = SUIT_ORDER.map((suit) => ({
    suit,
    nameZh: SUIT_NAMES_ZH[suit],
    nameEn: SUIT_NAMES_EN[suit],
    cards: tarotDeck.filter((c) => c.suit === suit).sort((a, b) => a.number - b.number),
  }));

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
        <header style={{ textAlign: "center", marginBottom: 32 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
          >
            78 張塔羅牌牌意百科
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 14, marginTop: 8 }}>
            Tarot Cards Encyclopedia · Rider-Waite-Smith
          </p>
          <p style={{ color: "rgba(192,192,208,0.7)", fontSize: 13, marginTop: 12, lineHeight: 1.7, maxWidth: 640, margin: "12px auto 0" }}>
            22 張大阿爾克那(精神象徵)+ 56 張小阿爾克那(日常面向)。每張牌都附上正逆位牌義、關鍵字、與適用情境。
            <br />
            <span style={{ opacity: 0.7 }}>
              22 Major Arcana (spiritual archetypes) + 56 Minor Arcana (daily aspects). Each with upright/reversed meanings, keywords, and contexts.
            </span>
          </p>
        </header>

        {grouped.map(({ suit, nameZh, nameEn, cards }) => (
          <section key={suit} style={{ marginBottom: 48 }}>
            <h2
              style={{
                fontFamily: "'Noto Serif TC', serif",
                fontSize: 22,
                color: "#d4a855",
                marginBottom: 16,
                borderLeft: "3px solid #d4a855",
                paddingLeft: 12,
              }}
            >
              {nameZh} <span style={{ opacity: 0.6, fontSize: 16 }}>· {nameEn}</span>
              <span style={{ opacity: 0.5, fontSize: 13, marginLeft: 12 }}>
                ({cards.length})
              </span>
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 16,
              }}
            >
              {cards.map((card) => (
                <Link
                  key={card.id}
                  href={`/tarot/cards/${card.id}`}
                  style={{
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                    background: "rgba(13,13,43,0.5)",
                    border: "1px solid rgba(212,168,85,0.15)",
                    borderRadius: 10,
                    padding: 8,
                    transition: "transform 0.2s, border-color 0.2s",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 6,
                      overflow: "hidden",
                      aspectRatio: "9 / 14",
                      marginBottom: 6,
                      border: "1px solid rgba(212,168,85,0.2)",
                    }}
                  >
                    <Image
                      src={card.imagePath}
                      alt={`${card.nameZh} · ${card.nameEn}`}
                      width={300}
                      height={467}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#e8e8f0",
                      lineHeight: 1.4,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{card.nameZh}</div>
                    <div style={{ color: "rgba(192,192,208,0.6)", fontSize: 10, marginTop: 2 }}>
                      {card.nameEn}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <footer
          style={{
            marginTop: 48,
            padding: "20px 16px",
            textAlign: "center",
            background: "rgba(13,13,43,0.5)",
            borderRadius: 12,
            border: "1px solid rgba(212,168,85,0.2)",
          }}
        >
          <p style={{ color: "#e8e8f0", fontSize: 14, marginBottom: 12, lineHeight: 1.7 }}>
            想真正用這些牌做一次占卜?
            <br />
            <span style={{ opacity: 0.7 }}>Ready to use these cards in a real reading?</span>
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
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
              ✦ 開始占卜 / Start Reading
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
              Yes/No 快速占卜
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
        </footer>
      </div>
    </main>
  );
}
