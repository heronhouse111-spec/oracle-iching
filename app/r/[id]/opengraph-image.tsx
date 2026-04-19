import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getHexagramByNumber } from "@/data/hexagrams";

/**
 * OG image for /r/[id] public share page.
 *
 * 渲染引擎 Satori 沒有內建 CJK 字型,所以這張圖刻意設計成視覺優先:
 * 卦象字元 + 卦線 + 阿拉伯數字 + 英文字(這些都有系統 fallback 字型)。
 * 中文卦名只在頁面本體用(HTML + 真正的 web font 會渲染正常)。
 *
 * 如果之後要在 OG 圖加中文,需 bundle Noto Sans TC TTF 進 assets/ 再透過
 * readFile + fonts[] 載入(參考 Next.js ImageResponse 文件)。
 */

export const alt = "Oracle I Ching — 易經占卜";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface D {
  hexagram_number: number;
  primary_lines: number[];
  changing_lines: number[];
  relating_hexagram_number: number | null;
  is_public: boolean;
}

async function loadPublic(id: string): Promise<D | null> {
  if (!id || id.length < 16 || id.length > 64) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("divinations")
    .select(
      "hexagram_number,primary_lines,changing_lines,relating_hexagram_number,is_public"
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
}: {
  lines: number[];
  changingLines?: number[];
}) {
  const display = [...lines].reverse();
  const changingDisplay = changingLines.map((i) => 5 - i);
  const W = 160;
  const H = 14;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
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
                borderRadius: 2,
                background: bg,
              }}
            />
          );
        }
        return (
          <div key={idx} style={{ display: "flex", gap: 18, width: W }}>
            <div style={{ display: "flex", flex: 1, height: H, borderRadius: 2, background: bg }} />
            <div style={{ display: "flex", flex: 1, height: H, borderRadius: 2, background: bg }} />
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
  const hex = d ? getHexagramByNumber(d.hexagram_number) : null;

  // 之卦 lines
  const relatingLines =
    d && d.changing_lines && d.changing_lines.length > 0
      ? d.primary_lines.map((line, i) =>
          d.changing_lines.includes(i) ? (line === 1 ? 0 : 1) : line
        )
      : null;
  const relHex =
    d && d.relating_hexagram_number !== null
      ? getHexagramByNumber(d.relating_hexagram_number)
      : null;

  // 沒資料就退成一張通用的 brand OG 圖(不會 404 OG endpoint,
  // 避免 Line/Twitter 顯示 broken image placeholder)
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
              <span style={{ fontSize: 48, color: "#d4a855" }}>☯</span>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#d4a855",
                  letterSpacing: 2,
                }}
              >
                Oracle I Ching
              </span>
            </div>
            <span style={{ fontSize: 20, color: "rgba(192,192,208,0.6)" }}>
              oracle.heronhouse.me
            </span>
          </div>

          {/* 主卦象 */}
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
            {/* 左:大卦象字元 */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 260,
                  color: "#d4a855",
                  lineHeight: 1,
                  textShadow:
                    "0 0 40px rgba(212,168,85,0.5), 0 0 80px rgba(212,168,85,0.3)",
                }}
              >
                {hex ? hex.character : "☯"}
              </div>
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 28,
                      marginTop: 8,
                    }}
                  >
                    <HexLines
                      lines={d!.primary_lines}
                      changingLines={d!.changing_lines}
                    />
                    {relHex && relatingLines && (
                      <>
                        <div
                          style={{
                            display: "flex",
                            color: "rgba(212,168,85,0.5)",
                            fontSize: 36,
                          }}
                        >
                          →
                        </div>
                        <HexLines lines={relatingLines} />
                      </>
                    )}
                  </div>
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
              ✦ Ancient wisdom meets AI divination
            </span>
            <span
              style={{
                fontSize: 22,
                color: "#d4a855",
                fontWeight: 600,
              }}
            >
              Tap to view the full reading →
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
