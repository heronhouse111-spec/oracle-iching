"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { SPREADS, type Spread } from "@/data/spreads";

interface Props {
  spread: Spread;
  heroImage: string | undefined;
}

export default function TarotSpreadDetailView({ spread, heroImage }: Props) {
  const { t, locale } = useLanguage();
  const isZh = locale === "zh";

  const sName = isZh ? spread.nameZh : spread.nameEn;
  const sTagline = isZh ? spread.taglineZh : spread.taglineEn;
  const sWhen = isZh ? spread.whenZh : spread.whenEn;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
      <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
        <Link href="/tarot-spread" style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}>
          ← {t("牌陣大全", "All Spreads", "スプレッド一覧", "스프레드 백과")}
        </Link>
      </nav>

      {heroImage && (
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid rgba(212,168,85,0.25)",
            marginBottom: 24,
            background:
              "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(13,13,43,0.45))",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={sName}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
      )}

      <header style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: "rgba(212,168,85,0.7)", marginBottom: 8, letterSpacing: 1 }}>
          {t("塔羅牌陣", "TAROT SPREAD", "タロット スプレッド", "타로 스프레드")}
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
          {sName}
        </h1>
        <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.8, marginTop: 16 }}>
          {sTagline}
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
          {t("什麼時候用", "When to Use", "使うタイミング", "사용 시기")}
        </h2>
        <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.8 }}>{sWhen}</p>
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
          {t(
            `牌位意義（${spread.cardCount} 個位置）`,
            `Positions (${spread.cardCount})`,
            `カード位置（${spread.cardCount} 箇所）`,
            `카드 위치 (${spread.cardCount}개)`
          )}
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
          {spread.positions.map((p, idx) => {
            const pLabel = isZh ? p.labelZh : p.labelEn;
            const pDesc = isZh ? p.descZh : p.descEn;
            return (
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
                    {pLabel}
                  </strong>
                </div>
                <p style={{ color: "#c0c0d0", fontSize: 13, lineHeight: 1.6, margin: "0 0 0 36px" }}>
                  {pDesc}
                </p>
              </li>
            );
          })}
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
          {t(
            `開始用「${sName}」做一次占卜`,
            `Start a reading with ${sName}`,
            `「${sName}」で占いを始める`,
            `「${sName}」으로 점쳐 보기`
          )}
        </h3>
        <p style={{ color: "#c0c0d0", fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
          {t(
            "從主流程選擇此牌陣 → 描述你的問題 → AI 解牌",
            "Pick this spread in the main flow → describe your question → AI reads",
            "メイン画面でこのスプレッドを選択 → 質問を入力 → AI が解読",
            "메인 플로우에서 이 스프레드 선택 → 질문 입력 → AI 해석"
          )}
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
          ✦ {t("用這個牌陣占卜", "Use this spread", "このスプレッドで占う", "이 스프레드로 점치기")}
        </Link>
      </section>

      {/* Other spreads */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 14, color: "rgba(212,168,85,0.7)", marginBottom: 12 }}>
          {t("其他牌陣", "Other Spreads", "他のスプレッド", "다른 스프레드")}
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
              {isZh ? s.nameZh : s.nameEn}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
