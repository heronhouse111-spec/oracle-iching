import type { Metadata } from "next";
import Header from "@/components/Header";
import PlumBlossomMethodView from "./PlumBlossomMethodView";

export const metadata: Metadata = {
  title: "梅花易數 · 時間起卦 | Tarogram",
  description:
    "宋代邵雍創。以當下年月日時分起卦,八卦序數與動爻全部由公式攤開推算。本介紹頁說明歷史、公式與心法,並可直接點按開始卜卦。",
  alternates: { canonical: "/iching/methods/plum-blossom" },
  openGraph: {
    title: "梅花易數 · 時間起卦 · Tarogram",
    description:
      "Founded by Shao Yong in the Song dynasty. Cast a hexagram from this very moment — formula transparent, ritual minimal, results vivid.",
  },
};

export default function PlumBlossomMethodPage() {
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <PlumBlossomMethodView />
    </main>
  );
}
