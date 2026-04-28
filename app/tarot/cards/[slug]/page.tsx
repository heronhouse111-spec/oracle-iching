import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  tarotDeck,
  getCardById,
  SUIT_NAMES_ZH,
} from "@/data/tarot";
import Header from "@/components/Header";
import TarotCardDetailView from "./TarotCardDetailView";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return tarotDeck.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = getCardById(slug);
  if (!card) return { title: "Card not found" };

  const title = `${card.nameZh}（${card.nameEn}）牌意 · ${SUIT_NAMES_ZH[card.suit]}`;
  const description = `${card.nameZh}(${card.nameEn})正逆位牌意、關鍵字、適用情境完整解析。${card.uprightMeaningZh.slice(0, 80)}…`;

  return {
    title: `${title} | Tarogram 易問`,
    description,
    alternates: { canonical: `/tarot/cards/${card.id}` },
    openGraph: {
      title: `${card.nameZh} · ${card.nameEn} — Tarogram`,
      description,
      images: [{ url: card.imagePath }],
    },
  };
}

export default async function TarotCardSlugPage({ params }: Props) {
  const { slug } = await params;
  const card = getCardById(slug);
  if (!card) notFound();

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <TarotCardDetailView card={card} />
    </main>
  );
}
