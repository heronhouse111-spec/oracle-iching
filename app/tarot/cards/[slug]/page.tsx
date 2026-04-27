import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  tarotDeck,
  getCardById,
  SUIT_NAMES_ZH,
  SUIT_NAMES_EN,
} from "@/data/tarot";
import Header from "@/components/Header";

interface Props {
  params: Promise<{ slug: string }>; // Next 16: params is async
}

export async function generateStaticParams() {
  return tarotDeck.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = getCardById(slug);
  if (!card) return { title: "Card not found" };

  const title = `${card.nameZh}(${card.nameEn})牌意 · ${SUIT_NAMES_ZH[card.suit]}`;
  const description = `${card.nameZh}(${card.nameEn})正逆位牌意、關鍵字、適用情境完整解析。${card.uprightMeaningZh.slice(0, 80)}…`;

  return {
    title: `${title} | Tarogram 易問`,
    description,
    alternates: { canonical: `/tarot/cards/${card.id}` },
    openGraph: {
      title: `${card.nameZh} · ${card.nameEn} — Tarogram`,
      description,
      images: [{ url: card.imagePath }],
    },
  };
}

export default async function TarotCardSlugPage({ params }: Props) {
  const { slug } = await params;
  const card = getCardById(slug);
  if (!card) notFound();

  // 同花色其他牌(底部相關推薦)
  const sameSuit = tarotDeck
    .filter((c) => c.suit === card.suit && c.id !== card.id)
    .slice(0, 6);

  const orientationLabel = (rev: boolean) => ({
    titleZh: rev ? "逆位" : "正位",
    titleEn: rev ? "Reversed" : "Upright",
  });

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
        <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
          <Link href="/tarot/cards" style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}>
            ← 78 張牌意百科
          </Link>
        </nav>

        <header
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, 240px) 1fr",
            gap: 24,
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid rgba(212,168,85,0.4)",
              boxShadow: "0 8px 32px rgba(212,168,85,0.2)",
            }}
          >
            <Image
              src={card.imagePath}
              alt={`${card.nameZh} · ${card.nameEn}`}
              width={400}
              height={620}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "rgba(212,168,85,0.7)", marginBottom: 6 }}>
              {SUIT_NAMES_ZH[card.suit]} · {SUIT_NAMES_EN[card.suit]}
              {card.suit !== "major" && ` · ${card.number}`}
              {card.suit === "major" && ` · ${card.number}`}
            </div>
            <h1
              className="text-gold-gradient"
              style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
            >
              {card.nameZh}
            </h1>
            <p style={{ color: "#c0c0d0", fontSize: 18, fontStyle: "italic", marginTop: 4 }}>
              {card.nameEn}
            </p>
          </div>
        </header>

        {/* Upright */}
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 22,
              color: "#d4a855",
              marginBottom: 12,
              borderLeft: "3px solid #4ade80",
              paddingLeft: 12,
            }}
          >
            正位 · Upright
          </h2>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: "#e8e8f0", fontSize: 13 }}>關鍵字 / Keywords:</strong>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {card.keywordsUprightZh.map((k, i) => (
                <span
                  key={`zh-${i}`}
                  style={{
                    background: "rgba(74,222,128,0.12)",
                    color: "#86efac",
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 100,
                  }}
                >
                  {k}
                </span>
              ))}
              {card.keywordsUprightEn.map((k, i) => (
                <span
                  key={`en-${i}`}
                  style={{
                    background: "rgba(74,222,128,0.06)",
                    color: "rgba(134,239,172,0.7)",
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 100,
                  }}
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
          <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.8 }}>
            {card.uprightMeaningZh}
          </p>
          <p
            style={{
              color: "rgba(232,232,240,0.7)",
              fontSize: 14,
              lineHeight: 1.7,
              fontStyle: "italic",
              marginTop: 8,
            }}
          >
            {card.uprightMeaningEn}
          </p>
        </section>

        {/* Reversed */}
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 22,
              color: "#d4a855",
              marginBottom: 12,
              borderLeft: "3px solid #f87171",
              paddingLeft: 12,
            }}
          >
            逆位 · Reversed
          </h2>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: "#e8e8f0", fontSize: 13 }}>關鍵字 / Keywords:</strong>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {card.keywordsReversedZh.map((k, i) => (
                <span
                  key={`zh-${i}`}
                  style={{
                    background: "rgba(248,113,113,0.12)",
                    color: "#fca5a5",
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 100,
                  }}
                >
                  {k}
                </span>
              ))}
              {card.keywordsReversedEn.map((k, i) => (
                <span
                  key={`en-${i}`}
                  style={{
                    background: "rgba(248,113,113,0.06)",
                    color: "rgba(252,165,165,0.7)",
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 100,
                  }}
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
          <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.8 }}>
            {card.reversedMeaningZh}
          </p>
          <p
            style={{
              color: "rgba(232,232,240,0.7)",
              fontSize: 14,
              lineHeight: 1.7,
              fontStyle: "italic",
              marginTop: 8,
            }}
          >
            {card.reversedMeaningEn}
          </p>
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
            想看「這張牌」對你的問題說了什麼?
          </h3>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
            牌意是地圖,真正的占卜要把牌放進你的問題裡才會有意義。
            <br />
            <span style={{ opacity: 0.7 }}>
              Card meanings are maps. A real reading happens when the card meets your question.
            </span>
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
              ✦ 三牌占卜
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
              Yes/No 占卜
            </Link>
          </div>
        </section>

        {/* Same suit */}
        {sameSuit.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h3
              style={{
                fontSize: 14,
                color: "rgba(212,168,85,0.7)",
                marginBottom: 12,
                fontFamily: "'Noto Serif TC', serif",
              }}
            >
              同花色其他牌 · More from {SUIT_NAMES_EN[card.suit]}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                gap: 12,
              }}
            >
              {sameSuit.map((c) => (
                <Link
                  key={c.id}
                  href={`/tarot/cards/${c.id}`}
                  style={{
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      borderRadius: 6,
                      overflow: "hidden",
                      aspectRatio: "9 / 14",
                      marginBottom: 4,
                      border: "1px solid rgba(212,168,85,0.15)",
                    }}
                  >
                    <Image
                      src={c.imagePath}
                      alt={`${c.nameZh} · ${c.nameEn}`}
                      width={200}
                      height={310}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "#c0c0d0", textAlign: "center" }}>
                    {c.nameZh}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
