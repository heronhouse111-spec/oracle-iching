import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { SPREADS, getSpread } from "@/data/spreads";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return SPREADS.map((s) => ({ slug: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = SPREADS.find((s) => s.id === slug);
  if (!found) return { title: "Spread not found" };

  return {
    title: `${found.nameZh}(${found.nameEn})· 塔羅牌陣解析 | Tarogram`,
    description: `${found.taglineZh} ${found.whenZh.slice(0, 80)}…`,
    alternates: { canonical: `/tarot-spread/${found.id}` },
    openGraph: {
      title: `${found.nameZh} · ${found.nameEn} — Tarogram`,
      description: found.taglineZh,
    },
  };
}

export default async function TarotSpreadSlugPage({ params }: Props) {
  const { slug } = await params;
  const spread = getSpread(slug);
  if (spread.id !== slug) notFound(); // getSpread fallback to first if not found — guard

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
        <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
          <Link href="/tarot-spread" style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}>
            ← 牌陣大全
          </Link>
        </nav>

        <header style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: "rgba(212,168,85,0.7)", marginBottom: 8, letterSpacing: 1 }}>
            塔羅牌陣 · TAROT SPREAD
          </div>
          <h1
            className="text-gold-gradient"
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 32,
              fontWeight: 700,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {spread.nameZh}
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 18, fontStyle: "italic", marginTop: 4 }}>
            {spread.nameEn}
          </p>
          <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.8, marginTop: 16 }}>
            {spread.taglineZh}
          </p>
          <p style={{ color: "rgba(232,232,240,0.65)", fontSize: 14, lineHeight: 1.7, fontStyle: "italic" }}>
            {spread.taglineEn}
          </p>
        </header>

        {/* When to use */}
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 20,
              color: "#d4a855",
              marginBottom: 12,
              borderLeft: "3px solid #d4a855",
              paddingLeft: 12,
            }}
          >
            什麼時候用 · When to use
          </h2>
          <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.8 }}>{spread.whenZh}</p>
          <p
            style={{
              color: "rgba(232,232,240,0.65)",
              fontSize: 14,
              lineHeight: 1.7,
              fontStyle: "italic",
              marginTop: 8,
            }}
          >
            {spread.whenEn}
          </p>
        </section>

        {/* Positions */}
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 20,
              color: "#d4a855",
              marginBottom: 16,
              borderLeft: "3px solid #d4a855",
              paddingLeft: 12,
            }}
          >
            牌位意義 · {spread.cardCount} positions
          </h2>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gridTemplateColumns: spread.cardCount > 6 ? "repeat(auto-fill, minmax(220px, 1fr))" : "1fr",
              gap: 12,
            }}
          >
            {spread.positions.map((p, idx) => (
              <li
                key={p.key}
                style={{
                  background: "rgba(13,13,43,0.5)",
                  border: "1px solid rgba(212,168,85,0.2)",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(212,168,85,0.15)",
                      color: "#d4a855",
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <strong
                    style={{
                      fontSize: 15,
                      color: "#e8e8f0",
                      fontFamily: "'Noto Serif TC', serif",
                    }}
                  >
                    {p.labelZh}
                    <span style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginLeft: 6, fontStyle: "italic" }}>
                      {p.labelEn}
                    </span>
                  </strong>
                </div>
                <p style={{ color: "#c0c0d0", fontSize: 13, lineHeight: 1.6, margin: "0 0 4px 36px" }}>
                  {p.descZh}
                </p>
                <p
                  style={{
                    color: "rgba(192,192,208,0.55)",
                    fontSize: 12,
                    lineHeight: 1.5,
                    margin: "0 0 0 36px",
                    fontStyle: "italic",
                  }}
                >
                  {p.descEn}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section
          style={{
            background: "linear-gradient(135deg, rgba(212,168,85,0.12), rgba(139,92,246,0.08))",
            border: "1px solid rgba(212,168,85,0.4)",
            borderRadius: 14,
            padding: 24,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <h3
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 20,
              color: "#d4a855",
              marginBottom: 10,
            }}
          >
            開始用「{spread.nameZh}」做一次占卜
          </h3>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
            從主流程選擇此牌陣 → 描述你的問題 → AI 解牌
            <br />
            <span style={{ opacity: 0.7 }}>
              Pick this spread in the main flow → describe your question → AI reads
            </span>
          </p>
          <Link
            href={`/?spread=${spread.id}`}
            style={{
              padding: "12px 28px",
              background: "linear-gradient(135deg, #d4a855, #f0d78c)",
              color: "#0a0a1a",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
              display: "inline-block",
            }}
          >
            ✦ 用這個牌陣占卜
          </Link>
        </section>

        {/* Other spreads */}
        <section style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 14, color: "rgba(212,168,85,0.7)", marginBottom: 12 }}>
            其他牌陣 · Other spreads
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SPREADS.filter((s) => s.id !== spread.id).map((s) => (
              <Link
                key={s.id}
                href={`/tarot-spread/${s.id}`}
                style={{
                  padding: "6px 14px",
                  background: "rgba(13,13,43,0.5)",
                  border: "1px solid rgba(212,168,85,0.15)",
                  borderRadius: 100,
                  fontSize: 12,
                  color: "#c0c0d0",
                  textDecoration: "none",
                }}
              >
                {s.nameZh} · {s.nameEn}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
