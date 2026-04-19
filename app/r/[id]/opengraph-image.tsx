import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getHexagramByNumber } from "@/data/hexagrams";
import { getCardById } from "@/data/tarot";

/**
 * OG image for /r/[id] public share page.
 *
 * 渲染引擎 Satori 沒有內建 CJK 字型,所以這張圖刻意設計成視覺優先:
 * 易經版 — 卦線(純幾何)+ Hexagram N + 英文卦名
 * 塔羅版 — 三張牌卡縮圖(用 img)+ English card names
 * 兩者都避開任何中文字 / ☯ / 🎴 / ✦ 等會 tofu 的字元。
 *
 * 如果之後要在 OG 圖加中文,需 bundle Noto Sans TC TTF 進 assets/ 再透過
 * readFile + fonts[] 載入(參考 Next.js ImageResponse 文件)。
 */

export const alt = "Oracle — I Ching × Tarot × AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SavedTarotCard {
  cardId: string;
  position: "past" | "present" | "future";
  isReversed: boolean;
}

interface D {
  hexagram_number: number | null;
  primary_lines: number[] | null;
  changing_lines: number[] | null;
  relating_hexagram_number: number | null;
  tarot_cards: SavedTarotCard[] | null;
  divine_type: "iching" | "tarot";
  is_public: boolean;
}

async function loadPublic(id: string): Promise<D | null> {
  if (!id || id.length < 16 || id.length > 64) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("divinations")
    .select(
      "hexagram_number,primary_lines,changing_lines,relating_hexagram_number,tarot_cards,divine_type,is_public"
    )
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as D;
}

// 靜態卦線 for OG image ── Satori 要求每個 div 要有 display 屬性
function HexLines({
  lines,
  changingLines = [],
  size = "small",
}: {
  lines: number[];
  changingLines?: number[];
  size?: "big" | "small";
}) {
  const display = [...lines].reverse();
  const changingDisplay = changingLines.map((i) => 5 - i);
  const W = size === "big" ? 360 : 160;
  const H = size === "big" ? 32 : 14;
  const gap = size === "big" ? 24 : 14;
  const split = size === "big" ? 40 : 18;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        alignItems: "center",
      }}
    >
      {display.map((line, idx) => {
        const isChanging = changingDisplay.includes(idx);
        const bg = isChanging ? "#fde68a" : "#d4a855";
        if (line === 1) {
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                width: W,
                height: H,
                borderRadius: size === "big" ? 4 : 2,
                background: bg,
              }}
            />
          );
        }
        return (
          <div key={idx} style={{ display: "flex", gap: split, width: W }}>
            <div style={{ display: "flex", flex: 1, height: H, borderRadius: size === "big" ? 4 : 2, background: bg }} />
            <div style={{ display: "flex", flex: 1, height: H, borderRadius: size === "big" ? 4 : 2, background: bg }} />
          </div>
        );
      })}
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await loadPublic(id);
  const isTarot = d?.divine_type === "tarot";

  // 易經資料整理
  const hex =
    !isTarot && d?.hexagram_number !== null && d?.hexagram_number !== undefined
      ? getHexagramByNumber(d.hexagram_number)
      : null;
  const relatingLines =
    !isTarot &&
    d?.changing_lines &&
    d.changing_lines.length > 0 &&
    d.primary_lines
      ? d.primary_lines.map((line, i) =>
          d.changing_lines!.includes(i) ? (line === 1 ? 0 : 1) : line
        )
      : null;
  const relHex =
    !isTarot &&
    d?.relating_hexagram_number !== null &&
    d?.relating_hexagram_number !== undefined
      ? getHexagramByNumber(d.relating_hexagram_number)
      : null;

  // 塔羅資料整理 — 解析 card + 公開 CDN 絕對 URL(Satori 需絕對 URL 才能 fetch 圖)
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://oracle.heronhouse.me";

  const tarotRender =
    isTarot && d?.tarot_cards
      ? d.tarot_cards
          .map((tc) => {
            const card = getCardById(tc.cardId);
            if (!card) return null;
            return {
              card,
              position: tc.position,
              isReversed: tc.isReversed,
              imageUrl: `${baseUrl}${card.imagePath}`,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #0a0a1a 0%, #1a103d 50%, #0d0d2b 100%)",
          color: "#ffffff",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* 光暈裝飾 */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -150,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: 9999,
            background: "rgba(212,168,85,0.18)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: -120,
            left: -80,
            width: 380,
            height: 380,
            borderRadius: 9999,
            background: "rgba(139,92,246,0.22)",
            filter: "blur(80px)",
          }}
        />

        {/* 內容 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "56px 72px",
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          {/* 頂部品牌列 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* CSS-drawn circular logo mark (字型無關,不會變成 tofu)*/}
              <div
                style={{
                  display: "flex",
                  width: 36,
                  height: 36,
                  borderRadius: 9999,
                  border: "3px solid #d4a855",
                  background:
                    "linear-gradient(135deg, rgba(212,168,85,0.3) 0%, rgba(139,92,246,0.2) 100%)",
                }}
              />
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#d4a855",
                  letterSpacing: 2,
                }}
              >
                Oracle · {isTarot ? "Tarot" : "I Ching"}
              </span>
            </div>
            <span style={{ fontSize: 20, color: "rgba(192,192,208,0.6)" }}>
              oracle.heronhouse.me
            </span>
          </div>

          {/* ── 易經主卦象 ── */}
          {!isTarot && (
            <div
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 72,
                marginTop: 24,
              }}
            >
              {/* 左:大卦線 */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "32px 48px",
                  borderRadius: 24,
                  border: "2px solid rgba(212,168,85,0.35)",
                  background:
                    "linear-gradient(180deg, rgba(212,168,85,0.08) 0%, rgba(139,92,246,0.08) 100%)",
                }}
              >
                {d && d.primary_lines ? (
                  <HexLines
                    lines={d.primary_lines}
                    changingLines={d.changing_lines ?? []}
                    size="big"
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      width: 200,
                      height: 200,
                      borderRadius: 9999,
                      border: "6px solid #d4a855",
                      background:
                        "linear-gradient(135deg, rgba(212,168,85,0.3) 0%, rgba(139,92,246,0.2) 100%)",
                    }}
                  />
                )}
              </div>

              {/* 右:卦名 + 卦線 */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 24,
                }}
              >
                {hex ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        fontSize: 32,
                        color: "rgba(192,192,208,0.7)",
                        fontWeight: 500,
                      }}
                    >
                      Hexagram {hex.number}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        fontSize: 52,
                        fontWeight: 700,
                        color: "#f0d78c",
                        letterSpacing: 1,
                      }}
                    >
                      {hex.nameEn.split(" (")[0]}
                    </div>
                    {relHex && relatingLines && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 20,
                          marginTop: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            fontSize: 22,
                            color: "rgba(192,192,208,0.6)",
                          }}
                        >
                          Becoming
                        </div>
                        <div
                          style={{
                            display: "flex",
                            color: "rgba(212,168,85,0.6)",
                            fontSize: 28,
                          }}
                        >
                          {">"}
                        </div>
                        <HexLines lines={relatingLines} />
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      fontSize: 44,
                      fontWeight: 700,
                      color: "#f0d78c",
                    }}
                  >
                    Ancient I Ching × AI
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 塔羅三張牌 ── */}
          {isTarot && (
            <div
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 36,
                marginTop: 12,
              }}
            >
              {tarotRender.length === 3 ? (
                tarotRender.map((tc, idx) => {
                  const positionLabel =
                    tc.position === "past"
                      ? "Past"
                      : tc.position === "present"
                      ? "Present"
                      : "Future";
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          fontSize: 20,
                          color: "#d4a855",
                          fontWeight: 700,
                          letterSpacing: 1,
                        }}
                      >
                        {positionLabel}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          width: 200,
                          height: 320,
                          borderRadius: 12,
                          overflow: "hidden",
                          border: "2px solid rgba(212,168,85,0.5)",
                          background: "rgba(13,13,43,0.9)",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tc.imageUrl}
                          alt={tc.card.nameEn}
                          width={200}
                          height={320}
                          style={{
                            width: 200,
                            height: 320,
                            objectFit: "cover",
                            transform: tc.isReversed ? "rotate(180deg)" : "none",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          maxWidth: 200,
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#f0d78c",
                          textAlign: "center",
                          lineHeight: 1.2,
                        }}
                      >
                        {tc.card.nameEn}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          fontSize: 14,
                          color: tc.isReversed
                            ? "#f59e7a"
                            : "rgba(212,168,85,0.8)",
                        }}
                      >
                        {tc.isReversed ? "Reversed" : "Upright"}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    display: "flex",
                    fontSize: 44,
                    fontWeight: 700,
                    color: "#f0d78c",
                  }}
                >
                  Ancient Tarot × AI
                </div>
              )}
            </div>
          )}

          {/* 底部 tagline */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 20,
              borderTop: "1px solid rgba(212,168,85,0.25)",
            }}
          >
            <span style={{ fontSize: 22, color: "rgba(192,192,208,0.75)" }}>
              {isTarot
                ? "Three-card tarot spread × AI interpretation"
                : "Ancient wisdom meets AI divination"}
            </span>
            <span
              style={{
                fontSize: 22,
                color: "#d4a855",
                fontWeight: 600,
              }}
            >
              Tap to view the full reading
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
