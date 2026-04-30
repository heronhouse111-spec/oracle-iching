import type { Metadata } from "next";
import Header from "@/components/Header";
import DirectionHexagramMethodView from "./DirectionHexagramMethodView";

export const metadata: Metadata = {
  title: "方位卦象合參占卜 · Direction × Hexagram Combined | Tarogram",
  description:
    "結合後天八卦方位與六十四卦的兩段式占法 — 先卜方位定「事之所在」,再卜卦象明「事之走向」,合參出更立體的解讀。",
  alternates: { canonical: "/iching/methods/direction-hexagram" },
  openGraph: {
    title: "方位卦象合參占卜 · Tarogram",
    description:
      "A two-stage I Ching method: divine the direction first, then the hexagram, and read both together.",
  },
};

export default function DirectionHexagramMethodPage() {
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <DirectionHexagramMethodView />
    </main>
  );
}
