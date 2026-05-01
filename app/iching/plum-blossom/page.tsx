import type { Metadata } from "next";
import Header from "@/components/Header";
import PlumBlossomFlowView from "./PlumBlossomFlowView";

export const metadata: Metadata = {
  title: "梅花易數 · 時間起卦 | Tarogram",
  description:
    "宋代邵雍創 — 不擲銅錢、不算籤,直接用問事當下的時間起卦。",
  alternates: { canonical: "/iching/plum-blossom" },
  openGraph: {
    title: "梅花易數 · 時間起卦 | Tarogram",
    description:
      "Plum Blossom Numerology — cast the I Ching from the moment you ask, no coins required.",
  },
};

// 此頁僅是「起卦工具過場」 — 沒有設問、AI、結果。
// 進來後讀 sessionStorage 拿 q+cat,跑起卦動畫,把結果寫回 sessionStorage,
// 再 router.push("/?resumeFlow=method-result") 由首頁 result step 接手。
// 因此不需要 server 撈 iching images,純 client 即可。
export default function PlumBlossomFlowPage() {
  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />
      <PlumBlossomFlowView />
    </main>
  );
}
