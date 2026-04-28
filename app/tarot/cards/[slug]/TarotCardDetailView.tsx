"use client";

import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  tarotDeck,
  type TarotCard,
  SUIT_NAMES_ZH,
  SUIT_NAMES_EN,
} from "@/data/tarot";

interface Props {
  card: TarotCard;
}

export default function TarotCardDetailView({ card }: Props) {
  const { t, locale } = useLanguage();
  const isZh = locale === "zh";

  const suitName = isZh ? SUIT_NAMES_ZH[card.suit] : SUIT_NAMES_EN[card.suit];
  const cardName = isZh ? card.nameZh : card.nameEn;
  const upright = isZh ? card.uprightMeaningZh : card.uprightMeaningEn;
  const reversed = isZh ? card.reversedMeaningZh : card.reversedMeaningEn;
  const keywordsUpright = isZh ? card.keywordsUprightZh : card.keywordsUprightEn;
  const keywordsReversed = isZh ? card.keywordsReversedZh : card.keywordsReversedEn;

  const sameSuit = tarotDeck
    .filter((c) => c.suit === card.suit && c.id !== card.id)
    .slice(0, 6);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
      <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
        <Link href="/tarot/cards" style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}>
          ← {t("78 張牌意百科", "78 Cards Encyclopedia", "78枚カード百科", "78장 카드 백과")}
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
            alt={cardName}
            width={400}
            height={620}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "rgba(212,168,85,0.7)", marginBottom: 6 }}>
            {suitName}
            {` · ${card.number}`}
          </div>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
          >
            {cardName}
          </h1>
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
          {t("正位", "Upright", "正位置", "정방향")}
        </h2>
        <div style={{ marginBottom: 12 }}>
          <strong style={{ color: "#e8e8f0", fontSize: 13 }}>
            {t("關鍵字", "Keywords", "キーワード", "키워드")}:
          </strong>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {keywordsUpright.map((k, i) => (
              <span
                key={i}
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
          </div>
        </div>
        <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.8 }}>{upright}</p>
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
          {t("逆位", "Reversed", "逆位置", "역방향")}
        </h2>
        <div style={{ marginBottom: 12 }}>
          <strong style={{ color: "#e8e8f0", fontSize: 13 }}>
            {t("關鍵字", "Keywords", "キーワード", "키워드")}:
          </strong>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {keywordsReversed.map((k, i) => (
              <span
                key={i}
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
          </div>
        </div>
        <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.8 }}>{reversed}</p>
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
          {t(
            "想看「這張牌」對你的問題說了什麼?",
            "Want to know what this card says about your question?",
            "このカードがあなたの質問に何を語るか見てみませんか?",
            "이 카드가 당신의 질문에 무엇을 말하는지 보고 싶나요?"
          )}
        </h3>
        <p style={{ color: "#c0c0d0", fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
          {t(
            "牌意是地圖,真正的占卜要把牌放進你的問題裡才會有意義。",
            "Card meanings are maps. A real reading happens when the card meets your question.",
            "カードの意味は地図です。真の占いは、カードがあなたの質問と出会ったときに起こります。",
            "카드의 의미는 지도입니다. 진정한 점은 카드가 당신의 질문과 만날 때 일어납니다."
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
            ✦ {t("塔羅占卜", "Tarot Reading", "タロット占い", "타로 점")}
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
            {t("Yes/No 占卜", "Yes/No", "Yes/No 占い", "Yes/No 점")}
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
            {t(
              `同花色其他牌 · ${suitName}`,
              `More from ${suitName}`,
              `同じスート · ${suitName}`,
              `같은 슈트 · ${suitName}`
            )}
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
              gap: 12,
            }}
          >
            {sameSuit.map((c) => {
              const cName = isZh ? c.nameZh : c.nameEn;
              return (
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
                      alt={cName}
                      width={200}
                      height={310}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: "#c0c0d0", textAlign: "center" }}>
                    {cName}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
