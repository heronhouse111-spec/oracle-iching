import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { hexagrams, trigramNames } from "@/data/hexagrams";
import { getIchingImages, hexagramImageKey } from "@/lib/ichingImages";

export const metadata: Metadata = {
  title: "易經 64 卦完整介紹 · I Ching Hexagrams Encyclopedia | Tarogram 易問",
  description:
    "易經 64 卦完整解析:卦辭、象辭原文與白話翻譯,搭配卦象圖。從上經乾坤到下經既濟未濟,逐卦深入結構與時機的智慧。",
  alternates: { canonical: "/iching/hexagrams" },
  openGraph: {
    title: "易經 64 卦完整介紹 · Tarogram",
    description:
      "Complete I Ching encyclopedia — judgments, images, and vernacular translations for all 64 hexagrams.",
  },
};

// 上經 1–30(天道、自然、君子立身)、下經 31–64(人事、家國、變化終始)
// 是傳統《周易》分卷:把 64 卦切成兩個 section,跟塔羅大/小阿爾克那分組同概念。
const SECTIONS = [
  {
    titleZh: "上經",
    titleEn: "Upper Canon",
    descZh: "天道與君子立身",
    descEn: "Heaven, nature, and the foundations of the gentleman",
    range: [1, 30] as const,
  },
  {
    titleZh: "下經",
    titleEn: "Lower Canon",
    descZh: "人事與變化終始",
    descEn: "Human affairs, change, and final outcomes",
    range: [31, 64] as const,
  },
];

export default async function IChingHexagramsIndexPage() {
  const images = await getIchingImages();

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
        <header style={{ textAlign: "center", marginBottom: 32 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
          >
            易經 64 卦完整介紹
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 14, marginTop: 8 }}>
            I Ching · 64 Hexagrams · King Wen Sequence
          </p>
          <p
            style={{
              color: "rgba(192,192,208,0.7)",
              fontSize: 13,
              marginTop: 12,
              lineHeight: 1.7,
              maxWidth: 640,
              margin: "12px auto 0",
            }}
          >
            64 卦由八卦兩兩相重而成。每卦皆附原文卦辭、象辭,以及白話翻譯。從乾坤起手,到既濟未濟收尾,層層展開人生與宇宙的結構。
            <br />
            <span style={{ opacity: 0.7 }}>
              The 64 hexagrams emerge from pairs of the 8 trigrams. Each entry includes the
              classical judgment, image, and a plain-Chinese translation.
            </span>
          </p>
        </header>

        {/* 卜卦規則 */}
        <section
          style={{
            background: "rgba(13,13,43,0.55)",
            border: "1px solid rgba(212,168,85,0.25)",
            borderRadius: 14,
            padding: 24,
            marginBottom: 36,
          }}
        >
          <h2
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 20,
              color: "#d4a855",
              marginBottom: 12,
            }}
          >
            如何卜卦 · How to Divine
          </h2>
          <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.85, marginBottom: 10 }}>
            傳統卜卦使用三枚銅錢,連續擲六次,自下而上得六爻成卦。每次三枚錢的正反組合決定爻是
            <strong style={{ color: "#fde68a" }}> 老陰、少陰、少陽、老陽 </strong>
            其中之一,老陰 / 老陽即為「變爻」,會由「本卦」變化出「之卦」。
          </p>
          <p
            style={{
              color: "rgba(232,232,240,0.7)",
              fontSize: 13,
              lineHeight: 1.7,
              fontStyle: "italic",
            }}
          >
            Toss three coins six times; the bottom toss is line one, the top toss is line six.
            The yin/yang result of each toss determines whether a line is changing — changing
            lines transform the primary hexagram into a relating hexagram, revealing direction
            of change.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <Link
              href="/"
              style={{
                padding: "8px 18px",
                background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                color: "#0a0a1a",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              ✦ 直接開始易經占卜
            </Link>
            <Link
              href="/yes-no"
              style={{
                padding: "8px 18px",
                background: "transparent",
                color: "#d4a855",
                border: "1px solid #d4a855",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13,
              }}
            >
              Yes/No 速答
            </Link>
          </div>
        </section>

        {/* 八卦對照 — 上下八個三爻卦組成 64 卦,先給使用者建一個 mental model */}
        <section style={{ marginBottom: 36 }}>
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
            八卦速覽 · The Eight Trigrams
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
              gap: 10,
            }}
          >
            {Object.entries(trigramNames).map(([code, t]) => (
              <div
                key={code}
                style={{
                  padding: 12,
                  background: "rgba(13,13,43,0.5)",
                  border: "1px solid rgba(212,168,85,0.18)",
                  borderRadius: 10,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 28, color: "#d4a855", lineHeight: 1 }}>{t.symbol}</div>
                <div style={{ fontSize: 13, color: "#e8e8f0", marginTop: 6, fontWeight: 600 }}>
                  {t.zh}
                </div>
                <div style={{ fontSize: 11, color: "rgba(192,192,208,0.55)", marginTop: 2 }}>
                  {t.en}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 上經 / 下經 兩個 section */}
        {SECTIONS.map((sec) => {
          const items = hexagrams.filter(
            (h) => h.number >= sec.range[0] && h.number <= sec.range[1]
          );
          return (
            <section key={sec.titleZh} style={{ marginBottom: 48 }}>
              <h2
                style={{
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 22,
                  color: "#d4a855",
                  marginBottom: 6,
                  borderLeft: "3px solid #d4a855",
                  paddingLeft: 12,
                }}
              >
                {sec.titleZh}{" "}
                <span style={{ opacity: 0.6, fontSize: 16 }}>· {sec.titleEn}</span>
                <span style={{ opacity: 0.5, fontSize: 13, marginLeft: 12 }}>
                  ({items.length})
                </span>
              </h2>
              <p
                style={{
                  color: "rgba(192,192,208,0.6)",
                  fontSize: 12,
                  marginLeft: 14,
                  marginBottom: 18,
                  fontStyle: "italic",
                }}
              >
                {sec.descZh} · {sec.descEn}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 14,
                }}
              >
                {items.map((h) => {
                  const url = images[hexagramImageKey(h.number)];
                  return (
                    <Link
                      key={h.number}
                      href={`/iching/hexagrams/${h.number}`}
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
                          width: "100%",
                          aspectRatio: "1 / 1",
                          borderRadius: 8,
                          overflow: "hidden",
                          marginBottom: 8,
                          border: "1px solid rgba(212,168,85,0.2)",
                          background:
                            "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(13,13,43,0.5))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={`${h.nameZh} · ${h.nameEn}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          // 沒上傳就顯示卦象 Unicode 字元 — 不會空白,也不會誤導
                          <span
                            style={{
                              fontSize: 52,
                              color: "rgba(212,168,85,0.85)",
                              lineHeight: 1,
                            }}
                          >
                            {h.character}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "rgba(212,168,85,0.7)" }}>
                          第 {h.number} 卦
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            color: "#e8e8f0",
                            fontWeight: 600,
                            fontFamily: "'Noto Serif TC', serif",
                            marginTop: 2,
                          }}
                        >
                          {h.nameZh}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(192,192,208,0.55)",
                            marginTop: 2,
                            lineHeight: 1.3,
                          }}
                        >
                          {h.nameEn.split(" ")[0]}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
