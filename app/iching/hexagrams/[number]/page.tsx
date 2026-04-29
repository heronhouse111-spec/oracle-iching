import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import {
  hexagrams,
  getHexagramByNumber,
} from "@/data/hexagrams";
import { getIchingImages, hexagramImageKey } from "@/lib/ichingImages";
import HexagramDetailView from "./HexagramDetailView";

interface Props {
  params: Promise<{ number: string }>;
}

export async function generateStaticParams() {
  return hexagrams.map((h) => ({ number: String(h.number) }));
}

function parseNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 64) return null;
  return n;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params;
  const num = parseNumber(number);
  if (!num) return { title: "Hexagram not found" };
  const h = getHexagramByNumber(num);
  if (!h) return { title: "Hexagram not found" };
  return {
    title: `第 ${h.number} 卦 ${h.nameZh}（${h.nameEn}）· 卦辭白話 | Tarogram`,
    description: `${h.judgmentZh} ${h.judgmentVernacularZh.slice(0, 80)}…`,
    alternates: { canonical: `/iching/hexagrams/${h.number}` },
    openGraph: {
      title: `第 ${h.number} 卦 ${h.nameZh} · ${h.nameEn}`,
      description: h.judgmentVernacularZh.slice(0, 140),
    },
  };
}

// Page = 純 server shell:撈 hexagram + image url 後丟給 client view 渲染。
// 這樣切換語系時 React state 直接更新,不必 router.refresh() 等 RSC roundtrip。
export default async function IChingHexagramDetailPage({ params }: Props) {
  const { number } = await params;
  const num = parseNumber(number);
  if (!num) notFound();
  const hex = getHexagramByNumber(num);
  if (!hex) notFound();

  const images = await getIchingImages();
  const heroUrl = images[hexagramImageKey(hex.number)];

  const prevHex = hex.number > 1 ? getHexagramByNumber(hex.number - 1) : null;
  const nextHex = hex.number < 64 ? getHexagramByNumber(hex.number + 1) : null;
  const prev = prevHex
    ? {
        number: prevHex.number,
        nameZh: prevHex.nameZh,
        nameEn: prevHex.nameEn,
        nameJa: prevHex.nameJa,
        nameKo: prevHex.nameKo,
      }
    : null;
  const next = nextHex
    ? {
        number: nextHex.number,
        nameZh: nextHex.nameZh,
        nameEn: nextHex.nameEn,
        nameJa: nextHex.nameJa,
        nameKo: nextHex.nameKo,
      }
    : null;

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <HexagramDetailView hexagram={hex} heroUrl={heroUrl} prev={prev} next={next} />
    </main>
  );
}
