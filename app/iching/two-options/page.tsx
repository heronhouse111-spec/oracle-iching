import type { Metadata } from "next";
import { getIchingImages } from "@/lib/ichingImages";
import TwoOptionsView from "./TwoOptionsView";

export const metadata: Metadata = {
  title: "易經二擇一 · I Ching A or B Decision | Tarogram",
  description:
    "卡在兩個選項之間時 — A / B 各起一卦,AI 比對兩卦給出明確推一邊的決斷。Stuck between two paths? Cast a hexagram for each option and compare for a committed verdict.",
  alternates: { canonical: "/iching/two-options" },
  openGraph: {
    title: "易經二擇一 · A or B Decision · Tarogram",
    description:
      "Cast a separate hexagram for Option A and Option B; AI compares both and commits to one.",
  },
};

export default async function IChingTwoOptionsPage() {
  // 載入 64 卦圖檔(server-side cached 60s)— 拿不到就傳空 map,
  // client view 會 fallback 到只顯示陰陽爻線。
  const images = await getIchingImages();

  return <TwoOptionsView images={images} />;
}
