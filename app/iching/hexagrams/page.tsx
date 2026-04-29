import type { Metadata } from "next";
import Header from "@/components/Header";
import { getIchingImages } from "@/lib/ichingImages";
import { getServerLocale, pickByLocale } from "@/lib/serverLocale";
import HexagramsIndexView from "./HexagramsIndexView";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerLocale();
  const title = pickByLocale(
    locale,
    "易經 64 卦完整介紹 | Tarogram 易問",
    "I Ching Hexagrams Encyclopedia | Tarogram",
    "易経 64卦 完全解説 | Tarogram",
    "주역 64괘 백과 | Tarogram"
  );
  const description = pickByLocale(
    locale,
    "易經 64 卦完整解析:卦辭、象辭原文與白話翻譯,搭配卦象圖。從上經乾坤到下經既濟未濟,逐卦深入結構與時機的智慧。",
    "Complete I Ching encyclopedia — classical judgments, images, and modern translations for all 64 hexagrams. From Qian/Kun to Ji-Ji/Wei-Ji.",
    "易経64卦の完全解説：原文の卦辞・象辞と現代訳、各卦の図像を併載。乾坤から既済未済まで、構造と時機の知恵を詳細に。",
    "주역 64괘 완벽 해설: 원문 괘사·상사와 현대 번역, 괘상 도해를 함께. 건곤에서 기제·미제까지 구조와 시기의 지혜를 세밀하게."
  );
  return {
    title,
    description,
    alternates: { canonical: "/iching/hexagrams" },
    openGraph: { title, description },
  };
}

export default async function IChingHexagramsIndexPage() {
  const images = await getIchingImages();
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <HexagramsIndexView images={images} />
    </main>
  );
}
