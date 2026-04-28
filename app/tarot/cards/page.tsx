import type { Metadata } from "next";
import Header from "@/components/Header";
import TarotCardsIndexView from "./TarotCardsIndexView";

export const metadata: Metadata = {
  title: "78 張塔羅牌牌意百科 · Tarot Cards Encyclopedia | Tarogram",
  description:
    "Rider-Waite-Smith 78 張塔羅牌完整牌意,正逆位、關鍵字、適用情境。Complete Rider-Waite-Smith tarot card meanings, upright & reversed.",
  alternates: { canonical: "/tarot/cards" },
  openGraph: {
    title: "78 張塔羅牌牌意百科 · Tarot Cards Encyclopedia",
    description:
      "Complete tarot card meanings — Major Arcana 22, Minor Arcana 56. Upright & reversed.",
  },
};

export default function TarotCardsIndexPage() {
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <TarotCardsIndexView />
    </main>
  );
}
