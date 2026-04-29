"use client";

/**
 * HexagramDetailView — 易經單卦詳細頁的「視圖」(client),locale 改變時瞬間 re-render.
 *
 * Server-side 拿不到 client 的 useLanguage() — 之前用 cookie + getServerT() 讓
 * server 知道語系,但代價是切換語言時要 router.refresh() 等一輪 network round-trip,
 * Header 已經換成韓文時 body 還停在中文,使用者看到很卡。
 *
 * 改法:server 那邊只負責撈 hexagram + image url,把這層整包丟到 client 渲染。
 * 切語言時 useLanguage() React state 變動,React 直接重 render,完全沒 round-trip。
 */

import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { trigramNames, type Hexagram } from "@/data/hexagrams";

interface PrevNextHex {
  number: number;
  nameZh: string;
  nameEn: string;
  nameJa?: string;
  nameKo?: string;
}

interface Props {
  hexagram: Hexagram;
  /** 圖還沒上傳就 undefined,view 端用 Unicode 字 + 卦線占位 */
  heroUrl: string | undefined;
  /** 上一卦 / 下一卦資料(只取 number 和 name)*/
  prev: PrevNextHex | null;
  next: PrevNextHex | null;
}

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

export default function HexagramDetailView({ hexagram: hex, heroUrl, prev, next }: Props) {
  const { t } = useLanguage();

  const upper = trigramNames[hex.upperTrigram];
  const lower = trigramNames[hex.lowerTrigram];

  const hName = t(hex.nameZh, hex.nameEn, hex.nameJa, hex.nameKo);
  // 卦辭/象辭原文(古漢語)不翻譯,跨語系一律顯示
  const judgmentClassical = hex.judgmentZh;
  const imageClassical = hex.imageZh;
  // 白話翻譯/現代訳:zh 用 vernacular,其他語系用對應 lang 欄位 fallback 到 en
  const judgmentTranslated = t(
    hex.judgmentVernacularZh,
    hex.judgmentEn,
    hex.judgmentJa,
    hex.judgmentKo
  );
  const imageTranslated = t(
    hex.imageVernacularZh,
    hex.imageEn,
    hex.imageJa,
    hex.imageKo
  );
  const upperName = upper ? t(upper.zh, upper.en, upper.ja, upper.ko) : "";
  const lowerName = lower ? t(lower.zh, lower.en, lower.ja, lower.ko) : "";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
      <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
        <Link
          href="/iching/hexagrams"
          style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}
        >
          ← {t("64 卦完整介紹", "All 64 Hexagrams", "64卦 完全解説", "64괘 백과")}
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
        {/* Hero 圖框 — 9:14 直幅,跟 /tarot/cards/[slug] 同規格。
            object-fit: contain → 後台上傳時不裁切檔案,前台原樣顯示。
            如果上傳的圖正好是 9:14,完全吻合;不是的話 letterbox(留白邊),
            而非 cover 那樣強制裁掉一部分。
            沒上傳真圖時刻意留白,避免日後上傳真圖時的視覺跳動。 */}
        <div
          style={{
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid rgba(212,168,85,0.4)",
            boxShadow: "0 8px 32px rgba(212,168,85,0.18)",
            background:
              "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(13,13,43,0.6))",
            aspectRatio: "9 / 14",
          }}
        >
          {heroUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroUrl}
              alt={hName}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
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

      {/* 卦辭 */}
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

      {/* 象辭 */}
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

      {/* 上/下一卦 */}
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
                `第${prev.number}卦 ${prev.nameJa ?? prev.nameZh}`,
                `제 ${prev.number}괘 ${prev.nameKo ?? prev.nameEn.split(" ")[0]}`
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
                `第${next.number}卦 ${next.nameJa ?? next.nameZh}`,
                `제 ${next.number}괘 ${next.nameKo ?? next.nameEn.split(" ")[0]}`
              )}
            </div>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
