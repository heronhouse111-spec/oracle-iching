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
import {
  trigramNames,
  hexagramAuspice,
  trigramRelationship,
  type Hexagram,
  type HexagramAuspice,
  type TrigramRelationship,
} from "@/data/hexagrams";

// 吉凶 badge 設定 — 跟 MethodsView 的 tier badge 同色系
const AUSPICE_STYLE: Record<HexagramAuspice, { bg: string; text: string }> = {
  great: { bg: "rgba(74,222,128,0.18)", text: "#86efac" },
  mixed: { bg: "rgba(212,168,85,0.20)", text: "#fde68a" },
  challenge: { bg: "rgba(248,113,113,0.18)", text: "#fca5a5" },
};

// 上下卦關係 → 五行氣象 + 該卦氣象短評
const RELATIONSHIP_INFO: Record<
  TrigramRelationship,
  {
    labelZh: string;
    labelEn: string;
    labelJa: string;
    labelKo: string;
    descZh: string;
    descEn: string;
    descJa: string;
    descKo: string;
  }
> = {
  harmonious: {
    labelZh: "比和（同氣）",
    labelEn: "Harmonious (Same Element)",
    labelJa: "比和（同気）",
    labelKo: "비화(같은 기운)",
    descZh: "上下卦五行相同，氣象一致，事情走勢平穩、力量集中。",
    descEn:
      "Upper and lower trigrams share the same element — energy is unified, the matter unfolds steadily with concentrated force.",
    descJa: "上下卦の五行が同じで気象が一致。事の流れは安定し、力が集中する。",
    descKo:
      "상괘와 하괘의 오행이 같아 기운이 일치합니다. 일이 안정적으로 흐르고 힘이 집중됩니다.",
  },
  ascending: {
    labelZh: "下生上（內滋外）",
    labelEn: "Ascending (Inner Nourishes Outer)",
    labelJa: "下が上を生ず（内が外を養う）",
    labelKo: "하생상(안이 밖을 살림)",
    descZh: "下卦五行生上卦，內力由下而上順生，事情漸入佳境，得勢之象。",
    descEn:
      "The lower trigram generates the upper — inner force flows upward, the matter gathers momentum into a favorable phase.",
    descJa: "下卦の五行が上卦を生ず。内なる力が下から上へ順に流れ、事は次第に好転する得勢の象。",
    descKo:
      "하괘의 오행이 상괘를 살립니다. 안의 힘이 아래에서 위로 순조롭게 흘러, 일이 점차 좋아지는 상입니다.",
  },
  descending: {
    labelZh: "上生下（外養內）",
    labelEn: "Descending (Outer Feeds Inner)",
    labelJa: "上が下を生ず（外が内を養う）",
    labelKo: "상생하(밖이 안을 살림)",
    descZh: "上卦生下卦，外部資源滋養內部，得他人助力，但需慎防被動。",
    descEn:
      "The upper trigram nourishes the lower — outer resources support the inner; help arrives, but beware of becoming passive.",
    descJa: "上卦が下卦を生ず。外の資源が内を養い、他者の助力を得るが、受け身にならぬよう注意。",
    descKo:
      "상괘가 하괘를 살립니다. 외부 자원이 안을 양육해 타인의 도움을 받지만, 수동적이 되지 않도록 주의해야 합니다.",
  },
  rebellious: {
    labelZh: "下剋上（內反外）",
    labelEn: "Rebellious (Inner Resists Outer)",
    labelJa: "下が上を剋す（内が外に反す）",
    labelKo: "하극상(안이 밖을 거스름)",
    descZh: "下卦剋上卦，內部欲突破外部框架，主動有衝突，宜謀而後動。",
    descEn:
      "The lower trigram restrains the upper — the inner pushes against the outer frame; conflict arises from initiative, plan before acting.",
    descJa: "下卦が上卦を剋す。内が外の枠を突破しようとし、主体的衝突あり。謀ってから動くべし。",
    descKo:
      "하괘가 상괘를 극합니다. 안이 밖의 틀을 깨려 하여 주도적 충돌이 있으니, 도모한 뒤 움직이세요.",
  },
  oppressive: {
    labelZh: "上剋下（外壓內）",
    labelEn: "Oppressive (Outer Restrains Inner)",
    labelJa: "上が下を剋す（外が内を圧す）",
    labelKo: "상극하(밖이 안을 누름)",
    descZh: "上卦剋下卦，外部壓力強過內部，事情受制於人，宜守不宜進。",
    descEn:
      "The upper trigram restrains the lower — outer pressure exceeds inner strength; the matter is constrained, hold rather than advance.",
    descJa: "上卦が下卦を剋す。外圧が内を上回り、事は他者に制せられる。守って進まず。",
    descKo:
      "상괘가 하괘를 극합니다. 외압이 안의 힘을 넘어 일이 제약받으니, 지키고 나아가지 마세요.",
  },
};

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

  // 吉凶分類 + 上下卦五行關係 — 用於下方獨立區塊
  const auspice = hexagramAuspice[hex.number];
  const auspiceLabel =
    auspice === "great"
      ? t("大吉之卦", "Auspicious", "大吉の卦", "대길의 괘")
      : auspice === "challenge"
        ? t("艱難之卦", "Challenging", "艱難の卦", "험난의 괘")
        : t("中性之卦", "Mixed", "中性の卦", "중성의 괘");
  const relationship = trigramRelationship(hex.upperTrigram, hex.lowerTrigram);
  const relInfo = relationship ? RELATIONSHIP_INFO[relationship] : null;
  const upperDirection = upper
    ? t(upper.directionZh, upper.directionEn, upper.directionJa, upper.directionKo)
    : "";
  const lowerDirection = lower
    ? t(lower.directionZh, lower.directionEn, lower.directionJa, lower.directionKo)
    : "";

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
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
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
            {auspice && (
              <span
                style={{
                  background: AUSPICE_STYLE[auspice].bg,
                  color: AUSPICE_STYLE[auspice].text,
                  fontSize: 11,
                  padding: "3px 10px",
                  borderRadius: 100,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  alignSelf: "center",
                }}
              >
                {auspiceLabel}
              </span>
            )}
          </div>

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
              {/* HexagramLines 已經視覺化六爻,Unicode 卦象字(`{hex.character}`)是同一資訊的小一號重複,移除。 */}
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

      {/* 上下卦關係 — 五行相生剋 + 後天八卦方位,合參方位卦象用 */}
      {relInfo && upper && lower && (
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
            {t(
              "上下卦關係",
              "Upper / Lower Trigram Relationship",
              "上下卦の関係",
              "상괘 / 하괘의 관계"
            )}
          </h2>
          <div
            style={{
              background: "rgba(13,13,43,0.55)",
              border: "1px solid rgba(212,168,85,0.2)",
              borderRadius: 10,
              padding: 18,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginBottom: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(212,168,85,0.7)",
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  {t("上卦（外）", "Upper · Outer", "上卦(外)", "상괘 · 외")}
                </div>
                <div
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: 16,
                    color: "#fde68a",
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ marginRight: 6 }}>{upper.symbol}</span>
                  {upperName}
                </div>
                <div style={{ fontSize: 12, color: "rgba(192,192,208,0.75)", marginTop: 2 }}>
                  {t("方位", "Direction", "方位", "방위")}：{upperDirection}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(212,168,85,0.7)",
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  {t("下卦（內）", "Lower · Inner", "下卦(内)", "하괘 · 내")}
                </div>
                <div
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: 16,
                    color: "#fde68a",
                    fontWeight: 600,
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ marginRight: 6 }}>{lower.symbol}</span>
                  {lowerName}
                </div>
                <div style={{ fontSize: 12, color: "rgba(192,192,208,0.75)", marginTop: 2 }}>
                  {t("方位", "Direction", "方位", "방위")}：{lowerDirection}
                </div>
              </div>
            </div>
            <div
              style={{
                paddingTop: 14,
                borderTop: "1px dashed rgba(212,168,85,0.2)",
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
                {t("五行氣象", "Five-Element Dynamic", "五行の気象", "오행 기운")}
              </div>
              <div
                style={{
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 16,
                  color: "#fde68a",
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                {t(
                  relInfo.labelZh,
                  relInfo.labelEn,
                  relInfo.labelJa,
                  relInfo.labelKo
                )}
              </div>
              <p style={{ color: "#e8e8f0", fontSize: 14, lineHeight: 1.85, margin: 0 }}>
                {t(relInfo.descZh, relInfo.descEn, relInfo.descJa, relInfo.descKo)}
              </p>
            </div>
          </div>
        </section>
      )}

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
