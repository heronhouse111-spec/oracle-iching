import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import { SPREADS, spreadImageSlot } from "@/data/spreads";
import { getUiImages } from "@/lib/uiImages";
import { getServerLocale, getServerT } from "@/lib/serverLocale";

export const metadata: Metadata = {
  title: "塔羅牌陣大全 · Tarot Spreads | Tarogram 易問",
  description:
    "從三牌時間軸到凱爾特十字,五大經典塔羅牌陣完整解析:適合的問題、位置意義、實際操作。",
  alternates: { canonical: "/tarot-spread" },
  openGraph: {
    title: "塔羅牌陣大全 · Tarot Spreads",
    description: "Five classic tarot spreads — three-card, two-options, love cross, Celtic cross, yearly 12.",
  },
};

export default async function TarotSpreadIndexPage() {
  const uiImages = await getUiImages();
  const t = await getServerT();
  const { locale } = await getServerLocale();
  const isZh = locale === "zh";

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
        <header style={{ textAlign: "center", marginBottom: 32 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
          >
            {t("塔羅牌陣大全", "Tarot Spreads", "タロット スプレッド大全", "타로 스프레드 백과")}
          </h1>
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
            {t(
              "不同問題適合不同牌陣 — 三牌看脈絡、二選一做決策、愛情十字看關係、凱爾特十字解大命題、年度十二宮看一年。",
              "Different questions call for different spreads. Three-card for narrative, two-options for decisions, love cross for relationships, Celtic cross for big matters, yearly 12 for the year ahead.",
              "質問によって適切なスプレッドは異なります。3枚は流れを見るのに、2択は決断、ラブクロスは恋愛、ケルト十字は大きな課題、年間12室は1年を見るのに。",
              "질문마다 어울리는 스프레드가 다릅니다. 세 장 카드는 흐름, 양자택일은 결정, 러브 크로스는 관계, 켈틱 크로스는 큰 문제, 연간 12궁은 한 해를 보는 데 사용합니다."
            )}
          </p>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {SPREADS.map((s) => {
            const thumb = uiImages[spreadImageSlot(s.id)];
            const sName = isZh ? s.nameZh : s.nameEn;
            const sTagline = isZh ? s.taglineZh : s.taglineEn;
            return (
              <Link
                key={s.id}
                href={`/tarot-spread/${s.id}`}
                style={{
                  display: "flex",
                  gap: 14,
                  background: "rgba(13,13,43,0.5)",
                  border: "1px solid rgba(212,168,85,0.2)",
                  borderRadius: 14,
                  padding: 16,
                  textDecoration: "none",
                  color: "inherit",
                  transition: "transform 0.2s, border-color 0.2s",
                }}
              >
                {thumb && (
                  <div
                    style={{
                      width: 96,
                      flexShrink: 0,
                      aspectRatio: "1 / 1",
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "1px solid rgba(212,168,85,0.2)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                    <h2
                      style={{
                        fontFamily: "'Noto Serif TC', serif",
                        fontSize: 20,
                        color: "#d4a855",
                        margin: 0,
                      }}
                    >
                      {sName}
                    </h2>
                    <span style={{ color: "rgba(212,168,85,0.7)", fontSize: 12, whiteSpace: "nowrap" }}>
                      {t(`${s.cardCount} 張`, `${s.cardCount} cards`, `${s.cardCount}枚`, `${s.cardCount}장`)}
                    </span>
                  </div>
                  <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    {sTagline}
                  </p>
                </div>
              </Link>
            );
          })}
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
            {t(
              "想直接開始?從主流程選擇牌陣 →",
              "Ready to draw? Pick a spread in the main flow →",
              "すぐに始めますか?メイン画面でスプレッドを選んでください →",
              "바로 시작할까요? 메인 플로우에서 스프레드를 선택하세요 →"
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
              display: "inline-block",
            }}
          >
            ✦ {t("開始占卜", "Start Reading", "占いを始める", "점 시작하기")}
          </Link>
        </footer>
      </div>
    </main>
  );
}
