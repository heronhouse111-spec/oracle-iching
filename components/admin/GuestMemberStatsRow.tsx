"use client";

import { useState } from "react";
import StatCard from "./StatCard";
import TrendChart from "./TrendChart";
import type { DailyPoint } from "@/lib/admin/stats";

interface Props {
  guestTotal: number;
  guestToday: number;
  memberTotal: number;
  memberToday: number;
  guestTrend: DailyPoint[];
  memberTrend: DailyPoint[];
  /** 顯示在會員總卡片 sublabel 的「平均每人」用值 */
  memberAvgPerUser: number;
}

type Open = null | "guest" | "member";

/**
 * Dashboard 第二排:訪客/會員拆分四格,「今日」兩格可點擊在下方展開 30 日折線圖。
 *
 * 為什麼用 client component:點擊展開純前端 toggle 不需要 server round-trip,
 * 而且 stats 已經在父層 RSC 預先 fetch,趨勢資料用 props 帶進來即可。
 */
export default function GuestMemberStatsRow({
  guestTotal,
  guestToday,
  memberTotal,
  memberToday,
  guestTrend,
  memberTrend,
  memberAvgPerUser,
}: Props) {
  const [open, setOpen] = useState<Open>(null);

  const toggle = (which: "guest" | "member") =>
    setOpen((prev) => (prev === which ? null : which));

  const clickHint = open === null
    ? "點擊查看 30 日趨勢"
    : "再次點擊收起";

  return (
    <>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="訪客總占卜次數"
          value={guestTotal.toLocaleString()}
          sublabel="登入前的 yes/no + 每日"
          icon="🚪"
          accent="silver"
        />

        <ClickableStatCardWrapper
          isOpen={open === "guest"}
          onClick={() => toggle("guest")}
          ariaLabel="訪客今日占卜次數,點擊切換 30 日趨勢圖"
        >
          <StatCard
            label="訪客今日占卜次數"
            value={guestToday.toLocaleString()}
            sublabel={open === "guest" ? "再次點擊收起" : clickHint}
            icon="📈"
            accent="rose"
          />
        </ClickableStatCardWrapper>

        <StatCard
          label="會員總占卜次數"
          value={memberTotal.toLocaleString()}
          sublabel={`平均每人 ${memberAvgPerUser} 次`}
          icon="👤"
          accent="gold"
        />

        <ClickableStatCardWrapper
          isOpen={open === "member"}
          onClick={() => toggle("member")}
          ariaLabel="會員今日占卜次數,點擊切換 30 日趨勢圖"
        >
          <StatCard
            label="會員今日占卜次數"
            value={memberToday.toLocaleString()}
            sublabel={open === "member" ? "再次點擊收起" : clickHint}
            icon="📊"
            accent="emerald"
          />
        </ClickableStatCardWrapper>
      </section>

      {open === "guest" && (
        <TrendChart
          data={guestTrend}
          title="訪客每日占卜趨勢"
          subtitle="近 30 天 · 涵蓋 guest_yesno_log + guest_daily_log"
        />
      )}
      {open === "member" && (
        <TrendChart
          data={memberTrend}
          title="會員每日占卜趨勢"
          subtitle="近 30 天 · 涵蓋 divinations + 付點 free-flow + 簽到免費"
        />
      )}
    </>
  );
}

/** 把 StatCard 包成可點擊區塊。原始 StatCard 是純展示元件,維持 server-friendly。 */
function ClickableStatCardWrapper({
  isOpen,
  onClick,
  ariaLabel,
  children,
}: {
  isOpen: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isOpen}
      aria-label={ariaLabel}
      className="text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-mystic-gold/40 rounded-2xl"
      style={{
        cursor: "pointer",
        // 開啟時用 ring 強化目前選中的卡片
        outline: isOpen ? "2px solid rgba(212,175,55,0.55)" : undefined,
        outlineOffset: isOpen ? 2 : undefined,
        borderRadius: 16,
      }}
    >
      {children}
    </button>
  );
}
