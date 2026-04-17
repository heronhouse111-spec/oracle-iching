import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/i18n/LanguageContext";

export const metadata: Metadata = {
  title: "易經占卜 | Oracle I Ching",
  description: "透過古老的易經智慧，結合 AI 為你解讀卦象。Ancient I Ching wisdom with AI-powered interpretations.",
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
        </LanguageProvider>
      </body>
    </html>
  );
}
