import type { Metadata } from "next";
import Header from "@/components/Header";
import { getUiImages } from "@/lib/uiImages";
import TarotSpreadIndexView from "./TarotSpreadIndexView";

export const metadata: Metadata = {
  title: "塔羅牌陣大全 · Tarot Spreads | Tarogram 易問",
  description:
    "從三牌時間軸到凱爾特十字,五大經典塔羅牌陣完整解析:適合的問題、位置意義、實際操作。",
  alternates: { canonical: "/tarot-spread" },
  openGraph: {
    title: "塔羅牌陣大全 · Tarot Spreads",
    description: "Five classic tarot spreads — three-card, two-options, love cross, Celtic cross, yearly 12.",
  },
};

export default async function TarotSpreadIndexPage() {
  const uiImages = await getUiImages();
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <TarotSpreadIndexView uiImages={uiImages} />
    </main>
  );
}
