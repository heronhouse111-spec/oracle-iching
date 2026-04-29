import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Footer from "@/components/Footer";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import InstallPrompt from "@/components/InstallPrompt";
import GoogleOneTap from "@/components/GoogleOneTap";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { UiImagesProvider } from "@/hooks/useUiImages";
import { getUiImages } from "@/lib/uiImages";
import { getServerLocale, pickByLocale } from "@/lib/serverLocale";

// metadataBase 讓 OG/twitter 圖路徑可以用相對 URL — Next 16 建議要設
const siteUrl = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://tarogram.heronhouse.me";
})();

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerLocale();
  const title = pickByLocale(
    locale,
    "Tarogram 易問 | 易經 × 塔羅 · AI 占卜",
    "Tarogram | I Ching × Tarot · AI Readings",
    "Tarogram 易問 | 易経 × タロット · AI 占い",
    "Tarogram 타로그램 | 주역 × 타로 · AI 점"
  );
  const description = pickByLocale(
    locale,
    "東方易經 · 西方塔羅 · AI 即時解盤。",
    "Eastern I Ching meets Western Tarot, with AI-powered interpretations.",
    "東洋の易経 × 西洋のタロット × AI 即時解読。",
    "동양의 주역 × 서양의 타로 × AI 즉시 해석."
  );
  const appleTitle = pickByLocale(
    locale,
    "Tarogram 易問",
    "Tarogram",
    "Tarogram 易問",
    "Tarogram 타로그램"
  );
  const siteName = appleTitle;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    // PWA manifest —— 讓 Chrome / Android 提示「加到主畫面」,同時也是 Bubblewrap TWA 打包前置
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      title: appleTitle,
      statusBarStyle: "black-translucent",
    },
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
      siteName,
      title,
      description,
      url: siteUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// Next 16:themeColor / viewport 要獨立 export,寫進 metadata 會被警告
export const viewport: Viewport = {
  themeColor: "#0a0a1a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ui_images 在 server 階段就讀好,經由 UiImagesProvider 注入 React context。
  // 用意:避免「emoji fallback → 圖片 swap」的視覺閃爍 — SSR 第一次 paint 就有正確 url。
  const uiImages = await getUiImages();
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
          <UiImagesProvider images={uiImages}>
            <AnnouncementBanner />
            {children}
            <Footer />
            {/* PWA:註冊 SW + 跳「加入主畫面」提示。兩者皆 client-only,SSR 階段返回 null。 */}
            <ServiceWorkerRegister />
            <InstallPrompt />
            {/* Google One Tap — 未登入時自動跳「以 xxx 身份繼續」,iPhone/iPad 也能秒登 */}
            <GoogleOneTap />
          </UiImagesProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
