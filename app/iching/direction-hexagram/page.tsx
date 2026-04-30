import type { Metadata } from "next";
import Header from "@/components/Header";
import { getIchingImages } from "@/lib/ichingImages";
import DirectionHexagramFlowView from "./DirectionHexagramFlowView";

export const metadata: Metadata = {
  title: "方位卦象合參占卜 · Direction × Hexagram | Tarogram",
  description:
    "兩段式占法 — 先卜方位定「事之所在」,再卜卦象明「事之走向」,合參出更立體的解讀。",
  alternates: { canonical: "/iching/direction-hexagram" },
  openGraph: {
    title: "方位卦象合參占卜 · Tarogram",
    description:
      "Two-stage I Ching reading: spin a compass for the direction, then cast the hexagram, and read both together.",
  },
};

export default async function DirectionHexagramFlowPage() {
  // 用同一支 server-side reader 撈八卦圖,跟 /iching/hexagrams 共用 cache。
  // 拿不到就傳空 map,client view 會 fallback 到 Unicode 卦符。
  const images = await getIchingImages();

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <DirectionHexagramFlowView images={images} />
    </main>
  );
}
