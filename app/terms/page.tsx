"use client";

/**
 * /terms — 服務條款與免責聲明
 *
 * 內容 JSON 化(data/legal/terms.{zh,en,ja,ko}.json)→ 5 語系統一支撐,
 * ja/ko 由 scripts/translate-static-data.mjs 跑 DeepSeek 補翻譯。
 */
import Link from "next/link";
import Header from "@/components/Header";
import LegalDocView from "@/components/LegalDocView";
import { useLanguage } from "@/i18n/LanguageContext";
import zhDoc from "@/data/legal/terms.zh.json";
import enDoc from "@/data/legal/terms.en.json";
import jaDoc from "@/data/legal/terms.ja.json";
import koDoc from "@/data/legal/terms.ko.json";
import type { LegalDoc } from "@/data/legal/types";

export default function TermsPage() {
  const { locale, t, cn } = useLanguage();

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />

      <main
        style={{
          paddingTop: 88,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/"
            style={{
              color: "rgba(212,168,85,0.8)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← {t("返回首頁", "Back to home", "ホームへ戻る", "홈으로 돌아가기")}
          </Link>
        </div>

        <LegalDocView
          zh={zhDoc as LegalDoc}
          en={enDoc as LegalDoc}
          ja={jaDoc as LegalDoc}
          ko={koDoc as LegalDoc}
          locale={locale}
          cn={cn}
        />
      </main>
    </div>
  );
}
