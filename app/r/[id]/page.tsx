import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHexagramByNumber } from "@/data/hexagrams";
import { questionCategories } from "@/lib/divination";

/**
 * 公開分享頁 /r/[id]
 *
 * 只顯示 is_public=true 的占卜;其餘(不存在或 private)一律 404。
 * 匿名友善:不露出 user_id / email / display_name。
 * 由 RLS policy "Public divinations are readable by anyone" 確保未登入也讀得到。
 *
 * 同目錄下 opengraph-image.tsx 會自動產 OG 預覽圖,社群貼連結會 unfurl 成卡片。
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PublicDivination {
  id: string;
  question: string;
  category: string;
  hexagram_number: number;
  primary_lines: number[];
  changing_lines: number[];
  relating_hexagram_number: number | null;
  ai_reading: string;
  locale: string;
  created_at: string;
  is_public: boolean;
}

async function loadPublic(id: string): Promise<PublicDivination | null> {
  // UUID 長度檢查 — 擋掉明顯是 bot 亂打的 path
  if (!id || id.length < 16 || id.length > 64) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("divinations")
    .select(
      "id,question,category,hexagram_number,primary_lines,changing_lines,relating_hexagram_number,ai_reading,locale,created_at,is_public"
    )
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as PublicDivination;
}

// ── Metadata (OG tags) ──────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const d = await loadPublic(id);
  if (!d) {
    return {
      title: "易經占卜 | Oracle I Ching",
      description: "古老的易經智慧,AI 為你解讀卦象。",
    };
  }
  const hex = getHexagramByNumber(d.hexagram_number);
  const zh = d.locale !== "en";
  const title = hex
    ? zh
      ? `第 ${hex.number} 卦 ${hex.nameZh} — 易經占卜`
      : `Hexagram ${hex.number}: ${hex.nameEn} — Oracle I Ching`
    : "易經占卜 | Oracle I Ching";
  const description = zh
    ? `問:「${truncate(d.question, 60)}」— 點開看完整解盤 + 為自己占一卦`
    : `Question: "${truncate(d.question, 60)}" — view the full reading and try your own divination.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      // Next.js 會自動把同目錄 opengraph-image.tsx 渲染出的圖注入 og:image
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n).trim() + "…" : s;
}

// ── 靜態卦線(server-safe,不依賴 framer-motion)────────
function StaticHexagram({
  lines,
  changingLines = [],
  size = "md",
}: {
  lines: number[];
  changingLines?: number[];
  size?: "sm" | "md";
}) {
  const s =
    size === "sm"
      ? { w: 90, h: 8, gap: 8, inner: 10 }
      : { w: 140, h: 11, gap: 11, inner: 14 };
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
              <div style={{ display: "flex", gap: s.inner, width: "100%" }}>
                <div style={{ flex: 1, height: s.h, borderRadius: 2, background: bg }} />
                <div style={{ flex: 1, height: s.h, borderRadius: 2, background: bg }} />
              </div>
            )}
            {isChanging && (
              <span
                style={{
                  position: "absolute",
                  right: -20,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#fde68a",
                  fontSize: 12,
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

// ── Page ──────────────────────────────────────────────
export default async function PublicDivinationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await loadPublic(id);
  if (!d) notFound();

  const hex = getHexagramByNumber(d.hexagram_number);
  const relHex =
    d.relating_hexagram_number !== null
      ? getHexagramByNumber(d.relating_hexagram_number)
      : null;
  const cat = questionCategories.find((c) => c.id === d.category);
  const zh = d.locale !== "en";
  const t = (zhText: string, enText: string) => (zh ? zhText : enText);

  // 之卦 lines: 本卦 lines XOR changing_lines index
  const relatingLines =
    d.changing_lines && d.changing_lines.length > 0
      ? d.primary_lines.map((line, i) =>
          d.changing_lines.includes(i) ? (line === 1 ? 0 : 1) : line
        )
      : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* 簡易 Header — 不用 client-side Header 元件,保持 server render */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(10,10,26,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(212,168,85,0.15)",
        }}
      >
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#d4a855",
              textDecoration: "none",
              fontWeight: 700,
              letterSpacing: 1,
              fontFamily: "'Noto Serif TC', serif",
            }}
          >
            <span style={{ fontSize: 22 }}>☯</span>
            <span>{t("易經占卜", "Oracle I Ching")}</span>
          </Link>
          <Link
            href="/"
            className="btn-gold"
            style={{ fontSize: 13, padding: "8px 16px" }}
          >
            {t("我也要占卜", "Try your own")}
          </Link>
        </div>
      </header>

      <main
        style={{
          maxWidth: 680,
          margin: "0 auto",
          padding: "32px 16px 64px",
        }}
      >
        {/* 卦象卡 */}
        {hex && (
          <div className="mystic-card" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 72, marginBottom: 8 }}>{hex.character}</div>
            <h1
              className="text-gold-gradient"
              style={{
                fontSize: 26,
                fontFamily: "'Noto Serif TC', serif",
                margin: 0,
              }}
            >
              {t(`第 ${hex.number} 卦 ${hex.nameZh}`, `Hexagram ${hex.number}: ${hex.nameEn}`)}
            </h1>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 28,
                marginTop: 24,
              }}
            >
              <div>
                <StaticHexagram
                  lines={d.primary_lines}
                  changingLines={d.changing_lines}
                  size={relHex ? "sm" : "md"}
                />
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 12 }}>
                  {t("本卦", "Primary")}
                </p>
              </div>
              {relHex && relatingLines && (
                <>
                  <div style={{ color: "rgba(212,168,85,0.4)", fontSize: 22 }}>→</div>
                  <div>
                    <StaticHexagram lines={relatingLines} size="sm" />
                    <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 12 }}>
                      {t(`之卦 ${relHex.nameZh}`, `Relating: ${relHex.nameEn}`)}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 類別 + 問題(匿名,不露使用者資訊)*/}
        <div className="mystic-card" style={{ padding: 24, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, color: "#d4a855" }}>
            <span style={{ fontSize: 22 }}>{cat?.icon ?? "🔮"}</span>
            <span style={{ fontSize: 14 }}>
              {cat ? (zh ? cat.nameZh : cat.nameEn) : t("綜合", "General")}
            </span>
          </div>
          <p
            style={{
              color: "#e8e8f0",
              fontSize: 16,
              lineHeight: 1.7,
              fontStyle: "italic",
              margin: 0,
              fontFamily: "'Noto Serif TC', serif",
            }}
          >
            「{d.question}」
          </p>
        </div>

        {/* 卦辭 */}
        {hex && (
          <div className="mystic-card" style={{ padding: 24, marginTop: 16 }}>
            <h3
              style={{
                fontSize: 15,
                fontFamily: "'Noto Serif TC', serif",
                color: "#d4a855",
                marginBottom: 10,
              }}
            >
              {t("卦辭", "Judgment")}
            </h3>
            <p
              style={{
                color: "#e8e8f0",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "'Noto Serif TC', serif",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              {zh ? hex.judgmentZh : hex.judgmentEn}
            </p>
            {zh && hex.judgmentVernacularZh && (
              <p
                style={{
                  color: "rgba(192,192,208,0.8)",
                  fontSize: 13,
                  lineHeight: 1.8,
                  marginTop: 8,
                }}
              >
                {hex.judgmentVernacularZh}
              </p>
            )}
          </div>
        )}

        {/* 象辭 */}
        {hex && (
          <div className="mystic-card" style={{ padding: 24, marginTop: 16 }}>
            <h3
              style={{
                fontSize: 15,
                fontFamily: "'Noto Serif TC', serif",
                color: "#d4a855",
                marginBottom: 10,
              }}
            >
              {t("象辭", "Image")}
            </h3>
            <p
              style={{
                color: "#e8e8f0",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "'Noto Serif TC', serif",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              {zh ? hex.imageZh : hex.imageEn}
            </p>
            {zh && hex.imageVernacularZh && (
              <p
                style={{
                  color: "rgba(192,192,208,0.8)",
                  fontSize: 13,
                  lineHeight: 1.8,
                  marginTop: 8,
                }}
              >
                {hex.imageVernacularZh}
              </p>
            )}
          </div>
        )}

        {/* AI 解盤 */}
        <div
          className="mystic-card"
          style={{ padding: 24, marginTop: 16, borderLeft: "3px solid #d4a855" }}
        >
          <h3
            style={{
              fontSize: 15,
              fontFamily: "'Noto Serif TC', serif",
              color: "#d4a855",
              marginBottom: 10,
            }}
          >
            ✦ {t("老師解盤", "Master's Reading")}
          </h3>
          <div
            style={{
              color: "rgba(192,192,208,0.9)",
              fontSize: 14,
              lineHeight: 1.85,
              whiteSpace: "pre-wrap",
              fontFamily: "'Noto Sans TC', sans-serif",
            }}
          >
            {d.ai_reading}
          </div>
        </div>

        {/* CTA — 引導訪客自己占卜 */}
        <div
          className="mystic-card"
          style={{
            padding: 28,
            marginTop: 24,
            textAlign: "center",
            background:
              "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(139,92,246,0.05))",
          }}
        >
          <p
            style={{
              color: "rgba(192,192,208,0.8)",
              fontSize: 15,
              marginBottom: 14,
              fontFamily: "'Noto Serif TC', serif",
              lineHeight: 1.6,
            }}
          >
            {t("心中有疑惑?為自己占一卦。", "Got a question? Cast your own divination.")}
          </p>
          <Link
            href="/"
            className="btn-gold"
            style={{ fontSize: 15, padding: "12px 32px" }}
          >
            {t("開始占卜", "Begin Divination")}
          </Link>
          <p
            style={{
              color: "rgba(192,192,208,0.4)",
              fontSize: 11,
              marginTop: 16,
              margin: "16px 0 0 0",
            }}
          >
            {t(
              "古老的易經智慧 × AI 解盤 · 心誠則靈",
              "Ancient I Ching wisdom × AI interpretation"
            )}
          </p>
        </div>

        {/* footer 小字 — 日期 */}
        <p
          style={{
            color: "rgba(192,192,208,0.3)",
            fontSize: 11,
            textAlign: "center",
            marginTop: 20,
          }}
        >
          {t("占卜日期", "Divined on")}:{" "}
          {new Date(d.created_at).toISOString().slice(0, 10)}
        </p>
      </main>
    </div>
  );
}
