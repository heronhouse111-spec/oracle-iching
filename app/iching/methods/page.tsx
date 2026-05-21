import type { Metadata } from "next";
import Header from "@/components/Header";
import MethodsView from "./MethodsView";

export const metadata: Metadata = {
  title: "易經卜卦方式介紹 · I Ching Divination Methods | Tarogram",
  description:
    "從三錢全卦到方位卦象合參,四種主流易經卜卦方法整理:三錢法、梅花易數、抽卦速答法、方位卦象合參。各自的儀式感、難度、適合情境。",
  alternates: { canonical: "/iching/methods" },
  openGraph: {
    title: "易經卜卦方式介紹 · Tarogram",
    description:
      "Four mainstream I Ching divination methods — three coins, plum blossom, instant draw, and direction × hexagram combined.",
  },
};

export default function IChingMethodsPage() {
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <MethodsView />
    </main>
  );
}
