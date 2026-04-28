import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import {
  hexagrams,
  getHexagramByNumber,
  trigramNames,
  type Hexagram,
} from "@/data/hexagrams";
import { getIchingImages, hexagramImageKey } from "@/lib/ichingImages";
import { getServerLocale, getServerT } from "@/lib/serverLocale";

interface Props {
  params: Promise<{ number: string }>;
}

export async function generateStaticParams() {
  return hexagrams.map((h) => ({ number: String(h.number) }));
}

function parseNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 64) return null;
  return n;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params;
  const num = parseNumber(number);
  if (!num) return { title: "Hexagram not found" };
  const h = getHexagramByNumber(num);
  if (!h) return { title: "Hexagram not found" };
  return {
    title: `第 ${h.number} 卦 ${h.nameZh}（${h.nameEn}）· 卦辭白話 | Tarogram`,
    description: `${h.judgmentZh} ${h.judgmentVernacularZh.slice(0, 80)}…`,
    alternates: { canonical: `/iching/hexagrams/${h.number}` },
    openGraph: {
      title: `第 ${h.number} 卦 ${h.nameZh} · ${h.nameEn}`,
      description: h.judgmentVernacularZh.slice(0, 140),
    },
  };
}

// 純 SVG 風格卦線渲染 — 不依賴 framer-motion / client component。
function HexagramLines({ lines, size = "md" }: { lines: number[]; size?: "sm" | "md" | "lg" }) {
  const dim =
    size === "lg"
      ? { w: 160, h: 13, gap: 13, gapInner: 16 }
      : size === "md"
        ? { w: 120, h: 10, gap: 10, gapInner: 12 }
        : { w: 80, h: 7, gap: 7, gapInner: 9 };
  const display = [...lines].reverse();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: dim.gap,
        alignItems: "center",
      }}
    >
      {display.map((line, idx) => (
        <div key={idx} style={{ width: dim.w }}>
          {line === 1 ? (
            <div
              style={{
                width: "100%",
                height: dim.h,
                borderRadius: 2,
                background: "#d4a855",
              }}
            />
          ) : (
            <div style={{ display: "flex", gap: dim.gapInner, width: "100%" }}>
              <div style={{ flex: 1, height: dim.h, borderRadius: 2, background: "#d4a855" }} />
              <div style={{ flex: 1, height: dim.h, borderRadius: 2, background: "#d4a855" }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function IChingHexagramDetailPage({ params }: Props) {
  const { number } = await params;
  const num = parseNumber(number);
  if (!num) notFound();
  const h = getHexagramByNumber(num);
  if (!h) notFound();
  const hex = h as Hexagram;

  const images = await getIchingImages();
  const heroUrl = images[hexagramImageKey(hex.number)];
  const upper = trigramNames[hex.upperTrigram];
  const lower = trigramNames[hex.lowerTrigram];
  const t = await getServerT();
  const { locale } = await getServerLocale();
  const isZh = locale === "zh";

  const hName = isZh ? hex.nameZh : hex.nameEn;
  // 卦辭/象辭非中文使用者:原文當「古文」字段(資產),白話用英譯填(資料就是英譯,沒有對應日韓)。
  // 這個頁面對非中文使用者實質上仍是 ZH-classical + EN-modern,因為原典無法翻譯成日韓,
  // 但至少不會強制顯示中英對照。
  const judgmentClassical = hex.judgmentZh; // 原文不翻譯,維持古文字一致
  const judgmentTranslated = isZh ? hex.judgmentVernacularZh : hex.judgmentEn;
  const imageClassical = hex.imageZh;
  const imageTranslated = isZh ? hex.imageVernacularZh : hex.imageEn;
  const upperName = upper ? (isZh ? upper.zh : upper.en) : "";
  const lowerName = lower ? (isZh ? lower.zh : lower.en) : "";

  const prev = hex.number > 1 ? getHexagramByNumber(hex.number - 1) : null;
  const next = hex.number < 64 ? getHexagramByNumber(hex.number + 1) : null;

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
        <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
          <Link
            href="/iching/hexagrams"
            style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}
          >
            ← {t("64 卦完整介紹", "All 64 Hexagrams", "64卦 完全解説", "64괘 백과")}
          </Link>
        </nav>

        {/* Hero */}
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
              boxShadow: "0 8px 32px rgba(212,168,85,0.18)",
              background: "rgba(13,13,43,0.6)",
              aspectRatio: "1 / 1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={heroUrl}
                alt={hName}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{ textAlign: "center", padding: 16 }}>
                <div
                  style={{
                    fontSize: 96,
                    color: "rgba(212,168,85,0.85)",
                    lineHeight: 1,
                    marginBottom: 12,
                  }}
                >
                  {hex.character}
                </div>
                <HexagramLines lines={hex.lines} size="sm" />
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, color: "rgba(212,168,85,0.7)", marginBottom: 6 }}>
              {t(
                `第 ${hex.number} 卦`,
                `Hexagram ${hex.number}`,
                `第 ${hex.number} 卦`,
                `제 ${hex.number} 괘`
              )}
            </div>
            <h1
              className="text-gold-gradient"
              style={{
                fontFamily: "'Noto Serif TC', serif",
                fontSize: 32,
                fontWeight: 700,
                margin: 0,
              }}
            >
              {hName}
            </h1>

            {/* 上下卦組成 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24, color: "#d4a855", lineHeight: 1 }}>
                  {upper?.symbol}
                </span>
                <span style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}>
                  {t(`上 ${upperName}`, `Upper · ${upperName}`, `上 ${upperName}`, `상 ${upperName}`)}
                </span>
              </div>
              <span style={{ color: "rgba(212,168,85,0.4)" }}>／</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24, color: "#d4a855", lineHeight: 1 }}>
                  {lower?.symbol}
                </span>
                <span style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}>
                  {t(`下 ${lowerName}`, `Lower · ${lowerName}`, `下 ${lowerName}`, `하 ${lowerName}`)}
                </span>
              </div>
            </div>

            {heroUrl && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1px dashed rgba(212,168,85,0.2)",
                }}
              >
                <span style={{ fontSize: 36, color: "rgba(212,168,85,0.85)", lineHeight: 1 }}>
                  {hex.character}
                </span>
                <HexagramLines lines={hex.lines} size="sm" />
              </div>
            )}
          </div>
        </header>

        {/* 卦辭 — 原文 + 翻譯 */}
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 22,
              color: "#d4a855",
              marginBottom: 12,
              borderLeft: "3px solid #d4a855",
              paddingLeft: 12,
            }}
          >
            {t("卦辭", "Judgment", "卦辞", "괘사")}
          </h2>
          <div
            style={{
              background: "rgba(13,13,43,0.55)",
              border: "1px solid rgba(212,168,85,0.2)",
              borderRadius: 10,
              padding: 18,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(212,168,85,0.7)",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              {t("原文", "Classical Text", "原文", "원문")}
            </div>
            <p
              style={{
                color: "#fde68a",
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "'Noto Serif TC', serif",
                lineHeight: 1.85,
                margin: 0,
              }}
            >
              {judgmentClassical}
            </p>
          </div>
          <div
            style={{
              background: "rgba(13,13,43,0.4)",
              border: "1px solid rgba(212,168,85,0.12)",
              borderRadius: 10,
              padding: 18,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(212,168,85,0.7)",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              {t("白話翻譯", "Plain-Language Translation", "現代訳", "현대 번역")}
            </div>
            <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.85, margin: 0 }}>
              {judgmentTranslated}
            </p>
          </div>
        </section>

        {/* 象辭 — 原文 + 翻譯 */}
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 22,
              color: "#d4a855",
              marginBottom: 12,
              borderLeft: "3px solid #d4a855",
              paddingLeft: 12,
            }}
          >
            {t("象辭", "Image", "象辞", "상사")}
          </h2>
          <div
            style={{
              background: "rgba(13,13,43,0.55)",
              border: "1px solid rgba(212,168,85,0.2)",
              borderRadius: 10,
              padding: 18,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(212,168,85,0.7)",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              {t("原文", "Classical Text", "原文", "원문")}
            </div>
            <p
              style={{
                color: "#fde68a",
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "'Noto Serif TC', serif",
                lineHeight: 1.85,
                margin: 0,
              }}
            >
              {imageClassical}
            </p>
          </div>
          <div
            style={{
              background: "rgba(13,13,43,0.4)",
              border: "1px solid rgba(212,168,85,0.12)",
              borderRadius: 10,
              padding: 18,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(212,168,85,0.7)",
                letterSpacing: 1,
                marginBottom: 6,
              }}
            >
              {t("白話翻譯", "Plain-Language Translation", "現代訳", "현대 번역")}
            </div>
            <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.85, margin: 0 }}>
              {imageTranslated}
            </p>
          </div>
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
              fontSize: 18,
              color: "#d4a855",
              marginBottom: 10,
            }}
          >
            {t(
              "想看「這一卦」對你的問題說了什麼?",
              "Want to know what this hexagram says about your question?",
              "この卦があなたの質問に何を語るか見てみませんか?",
              "이 괘가 당신의 질문에 무엇을 말하는지 보고 싶나요?"
            )}
          </h3>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
            {t(
              "卦辭是地圖,真正的占卜要把卦放進你的問題裡才會有意義。",
              "Hexagram texts are maps. A real reading happens when the hexagram meets your question.",
              "卦辞は地図です。真の占いは、卦があなたの質問と出会ったときに起こります。",
              "괘사는 지도입니다. 진정한 점은 괘가 당신의 질문과 만날 때 일어납니다."
            )}
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
            }}
          >
            ✦ {t("開始易經占卜", "Start I Ching Reading", "易経占いを始める", "주역 점 시작")}
          </Link>
        </section>

        {/* 上一卦 / 下一卦 */}
        <nav
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            paddingTop: 14,
            borderTop: "1px dashed rgba(212,168,85,0.2)",
          }}
        >
          {prev ? (
            <Link
              href={`/iching/hexagrams/${prev.number}`}
              style={{
                color: "#d4a855",
                fontSize: 13,
                textDecoration: "none",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                ← {t("上一卦", "Previous", "前の卦", "이전 괘")}
              </div>
              <div style={{ fontFamily: "'Noto Serif TC', serif" }}>
                {t(
                  `第 ${prev.number} 卦 ${prev.nameZh}`,
                  `${prev.number}. ${prev.nameEn.split(" ")[0]}`,
                  `第 ${prev.number} 卦 ${prev.nameZh}`,
                  `${prev.number}. ${prev.nameEn.split(" ")[0]}`
                )}
              </div>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/iching/hexagrams/${next.number}`}
              style={{
                color: "#d4a855",
                fontSize: 13,
                textDecoration: "none",
                textAlign: "right",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                {t("下一卦", "Next", "次の卦", "다음 괘")} →
              </div>
              <div style={{ fontFamily: "'Noto Serif TC', serif" }}>
                {t(
                  `第 ${next.number} 卦 ${next.nameZh}`,
                  `${next.number}. ${next.nameEn.split(" ")[0]}`,
                  `第 ${next.number} 卦 ${next.nameZh}`,
                  `${next.number}. ${next.nameEn.split(" ")[0]}`
                )}
              </div>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </main>
  );
}
