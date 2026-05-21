import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Global default OG image — 用在首頁 `/` 以及任何沒有自己 opengraph-image 的路由。
 * 結構跟 `/r/[id]/opengraph-image.tsx` 類似,但是不需要讀 DB,
 * 就是把 Delphic Oracle 徽章 + 中央標語整成一張 unfurl 縮圖。
 *
 * Satori 沒有 CJK 字型,英文標語為主,中文字元一律避開或用 logo 圖本體承載。
 */

export const alt = "Tarogram — I Ching × Tarot × AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export const dynamic = "force-static";
export const runtime = "nodejs";

export default async function Image() {
  let logoDataUri: string | null = null;
  try {
    const logoBuf = await readFile(
      join(process.cwd(), "public", "logo-512.png")
    );
    logoDataUri = `data:image/png;base64,${logoBuf.toString("base64")}`;
  } catch {
    // 讀不到就 fallback CSS 圓圈
  }

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
            top: -180,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: 9999,
            background: "rgba(212,168,85,0.22)",
            filter: "blur(90px)",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: -140,
            left: -100,
            width: 440,
            height: 440,
            borderRadius: 9999,
            background: "rgba(139,92,246,0.25)",
            filter: "blur(90px)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 72px",
            width: "100%",
            height: "100%",
            position: "relative",
            gap: 28,
          }}
        >
          {logoDataUri ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoDataUri}
              alt="Tarogram"
              width={360}
              height={360}
              style={{
                width: 360,
                height: 360,
                borderRadius: 9999,
                display: "block",
                boxShadow: "0 0 80px rgba(212,168,85,0.4)",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 360,
                height: 360,
                borderRadius: 9999,
                border: "6px solid #d4a855",
                background:
                  "linear-gradient(135deg, rgba(212,168,85,0.3) 0%, rgba(139,92,246,0.2) 100%)",
              }}
            />
          )}

          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              color: "#f0d78c",
              letterSpacing: 6,
            }}
          >
            ORACLE
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "rgba(192,192,208,0.85)",
              letterSpacing: 2,
            }}
          >
            I Ching · Tarot · AI Divination
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 20,
              color: "#d4a855",
              marginTop: 12,
              letterSpacing: 4,
            }}
          >
            heronhouse.me
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
