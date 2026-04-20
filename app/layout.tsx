import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Footer from "@/components/Footer";

// metadataBase 讓 OG/twitter 圖路徑可以用相對 URL — Next 16 建議要設
const siteUrl = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://oracle.heronhouse.me";
})();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Oracle 神諭 | 易經 × 塔羅 · AI 占卜",
  description:
    "東方易經 · 西方塔羅 · AI 即時解盤。Eastern I Ching meets Western Tarot, with AI-powered interpretations.",
  // Next 16 會自動 pick up app/icon.png + app/apple-icon.png,
  // 但明確寫出來對 SEO crawler 比較保險
  icons: {
    icon: [
      { url: "/icon", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    type: "website",
    siteName: "Oracle 神諭",
    title: "Oracle 神諭 | 易經 × 塔羅 · AI 占卜",
    description:
      "東方易經 · 西方塔羅 · AI 即時解盤。Ancient wisdom meets AI divination.",
    url: siteUrl,
    // app/opengraph-image.tsx 會被 Next 自動掛到這;顯式宣告 width/height 讓社群不抓錯
  },
  twitter: {
    card: "summary_large_image",
    title: "Oracle 神諭 | 易經 × 塔羅 · AI 占卜",
    description: "Ancient wisdom meets AI divination.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;700;900&family=Noto+Sans+TC:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-stars" style={{ minHeight: "100vh" }}>
        <LanguageProvider>
          {children}
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
