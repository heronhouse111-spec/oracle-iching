import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Footer from "@/components/Footer";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import InstallPrompt from "@/components/InstallPrompt";
import GoogleOneTap from "@/components/GoogleOneTap";

// metadataBase 讓 OG/twitter 圖路徑可以用相對 URL — Next 16 建議要設
const siteUrl = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://tarogram.heronhouse.me";
})();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Tarogram 易問 | 易經 × 塔羅 · AI 占卜",
  description:
    "東方易經 · 西方塔羅 · AI 即時解盤。Eastern I Ching meets Western Tarot, with AI-powered interpretations.",
  // PWA manifest —— 讓 Chrome / Android 提示「加到主畫面」,同時也是 Bubblewrap TWA 打包前置
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Tarogram 易問",
    statusBarStyle: "black-translucent",
  },
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
    siteName: "Tarogram 易問",
    title: "Tarogram 易問 | 易經 × 塔羅 · AI 占卜",
    description:
      "東方易經 · 西方塔羅 · AI 即時解盤。Ancient wisdom meets AI divination.",
    url: siteUrl,
    // app/opengraph-image.tsx 會被 Next 自動掛到這;顯式宣告 width/height 讓社群不抓錯
  },
  twitter: {
    card: "summary_large_image",
    title: "Tarogram 易問 | 易經 × 塔羅 · AI 占卜",
    description: "Ancient wisdom meets AI divination.",
  },
};

// Next 16:themeColor / viewport 要獨立 export,寫進 metadata 會被警告
export const viewport: Viewport = {
  themeColor: "#0a0a1a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
          {/* PWA:註冊 SW + 跳「加入主畫面」提示。兩者皆 client-only,SSR 階段返回 null。 */}
          <ServiceWorkerRegister />
          <InstallPrompt />
          {/* Google One Tap — 未登入時自動跳「以 xxx 身份繼續」,iPhone/iPad 也能秒登 */}
          <GoogleOneTap />
        </LanguageProvider>
      </body>
    </html>
  );
}
