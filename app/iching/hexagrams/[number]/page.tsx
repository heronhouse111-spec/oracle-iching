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
// 自下而上 6 條,陽爻一整條,陰爻中間斷開。
function HexagramLines({ lines, size = "md" }: { lines: number[]; size?: "sm" | "md" | "lg" }) {
  const dim =
    size === "lg"
      ? { w: 160, h: 13, gap: 13, gapInner: 16 }
      : size === "md"
        ? { w: 120, h: 10, gap: 10, gapInner: 12 }
        : { w: 80, h: 7, gap: 7, gapInner: 9 };
  // lines[0] 是最下爻,渲染時要倒過來,最上爻畫在最上面
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

  // 上下相鄰卦(在底部給個「下一卦」的瀏覽錨點)
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
            ← 64 卦完整介紹
          </Link>
        </nav>

        {/* Hero — 圖在左、卦象 + 名稱在右 */}
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
                alt={`${hex.nameZh} · ${hex.nameEn}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              // 圖還沒上傳就用大字卦象 + 卦線占位,版面不空、也不誤導
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
              第 {hex.number} 卦 · Hexagram {hex.number}
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
              {hex.nameZh}
            </h1>
            <p style={{ color: "#c0c0d0", fontSize: 18, fontStyle: "italic", marginTop: 4 }}>
              {hex.nameEn}
            </p>

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
                  上 {upper?.zh}
                </span>
              </div>
              <span style={{ color: "rgba(212,168,85,0.4)" }}>／</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24, color: "#d4a855", lineHeight: 1 }}>
                  {lower?.symbol}
                </span>
                <span style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}>
                  下 {lower?.zh}
                </span>
              </div>
            </div>

            {/* 卦象大字 + 卦線(若 hero 是圖,這邊保留卦象資訊) */}
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

        {/* 卦辭 — 原文 + 白話 */}
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
            卦辭 · Judgment
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
              原文
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
              {hex.judgmentZh}
            </p>
          </div>
          <div
            style={{
              background: "rgba(13,13,43,0.4)",
              border: "1px solid rgba(212,168,85,0.12)",
              borderRadius: 10,
              padding: 18,
              marginBottom: 8,
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
              白話翻譯
            </div>
            <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.85, margin: 0 }}>
              {hex.judgmentVernacularZh}
            </p>
          </div>
          <p
            style={{
              color: "rgba(232,232,240,0.6)",
              fontSize: 13,
              lineHeight: 1.7,
              fontStyle: "italic",
              marginTop: 10,
            }}
          >
            EN · {hex.judgmentEn}
          </p>
        </section>

        {/* 象辭 — 原文 + 白話 */}
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
            象辭 · Image
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
              原文
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
              {hex.imageZh}
            </p>
          </div>
          <div
            style={{
              background: "rgba(13,13,43,0.4)",
              border: "1px solid rgba(212,168,85,0.12)",
              borderRadius: 10,
              padding: 18,
              marginBottom: 8,
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
              白話翻譯
            </div>
            <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.85, margin: 0 }}>
              {hex.imageVernacularZh}
            </p>
          </div>
          <p
            style={{
              color: "rgba(232,232,240,0.6)",
              fontSize: 13,
              lineHeight: 1.7,
              fontStyle: "italic",
              marginTop: 10,
            }}
          >
            EN · {hex.imageEn}
          </p>
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
            想看「這一卦」對你的問題說了什麼?
          </h3>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
            卦辭是地圖,真正的占卜要把卦放進你的問題裡才會有意義。
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
            ✦ 開始易經占卜
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
              <div style={{ fontSize: 11, opacity: 0.6 }}>← 上一卦</div>
              <div style={{ fontFamily: "'Noto Serif TC', serif" }}>
                第 {prev.number} 卦 {prev.nameZh}
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
              <div style={{ fontSize: 11, opacity: 0.6 }}>下一卦 →</div>
              <div style={{ fontFamily: "'Noto Serif TC', serif" }}>
                第 {next.number} 卦 {next.nameZh}
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
