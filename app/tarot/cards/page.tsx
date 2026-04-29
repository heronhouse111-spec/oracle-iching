import type { Metadata } from "next";
import Header from "@/components/Header";
import { getServerLocale, pickByLocale } from "@/lib/serverLocale";
import TarotCardsIndexView from "./TarotCardsIndexView";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerLocale();
  const title = pickByLocale(
    locale,
    "78 張塔羅牌牌意百科 | Tarogram",
    "78 Tarot Cards Encyclopedia | Tarogram",
    "78枚タロットカード百科 | Tarogram",
    "78장 타로 카드 백과 | Tarogram"
  );
  const description = pickByLocale(
    locale,
    "Rider-Waite-Smith 78 張塔羅牌完整牌意,正逆位、關鍵字、適用情境。",
    "Complete Rider-Waite-Smith tarot card meanings — upright & reversed, keywords, contexts. Major Arcana 22 + Minor Arcana 56.",
    "ライダー・ウェイト版78枚タロット完全解説：正位置・逆位置、キーワード、適用シーン。大アルカナ22枚＋小アルカナ56枚。",
    "라이더-웨이트 78장 타로 완전 해설: 정·역방향, 키워드, 상황. 메이저 22장 + 마이너 56장."
  );
  return {
    title,
    description,
    alternates: { canonical: "/tarot/cards" },
    openGraph: { title, description },
  };
}

export default function TarotCardsIndexPage() {
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <TarotCardsIndexView />
    </main>
  );
}
