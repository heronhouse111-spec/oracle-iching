import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Oracle 神諭 | 易經 × 塔羅 · AI 占卜",
  description: "東方易經 · 西方塔羅 · AI 即時解盤。Eastern I Ching meets Western Tarot, with AI-powered interpretations.",
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
