import type { Metadata } from "next";
import Header from "@/components/Header";
import { getIchingImages } from "@/lib/ichingImages";
import HexagramsIndexView from "./HexagramsIndexView";

export const metadata: Metadata = {
  title: "易經 64 卦完整介紹 · I Ching Hexagrams Encyclopedia | Tarogram 易問",
  description:
    "易經 64 卦完整解析:卦辭、象辭原文與白話翻譯,搭配卦象圖。從上經乾坤到下經既濟未濟,逐卦深入結構與時機的智慧。",
  alternates: { canonical: "/iching/hexagrams" },
  openGraph: {
    title: "易經 64 卦完整介紹 · Tarogram",
    description:
      "Complete I Ching encyclopedia — judgments, images, and vernacular translations for all 64 hexagrams.",
  },
};

export default async function IChingHexagramsIndexPage() {
  const images = await getIchingImages();
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <HexagramsIndexView images={images} />
    </main>
  );
}
