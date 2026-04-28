import type { Metadata } from "next";
import Header from "@/components/Header";
import MethodsView from "./MethodsView";

export const metadata: Metadata = {
  title: "易經卜卦方式介紹 · I Ching Divination Methods | Tarogram",
  description:
    "從古法蓍草到現代抽卦速答,五種主流易經卜卦方法整理:三錢法、蓍草法、單錢卜法、梅花易數、抽卦速答法。各自的儀式感、難度、適合情境。",
  alternates: { canonical: "/iching/methods" },
  openGraph: {
    title: "易經卜卦方式介紹 · Tarogram",
    description:
      "Five mainstream I Ching divination methods — yarrow stalks, three coins, plum blossom, instant draw, and more.",
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
