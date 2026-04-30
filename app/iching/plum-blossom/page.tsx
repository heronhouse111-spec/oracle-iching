import type { Metadata } from "next";
import Header from "@/components/Header";
import { getIchingImages } from "@/lib/ichingImages";
import PlumBlossomFlowView from "./PlumBlossomFlowView";

export const metadata: Metadata = {
  title: "梅花易數 · 時間起卦 | Tarogram",
  description:
    "宋代邵雍創 — 不擲銅錢、不算籤,直接用問事當下的時間起卦。AI 為你解本卦氣象、動爻時機、之卦走勢。",
  alternates: { canonical: "/iching/plum-blossom" },
  openGraph: {
    title: "梅花易數 · 時間起卦 | Tarogram",
    description:
      "Plum Blossom Numerology — cast the I Ching from the moment you ask, no coins required.",
  },
};

export default async function PlumBlossomFlowPage() {
  const images = await getIchingImages();
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <PlumBlossomFlowView images={images} />
    </main>
  );
}
