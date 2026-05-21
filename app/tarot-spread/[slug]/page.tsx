import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import { SPREADS, getSpread, spreadImageSlot } from "@/data/spreads";
import { getUiImages } from "@/lib/uiImages";
import { getServerLocale, pickByLocale } from "@/lib/serverLocale";
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
  const { locale } = await getServerLocale();

  const name = pickByLocale(locale, found.nameZh, found.nameEn, found.nameJa, found.nameKo);
  const tagline = pickByLocale(locale, found.taglineZh, found.taglineEn, found.taglineJa, found.taglineKo);
  const when = pickByLocale(locale, found.whenZh, found.whenEn, found.whenJa, found.whenKo);
  const suffix = pickByLocale(
    locale,
    "塔羅牌陣解析 | Tarogram",
    "Tarot Spread | Tarogram",
    "タロット スプレッド解説 | Tarogram",
    "타로 스프레드 해설 | Tarogram"
  );

  return {
    title: `${name} · ${suffix}`,
    description: `${tagline} ${when.slice(0, 80)}…`,
    alternates: { canonical: `/tarot-spread/${found.id}` },
    openGraph: {
      title: `${name} — Tarogram`,
      description: tagline,
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
