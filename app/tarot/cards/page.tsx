import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { tarotDeck, SUIT_NAMES_ZH, SUIT_NAMES_EN } from "@/data/tarot";
import Header from "@/components/Header";
import { getServerT, getServerLocale } from "@/lib/serverLocale";

// Metadata 仍走中文版本(canonical 主語);搜尋結果頁面標題 SEO 用一份就好
export const metadata: Metadata = {
  title: "78 張塔羅牌牌意百科 · Tarot Cards Encyclopedia | Tarogram",
  description:
    "Rider-Waite-Smith 78 張塔羅牌完整牌意,正逆位、關鍵字、適用情境。Complete Rider-Waite-Smith tarot card meanings, upright & reversed.",
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

export default async function TarotCardsIndexPage() {
  const t = await getServerT();
  const { locale } = await getServerLocale();
  const isZh = locale === "zh";
  const suitName = (s: typeof SUIT_ORDER[number]) =>
    isZh ? SUIT_NAMES_ZH[s] : SUIT_NAMES_EN[s];

  const grouped = SUIT_ORDER.map((suit) => ({
    suit,
    name: suitName(suit),
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
            {t(
              "78 張塔羅牌牌意百科",
              "78 Tarot Cards Encyclopedia",
              "78枚タロットカード百科",
              "78장 타로 카드 백과"
            )}
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 14, marginTop: 8 }}>
            {t(
              "Rider-Waite-Smith 完整牌組",
              "Rider-Waite-Smith complete deck",
              "ライダー・ウェイト版 完全版",
              "라이더-웨이트 전체 덱"
            )}
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
            {t(
              "22 張大阿爾克那(精神象徵)+ 56 張小阿爾克那(日常面向)。每張牌都附上正逆位牌義、關鍵字、與適用情境。",
              "22 Major Arcana (spiritual archetypes) + 56 Minor Arcana (daily aspects). Each with upright/reversed meanings, keywords, and contexts.",
              "22枚の大アルカナ(精神的アーキタイプ)+ 56枚の小アルカナ(日常的側面)。各カードに正位置・逆位置の意味、キーワード、適用シーンを掲載。",
              "메이저 아르카나 22장(정신적 원형)+ 마이너 아르카나 56장(일상의 면). 각 카드마다 정·역방향 의미, 키워드, 적용 상황 포함."
            )}
          </p>
        </header>

        {grouped.map(({ suit, name, cards }) => (
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
              {name}
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
                      alt={isZh ? card.nameZh : card.nameEn}
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
                    <div style={{ fontWeight: 600 }}>
                      {isZh ? card.nameZh : card.nameEn}
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
            {t(
              "想真正用這些牌做一次占卜?",
              "Ready to use these cards in a real reading?",
              "実際にこのカードで占ってみませんか?",
              "이 카드로 실제 점을 쳐볼까요?"
            )}
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
              {t("Yes/No 速答", "Yes/No Quick", "Yes/No 即答", "Yes/No 즉답")}
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
              {t("每日一卡", "Daily Card", "今日の一枚", "오늘의 카드")}
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
