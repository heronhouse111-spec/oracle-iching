import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { SPREADS } from "@/data/spreads";

export const metadata: Metadata = {
  title: "塔羅牌陣大全 · Tarot Spreads | Tarogram 易問",
  description:
    "從三牌時間軸到凱爾特十字,五大經典塔羅牌陣完整解析:適合的問題、位置意義、實際操作。Five classic tarot spreads explained — when to use, position meanings, how-to.",
  alternates: { canonical: "/tarot-spread" },
  openGraph: {
    title: "塔羅牌陣大全 · Tarot Spreads",
    description: "Five classic tarot spreads — three-card, two-options, love cross, Celtic cross, yearly 12.",
  },
};

export default function TarotSpreadIndexPage() {
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
        <header style={{ textAlign: "center", marginBottom: 32 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
          >
            塔羅牌陣大全
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 14, marginTop: 8, fontStyle: "italic" }}>
            Tarot Spreads — when to use which
          </p>
          <p
            style={{
              color: "rgba(192,192,208,0.7)",
              fontSize: 13,
              marginTop: 16,
              lineHeight: 1.7,
              maxWidth: 560,
              margin: "16px auto 0",
            }}
          >
            不同問題適合不同牌陣 — 三牌看脈絡、二選一做決策、愛情十字看關係、凱爾特十字解大命題、年度十二宮看一年。
            <br />
            <span style={{ opacity: 0.7 }}>
              Different questions call for different spreads. Three-card for narrative, two-options for decisions, love cross for relationships, Celtic cross for big matters, yearly 12 for the year ahead.
            </span>
          </p>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {SPREADS.map((s) => (
            <Link
              key={s.id}
              href={`/tarot-spread/${s.id}`}
              style={{
                display: "block",
                background: "rgba(13,13,43,0.5)",
                border: "1px solid rgba(212,168,85,0.2)",
                borderRadius: 14,
                padding: 20,
                textDecoration: "none",
                color: "inherit",
                transition: "transform 0.2s, border-color 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <h2
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: 20,
                    color: "#d4a855",
                    margin: 0,
                  }}
                >
                  {s.nameZh}
                  <span style={{ color: "rgba(192,192,208,0.6)", fontSize: 14, marginLeft: 8, fontStyle: "italic" }}>
                    {s.nameEn}
                  </span>
                </h2>
                <span style={{ color: "rgba(212,168,85,0.7)", fontSize: 12 }}>
                  {s.cardCount} 張 · {s.cardCount} cards
                </span>
              </div>
              <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.7, marginBottom: 6 }}>
                {s.taglineZh}
              </p>
              <p style={{ color: "rgba(232,232,240,0.6)", fontSize: 13, fontStyle: "italic", margin: 0 }}>
                {s.taglineEn}
              </p>
            </Link>
          ))}
        </div>

        <footer
          style={{
            marginTop: 40,
            padding: "20px 16px",
            textAlign: "center",
            background: "rgba(13,13,43,0.5)",
            borderRadius: 12,
            border: "1px solid rgba(212,168,85,0.2)",
          }}
        >
          <p style={{ color: "#c0c0d0", fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
            想直接開始?從主流程選擇牌陣 →
            <br />
            <span style={{ opacity: 0.7 }}>Ready to draw? Pick a spread in the main flow →</span>
          </p>
          <Link
            href="/"
            style={{
              padding: "10px 24px",
              background: "linear-gradient(135deg, #d4a855, #f0d78c)",
              color: "#0a0a1a",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
              display: "inline-block",
            }}
          >
            ✦ 開始占卜
          </Link>
        </footer>
      </div>
    </main>
  );
}
