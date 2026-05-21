"use client";

/**
 * /categories — 問事類別選擇頁
 *
 * 從首頁的「易經占卜 / 塔羅占卜」CTA 點過來,帶 ?type=iching|tarot,
 * 顯示分類 grid。選一個 → 帶 ?type & ?category 跳回首頁,
 * 首頁的 mount effect 會把 state 寫好 + step 跳到 "question"。
 *
 * 為什麼搬出首頁:首頁原本把分類 grid 塞在同一個 step="category" section 裡,
 * 視覺上是「往下捲」,使用者誤以為分類被埋很深、易經/塔羅 CTA 也容易誤點。
 * 現在改成獨立路由 — 一個畫面只做一件事。
 */

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useLanguage } from "@/i18n/LanguageContext";
import { useUiImages } from "@/hooks/useUiImages";
import { questionCategories } from "@/lib/divination";

type DivineType = "iching" | "tarot" | null;

function HeroImage({
  url,
  aspectRatio = "4/3",
}: {
  url: string | undefined;
  aspectRatio?: string;
}) {
  if (!url) return null;
  return (
    <div
      style={{
        width: "100%",
        aspectRatio,
        background:
          "linear-gradient(135deg, rgba(212,168,85,0.10), rgba(13,13,43,0.45))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

export default function CategoriesPage() {
  const { t } = useLanguage();
  const uiImages = useUiImages();
  const [type, setType] = useState<DivineType>(null);

  // Mount-only:讀 ?type=,client-only(URLSearchParams 在 SSR 沒值)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tp = params.get("type");
    if (tp === "iching" || tp === "tarot") {
      setType(tp);
    }
  }, []);

  const typeLabel =
    type === "iching"
      ? t("易經占卜", "I Ching", "易経占い", "주역 점")
      : type === "tarot"
        ? t("塔羅占卜", "Tarot", "タロット占い", "타로 점")
        : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <main
        style={{
          paddingTop: 88,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/"
            style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", textDecoration: "none" }}
          >
            ← {t("回首頁", "Home", "ホームへ", "홈으로")}
          </Link>
        </div>

        <header style={{ textAlign: "center", marginBottom: 24 }}>
          {typeLabel && (
            <div
              style={{
                display: "inline-block",
                padding: "4px 14px",
                borderRadius: 999,
                background: "rgba(212,168,85,0.12)",
                border: "1px solid rgba(212,168,85,0.35)",
                color: "#d4a855",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              ✦ {typeLabel}
            </div>
          )}
          <h1
            className="text-gold-gradient"
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 24,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {t("選擇問事類別", "Pick a Topic", "テーマを選ぶ", "주제 선택")}
          </h1>
          <p
            style={{
              color: "rgba(192,192,208,0.7)",
              fontSize: 13,
              marginTop: 10,
              lineHeight: 1.7,
              maxWidth: 420,
              margin: "10px auto 0",
            }}
          >
            {t(
              "挑一個你想問的方向,接著輸入你的問題。",
              "Pick a topic, then enter your question.",
              "聞きたいテーマを一つ選び、続いて質問を入力します。",
              "묻고 싶은 주제를 고른 뒤 질문을 입력하세요."
            )}
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {questionCategories.map((cat) => {
            const href = type
              ? `/?type=${type}&category=${cat.id}`
              : `/?category=${cat.id}`;
            return (
              <Link
                key={cat.id}
                href={href}
                style={categoryCardStyle}
              >
                <HeroImage url={uiImages[`category.${cat.id}`]} aspectRatio="4/3" />
                <div style={{ padding: "10px 8px 12px", textAlign: "center" }}>
                  <span style={{ color: "#d4a855", fontWeight: 600, fontSize: 14 }}>
                    {t(cat.nameZh, cat.nameEn, cat.nameJa, cat.nameKo)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

const categoryCardStyle: CSSProperties = {
  display: "block",
  padding: 0,
  textDecoration: "none",
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid rgba(212,168,85,0.2)",
  background: "rgba(13,13,43,0.8)",
  fontFamily: "inherit",
};
