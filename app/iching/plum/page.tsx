import type { Metadata } from "next";
import Header from "@/components/Header";
import PlumFlowView from "./PlumFlowView";

export const metadata: Metadata = {
  title: "梅花易數 · 時間起卦 | Tarogram",
  description:
    "宋代邵雍創,以當下年月日時分起卦。一鍵卜卦,公式攤開可見,本卦動爻之卦合參 AI 解讀。",
  alternates: { canonical: "/iching/plum" },
  openGraph: {
    title: "梅花易數 · 時間起卦 · Tarogram",
    description:
      "Plum Blossom Numerology · time-based casting. Cast a hexagram from this very moment, with the formula laid bare.",
  },
};

export default function PlumFlowPage() {
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <PlumFlowView />
    </main>
  );
}
