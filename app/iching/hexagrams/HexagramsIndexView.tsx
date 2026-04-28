"use client";

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { hexagrams, trigramNames } from "@/data/hexagrams";

interface Props {
  /** key 是 hexagram.number 字串 ("1" .. "64"),value 是 storage 上的圖 url */
  images: Record<string, string>;
}

const SECTIONS = [
  { titleKey: "upper" as const, range: [1, 30] as const },
  { titleKey: "lower" as const, range: [31, 64] as const },
];

export default function HexagramsIndexView({ images }: Props) {
  const { t, locale } = useLanguage();
  const isZh = locale === "zh";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px" }}>
      <header style={{ textAlign: "center", marginBottom: 32 }}>
        <h1
          className="text-gold-gradient"
          style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
        >
          {t(
            "易經 64 卦完整介紹",
            "I Ching · 64 Hexagrams",
            "易経 64卦 完全解説",
            "주역 64괘 백과"
          )}
        </h1>
        <p style={{ color: "#c0c0d0", fontSize: 14, marginTop: 8 }}>
          {t(
            "King Wen 周易序列 · 卦辭 / 象辭 / 白話翻譯",
            "King Wen sequence · judgments, images, vernacular",
            "周易順序 · 卦辞 / 象辞 / 現代訳",
            "주역 순서 · 괘사 / 상사 / 현대 번역"
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
            "64 卦由八卦兩兩相重而成。每卦皆附原文卦辭、象辭,以及白話翻譯。從乾坤起手,到既濟未濟收尾,層層展開人生與宇宙的結構。",
            "The 64 hexagrams emerge from pairs of the 8 trigrams. Each entry includes the classical judgment, image text, and a plain-language translation — opening from Qian/Kun and closing with Ji-Ji/Wei-Ji.",
            "64卦は八卦を二つずつ重ねて成り立ちます。各卦には原文の卦辞・象辞と現代訳を併載。乾坤から始まり既済未済まで、人生と宇宙の構造を層を成して描き出します。",
            "64괘는 8괘를 두 개씩 겹쳐 만들어집니다. 각 괘마다 원문 괘사와 상사, 그리고 현대 번역을 수록했습니다. 건곤에서 기제·미제까지, 인생과 우주의 구조를 단계적으로 펼칩니다."
          )}
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
          {t("如何卜卦", "How to Divine", "卜卦の方法", "점치는 법")}
        </h2>
        <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.85 }}>
          {t(
            "傳統卜卦使用三枚銅錢,連續擲六次,自下而上得六爻成卦。每次三枚錢的正反組合決定爻是「老陰、少陰、少陽、老陽」其中之一,老陰 / 老陽即為「變爻」,會由「本卦」變化出「之卦」。",
            "Toss three coins six times; the bottom toss is line one, the top toss is line six. Each toss yields one of: Old Yin, Young Yin, Young Yang, Old Yang. Old Yin and Old Yang are 'changing lines' — they transform the primary hexagram into a relating hexagram, revealing direction of change.",
            "三枚の銅貨を六回投げ、下から順に六爻を作ります。それぞれの組み合わせで「老陰・少陰・少陽・老陽」のいずれかが決まり、老陰と老陽は「変爻」として本卦から之卦を生み出し、変化の方向を示します。",
            "동전 세 개를 여섯 번 던져 아래에서 위로 여섯 효를 만듭니다. 매번의 조합으로 노음·소음·소양·노양 중 하나가 결정되며, 노음과 노양은 '변효'가 되어 본괘에서 지괘로 변화의 방향을 보여줍니다."
          )}
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
            ✦ {t("直接開始易經占卜", "Start I Ching Reading", "易経占いを始める", "주역 점 시작")}
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
            {t("Yes/No 速答", "Yes/No Quick", "Yes/No 即答", "Yes/No 즉답")}
          </Link>
        </div>
      </section>

      {/* 八卦對照 */}
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
          {t("八卦速覽", "The Eight Trigrams", "八卦速見表", "팔괘 속람")}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 10,
          }}
        >
          {Object.entries(trigramNames).map(([code, tg]) => (
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
              <div style={{ fontSize: 28, color: "#d4a855", lineHeight: 1 }}>{tg.symbol}</div>
              <div style={{ fontSize: 13, color: "#e8e8f0", marginTop: 6, fontWeight: 600 }}>
                {isZh ? tg.zh : tg.en}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 上經 / 下經 */}
      {SECTIONS.map((sec) => {
        const items = hexagrams.filter(
          (h) => h.number >= sec.range[0] && h.number <= sec.range[1]
        );
        const title =
          sec.titleKey === "upper"
            ? t("上經", "Upper Canon", "上経", "상경")
            : t("下經", "Lower Canon", "下経", "하경");
        const desc =
          sec.titleKey === "upper"
            ? t(
                "天道與君子立身",
                "Heaven, nature, and the foundations of the gentleman",
                "天道と君子の立身",
                "천도와 군자의 입신"
              )
            : t(
                "人事與變化終始",
                "Human affairs, change, and final outcomes",
                "人事と変化の終始",
                "인사와 변화의 시종"
              );
        return (
          <section key={sec.titleKey} style={{ marginBottom: 48 }}>
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
              {title}
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
              }}
            >
              {desc}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 14,
              }}
            >
              {items.map((h) => {
                const url = images[String(h.number)];
                const hName = isZh ? h.nameZh : h.nameEn.split(" ")[0];
                const numLabel = t(
                  `第 ${h.number} 卦`,
                  `Hexagram ${h.number}`,
                  `第${h.number}卦`,
                  `제 ${h.number}괘`
                );
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
                          alt={hName}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
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
                        {numLabel}
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
                        {hName}
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
  );
}
