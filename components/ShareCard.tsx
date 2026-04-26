"use client";

import { forwardRef } from "react";
import type { Hexagram } from "@/data/hexagrams";
import type { DrawnCard } from "@/data/tarot";
import { THREE_CARD_POSITIONS, SUIT_NAMES_ZH, SUIT_NAMES_EN } from "@/data/tarot";

/**
 * 分享卡 — 專門給 html-to-image 截圖用。
 * 所有樣式全部 inline、無動畫、無 backdrop-filter(html-to-image 支援不好)、無外部字型依賴。
 * 固定尺寸 1080×1350(3:4 portrait, 適合 IG/Line/FB)。
 *
 * 支援兩種占卜類型:
 *   divineType="iching"  → 顯示卦象 + 本卦/之卦 + 卦線
 *   divineType="tarot"   → 顯示三張牌 + 過去/現在/未來位置標
 *
 * 渲染方式:在結果頁放一個 position: fixed; left: -9999px 的容器,
 * 截圖完就觸發下載,不影響使用者畫面。
 */

interface IchingProps {
  divineType: "iching";
  hexagram: Hexagram;
  relatingHexagram?: Hexagram | null;
  primaryLines: number[];
  relatingLines?: number[] | null;
  changingLines?: number[];
}

interface TarotProps {
  divineType: "tarot";
  drawnCards: DrawnCard[];
}

type CommonProps = {
  question: string;
  categoryIcon: string;
  categoryNameZh: string;
  categoryNameEn: string;
  aiReading: string;
  locale: "zh" | "en";
  showWatermark: boolean; // true = 免費用戶 (加對角浮水印),false = 付費
};

type Props = CommonProps & (IchingProps | TarotProps);

const CARD_W = 1080;
const CARD_H = 1350;

// ── 靜態卦線渲染器(沒有 motion,截圖 deterministic) ───────────
function StaticHexagram({
  lines,
  changingLines = [],
  size = "md",
}: {
  lines: number[];
  changingLines?: number[];
  size?: "sm" | "md";
}) {
  const s = size === "sm"
    ? { w: 120, h: 10, gap: 10, gapInner: 14 }
    : { w: 180, h: 14, gap: 14, gapInner: 20 };

  const display = [...lines].reverse();
  const changingDisplay = changingLines.map((i) => 5 - i);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: s.gap, alignItems: "center" }}>
      {display.map((line, idx) => {
        const isChanging = changingDisplay.includes(idx);
        const bg = isChanging
          ? "linear-gradient(90deg, #d4a855, #fde68a, #d4a855)"
          : "#d4a855";
        return (
          <div key={idx} style={{ width: s.w, position: "relative" }}>
            {line === 1 ? (
              <div style={{ width: "100%", height: s.h, borderRadius: 2, background: bg }} />
            ) : (
              <div style={{ display: "flex", gap: s.gapInner, width: "100%" }}>
                <div style={{ flex: 1, height: s.h, borderRadius: 2, background: bg }} />
                <div style={{ flex: 1, height: s.h, borderRadius: 2, background: bg }} />
              </div>
            )}
            {isChanging && (
              <span
                style={{
                  position: "absolute",
                  right: -24,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#fde68a",
                  fontSize: 14,
                }}
              >
                ○
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 摘要 AI 解盤:取前 N 字、遇到換行就斷 ─────────────────────
function summarizeReading(text: string, maxChars = 180): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  // 盡量在句號、逗號、或空白斷句
  const sliced = clean.slice(0, maxChars);
  const lastBreak = Math.max(
    sliced.lastIndexOf("。"),
    sliced.lastIndexOf("!"),
    sliced.lastIndexOf("?"),
    sliced.lastIndexOf(","),
    sliced.lastIndexOf(","),
    sliced.lastIndexOf(" ")
  );
  const cutoff = lastBreak > maxChars * 0.6 ? lastBreak + 1 : maxChars;
  return clean.slice(0, cutoff).trim() + "…";
}

const ShareCard = forwardRef<HTMLDivElement, Props>(function ShareCard(
  props,
  ref
) {
  const {
    question,
    categoryIcon,
    categoryNameZh,
    categoryNameEn,
    aiReading,
    locale,
    showWatermark,
  } = props;
  const t = (zh: string, en: string) => (locale === "zh" ? zh : en);
  const isTarot = props.divineType === "tarot";

  // 摘要長度視佈局調整 — 塔羅版卡片區較大,摘要稍短
  const aiSummary = summarizeReading(aiReading, isTarot ? 150 : 200);

  // 易經專用狀態
  const hasRelating =
    !isTarot &&
    props.relatingHexagram &&
    props.relatingLines &&
    props.relatingLines.length === 6;

  // 品牌 icon 改用 Delphic Oracle 圓形徽章(整個 app logo 統一)
  // 注意:ShareCard 被 html-to-image 截圖,外部圖若跨網域未有 CORS header 會直接拒絕。
  // 把 logo 放在 public/ 下用相對 URL 確保永遠同源可載。
  const brandText = isTarot
    ? t("塔羅占卜", "Oracle Tarot")
    : t("易經占卜", "Oracle I Ching");

  return (
    <div
      ref={ref}
      style={{
        width: CARD_W,
        height: CARD_H,
        position: "relative",
        background:
          "linear-gradient(135deg, #0a0a1a 0%, #1a103d 50%, #0d0d2b 100%)",
        color: "#ffffff",
        fontFamily: "'Noto Serif TC', 'Noto Sans TC', serif",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* ── 星點背景裝飾 ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(2px 2px at 80px 120px, #eee, transparent)," +
            "radial-gradient(1px 1px at 200px 300px, rgba(255,255,255,0.8), transparent)," +
            "radial-gradient(2px 2px at 420px 180px, #fff, transparent)," +
            "radial-gradient(1px 1px at 620px 450px, rgba(255,255,255,0.7), transparent)," +
            "radial-gradient(2px 2px at 880px 260px, #ddd, transparent)," +
            "radial-gradient(1px 1px at 320px 780px, rgba(255,255,255,0.6), transparent)," +
            "radial-gradient(2px 2px at 760px 900px, #eee, transparent)," +
            "radial-gradient(1px 1px at 180px 1100px, rgba(255,255,255,0.7), transparent)," +
            "radial-gradient(2px 2px at 920px 1180px, #fff, transparent)",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />

      {/* ── 頂部裝飾光暈 ── */}
      <div
        style={{
          position: "absolute",
          top: -200,
          left: -100,
          width: 500,
          height: 500,
          background: "rgba(139, 92, 246, 0.25)",
          borderRadius: "50%",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -150,
          right: -100,
          width: 450,
          height: 450,
          background: "rgba(212, 168, 85, 0.18)",
          borderRadius: "50%",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      {/* ── 主內容 ── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "72px 64px 60px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 頂部品牌 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-128.png"
              alt="Oracle"
              width={56}
              height={56}
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                display: "block",
                boxShadow: "0 0 16px rgba(212,168,85,0.4)",
              }}
            />
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#d4a855",
                letterSpacing: 2,
              }}
            >
              {brandText}
            </span>
          </div>
          <span style={{ fontSize: 18, color: "rgba(192,192,208,0.6)" }}>
            {new Date().toISOString().slice(0, 10)}
          </span>
        </div>

        {/* ─── 易經主體:卦象字元 + 本/之卦 + 卦線 ─── */}
        {!isTarot && (
          <>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div
                style={{
                  fontSize: 180,
                  lineHeight: 1,
                  color: "#d4a855",
                  textShadow:
                    "0 0 40px rgba(212,168,85,0.5), 0 0 80px rgba(212,168,85,0.3)",
                  marginBottom: 16,
                }}
              >
                {props.hexagram.character}
              </div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  background:
                    "linear-gradient(135deg, #d4a855 0%, #f0d78c 50%, #d4a855 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  marginBottom: 8,
                }}
              >
                {t(
                  `第 ${props.hexagram.number} 卦 ${props.hexagram.nameZh}`,
                  `Hexagram ${props.hexagram.number}: ${props.hexagram.nameEn}`
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 48,
                marginBottom: 36,
              }}
            >
              <div>
                <StaticHexagram
                  lines={props.primaryLines}
                  changingLines={props.changingLines}
                  size={hasRelating ? "sm" : "md"}
                />
                <div
                  style={{
                    textAlign: "center",
                    marginTop: 14,
                    fontSize: 16,
                    color: "rgba(192,192,208,0.6)",
                  }}
                >
                  {t("本卦", "Primary")}
                </div>
              </div>
              {hasRelating && props.relatingHexagram && props.relatingLines && (
                <>
                  <div style={{ color: "rgba(212,168,85,0.5)", fontSize: 36 }}>→</div>
                  <div>
                    <StaticHexagram lines={props.relatingLines} size="sm" />
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: 14,
                        fontSize: 16,
                        color: "rgba(192,192,208,0.6)",
                      }}
                    >
                      {t(
                        `之卦 ${props.relatingHexagram.nameZh}`,
                        `Relating: ${props.relatingHexagram.nameEn}`
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ─── 塔羅主體:三張牌 ─── */}
        {isTarot && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  background:
                    "linear-gradient(135deg, #d4a855 0%, #f0d78c 50%, #d4a855 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  marginBottom: 6,
                }}
              >
                {t("三牌占卜 · 過去 現在 未來", "Three-Card · Past Present Future")}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 20,
                marginBottom: 28,
              }}
            >
              {props.drawnCards.map((drawn, idx) => {
                const pos = THREE_CARD_POSITIONS[idx];
                const cardName = locale === "zh" ? drawn.card.nameZh : drawn.card.nameEn;
                const suitName =
                  (locale === "zh" ? SUIT_NAMES_ZH : SUIT_NAMES_EN)[drawn.card.suit];
                const orientationLabel = drawn.isReversed
                  ? t("逆位", "Reversed")
                  : t("正位", "Upright");
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        color: "#d4a855",
                        fontSize: 22,
                        fontFamily: "'Noto Serif TC', serif",
                        marginBottom: 10,
                        fontWeight: 700,
                      }}
                    >
                      {locale === "zh" ? pos.labelZh : pos.labelEn}
                    </div>
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "2 / 3.5",
                        borderRadius: 14,
                        overflow: "hidden",
                        border: "2px solid rgba(212,168,85,0.5)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        background: "rgba(13,13,43,0.9)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={drawn.card.imagePath}
                        alt={cardName}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          transform: drawn.isReversed ? "rotate(180deg)" : "none",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        marginTop: 12,
                        textAlign: "center",
                        fontSize: 20,
                        color: "#e8e8f0",
                        fontWeight: 700,
                        fontFamily: "'Noto Serif TC', serif",
                        lineHeight: 1.25,
                      }}
                    >
                      {cardName}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 14,
                        color: drawn.isReversed ? "#f59e7a" : "#d4a855",
                      }}
                    >
                      {suitName} · {orientationLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 類別 + 問題 */}
        <div
          style={{
            background: "rgba(13, 13, 43, 0.6)",
            border: "1px solid rgba(212, 168, 85, 0.3)",
            borderRadius: 20,
            padding: "20px 28px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 10,
              color: "#d4a855",
              fontSize: 18,
            }}
          >
            <span style={{ fontSize: 24 }}>{categoryIcon}</span>
            <span>{locale === "zh" ? categoryNameZh : categoryNameEn}</span>
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#e8e8f0",
              lineHeight: 1.5,
              fontStyle: "italic",
              fontWeight: 500,
            }}
          >
            「{question}」
          </div>
        </div>

        {/* AI 解盤摘要 */}
        <div
          style={{
            flex: 1,
            background: "rgba(13, 13, 43, 0.6)",
            borderLeft: "4px solid #d4a855",
            borderRadius: 12,
            padding: "20px 28px",
            marginBottom: 20,
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "#d4a855",
              marginBottom: 10,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            ✦ {t("老師解盤", "Master's Reading")}
          </div>
          <div
            style={{
              fontSize: 20,
              lineHeight: 1.7,
              color: "rgba(232, 232, 240, 0.92)",
              fontFamily: "'Noto Sans TC', sans-serif",
              whiteSpace: "pre-wrap",
            }}
          >
            {aiSummary || t("(AI 解盤載入中…)", "(AI reading loading…)")}
          </div>
          {/* 免責聲明 — 法遵必要,分享到社群也必須一起帶 */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 10,
              borderTop: "1px dashed rgba(212,168,85,0.2)",
              fontSize: 13,
              lineHeight: 1.5,
              color: "rgba(192,192,208,0.65)",
              fontStyle: "italic",
            }}
          >
            {t(
              "※ 僅供參考,不構成投資、醫療、法律或重大決策之建議。",
              "※ For reference only. Not investment, medical, legal, or major life decision advice."
            )}
          </div>
        </div>

        {/* 底部 brand */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 14,
            borderTop: "1px solid rgba(212, 168, 85, 0.2)",
          }}
        >
          <span style={{ fontSize: 15, color: "rgba(192,192,208,0.5)" }}>
            {t("心誠則靈 · 天機解讀", "Sincere heart · AI divination")}
          </span>
          <span
            style={{
              fontSize: 18,
              color: "#d4a855",
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            heronhouse.me
          </span>
        </div>
      </div>

      {/* ── 浮水印(免費用戶才顯示)── */}
      {showWatermark && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              transform: "rotate(-28deg)",
              display: "flex",
              flexDirection: "column",
              gap: 48,
              alignItems: "center",
              opacity: 0.08,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  fontSize: 72,
                  fontWeight: 700,
                  color: "#d4a855",
                  letterSpacing: 8,
                  whiteSpace: "nowrap",
                }}
              >
                heronhouse.me
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default ShareCard;
