import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { SPREADS, getSpread, spreadImageSlot } from "@/data/spreads";
import { getUiImages } from "@/lib/uiImages";
import TarotSpreadDetailView from "./TarotSpreadDetailView";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return SPREADS.map((s) => ({ slug: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = SPREADS.find((s) => s.id === slug);
  if (!found) return { title: "Spread not found" };

  return {
    title: `${found.nameZh}（${found.nameEn}）· 塔羅牌陣解析 | Tarogram`,
    description: `${found.taglineZh} ${found.whenZh.slice(0, 80)}…`,
    alternates: { canonical: `/tarot-spread/${found.id}` },
    openGraph: {
      title: `${found.nameZh} · ${found.nameEn} — Tarogram`,
      description: found.taglineZh,
    },
  };
}

export default async function TarotSpreadSlugPage({ params }: Props) {
  const { slug } = await params;
  const spread = getSpread(slug);
  if (spread.id !== slug) notFound();

  const uiImages = await getUiImages();
  const heroImage = uiImages[spreadImageSlot(spread.id)];

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <TarotSpreadDetailView spread={spread} heroImage={heroImage} />
    </main>
  );
}
