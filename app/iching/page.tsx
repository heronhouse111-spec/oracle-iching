import type { Metadata } from "next";
import Header from "@/components/Header";
import IchingMethodSelectView from "./IchingMethodSelectView";

export const metadata: Metadata = {
  title: "易經占卜方法選擇 · I Ching Methods | Tarogram",
  description:
    "選擇適合你的易經占卜方式 — 三錢全卦、Yes/No 速答、每日一占、方位卦象合參。每種占法針對不同問題與情境。",
  alternates: { canonical: "/iching" },
  openGraph: {
    title: "易經占卜方法選擇 · Tarogram",
    description:
      "Pick the I Ching method for your moment — full three-coin reading, Yes/No quick answer, daily, or direction × hexagram combined.",
  },
};

export default function IChingMethodSelectPage() {
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <IchingMethodSelectView />
    </main>
  );
}
