"use client";

/**
 * /privacy — 隱私權政策頁
 *
 * Google Play 2023+ 上架必要(Data Safety 會要求一個 URL),
 * 同時也是 GDPR / 台灣個資法的通用基本盤。內容對應目前實際行為:
 *   - 蒐集項目:email / OAuth 基本資料 / 占卜問題 & 結果 / chat / IP & UA
 *   - 存儲:第三方雲端資料庫,亞太區(不指名廠商,未來換商更彈性)
 *   - 第三方(category-level):登入驗證(Google OAuth)、AI 服務商、雲端基礎設施
 *   - 行使權利:/account/delete 即時刪帳號 + 資料
 *
 * 內容 JSON 化(data/legal/privacy.{zh,en,ja,ko}.json)→ 5 語系統一支撐,
 * ja/ko 由 scripts/translate-static-data.mjs 跑 DeepSeek 補翻譯。
 */
import Link from "next/link";
import Header from "@/components/Header";
import LegalDocView from "@/components/LegalDocView";
import { useLanguage } from "@/i18n/LanguageContext";
import zhDoc from "@/data/legal/privacy.zh.json";
import enDoc from "@/data/legal/privacy.en.json";
import jaDoc from "@/data/legal/privacy.ja.json";
import koDoc from "@/data/legal/privacy.ko.json";
import type { LegalDoc } from "@/data/legal/types";

export default function PrivacyPage() {
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
