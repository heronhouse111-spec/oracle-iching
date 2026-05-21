import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  tarotDeck,
  getCardById,
  SUIT_NAMES_ZH,
  SUIT_NAMES_EN,
  SUIT_NAMES_JA,
  SUIT_NAMES_KO,
} from "@/data/tarot";
import Header from "@/components/Header";
import { getServerLocale, pickByLocale } from "@/lib/serverLocale";
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
  const { locale } = await getServerLocale();

  const name = pickByLocale(locale, card.nameZh, card.nameEn, card.nameJa, card.nameKo);
  const suit = pickByLocale(
    locale,
    SUIT_NAMES_ZH[card.suit],
    SUIT_NAMES_EN[card.suit],
    SUIT_NAMES_JA[card.suit],
    SUIT_NAMES_KO[card.suit]
  );
  const upright = pickByLocale(
    locale,
    card.uprightMeaningZh,
    card.uprightMeaningEn,
    card.uprightMeaningJa,
    card.uprightMeaningKo
  );
  const titleSuffix = pickByLocale(
    locale,
    "牌意 | Tarogram 易問",
    "Card Meaning | Tarogram",
    "カード意味 | Tarogram",
    "카드 의미 | Tarogram"
  );
  const descPrefix = pickByLocale(
    locale,
    `${name} 正逆位牌意、關鍵字、適用情境完整解析。`,
    `${name} — upright/reversed meanings, keywords, context.`,
    `${name} の正位置・逆位置の意味、キーワード、適用場面の完全解説。`,
    `${name} 정·역방향 의미, 키워드, 상황별 해설.`
  );

  return {
    title: `${name}（${suit}）· ${titleSuffix}`,
    description: `${descPrefix}${upright.slice(0, 80)}…`,
    alternates: { canonical: `/tarot/cards/${card.id}` },
    openGraph: {
      title: `${name} — Tarogram`,
      description: descPrefix,
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
