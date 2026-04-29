import type { Metadata } from "next";
import Header from "@/components/Header";
import { getUiImages } from "@/lib/uiImages";
import { getServerLocale, pickByLocale } from "@/lib/serverLocale";
import TarotSpreadIndexView from "./TarotSpreadIndexView";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getServerLocale();
  const title = pickByLocale(
    locale,
    "塔羅牌陣大全 | Tarogram 易問",
    "Tarot Spreads | Tarogram",
    "タロット スプレッド大全 | Tarogram",
    "타로 스프레드 백과 | Tarogram"
  );
  const description = pickByLocale(
    locale,
    "從三牌時間軸到凱爾特十字,五大經典塔羅牌陣完整解析:適合的問題、位置意義、實際操作。",
    "Five classic tarot spreads — three-card timeline, two-options, love cross, Celtic cross, yearly 12 — with full breakdown of when to use, position meanings, and practical tips.",
    "三枚タイムラインからケルト十字まで、5つの定番タロット スプレッドを徹底解説：適した質問、各位置の意味、実践のコツ。",
    "세 장 타임라인부터 켈틱 크로스까지, 다섯 가지 고전 타로 스프레드를 완벽 해설: 적합한 질문, 위치 의미, 실전 활용."
  );
  return {
    title,
    description,
    alternates: { canonical: "/tarot-spread" },
    openGraph: { title, description },
  };
}

export default async function TarotSpreadIndexPage() {
  const uiImages = await getUiImages();
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <TarotSpreadIndexView uiImages={uiImages} />
    </main>
  );
}
