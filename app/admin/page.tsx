import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import StatCard from "@/components/admin/StatCard";
import TrendChart from "@/components/admin/TrendChart";
import CategoryBreakdown from "@/components/admin/CategoryBreakdown";
import TopHexagrams from "@/components/admin/TopHexagrams";
import LocaleSplit from "@/components/admin/LocaleSplit";
import RecentDivinations from "@/components/admin/RecentDivinations";
import RecentUsers from "@/components/admin/RecentUsers";
import { getAdminUser, loadAdminStats } from "@/lib/admin/stats";
import { loadRevenueStats } from "@/lib/admin/revenue";

// 後台資料一律即時取得,避免快取過舊
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 後台介面先固定為中文 (創作者自己看),需要雙語可再切換。
const LOCALE: "zh" | "en" = "zh";

// ──────── 平台收益條形 ────────
function PlatformBar({
  label,
  amount,
  count,
  total,
  color,
  placeholder,
}: {
  label: string;
  amount: number;
  count: number;
  total: number;
  color: string;
  placeholder?: string;
}) {
  const fmtTwd = (n: number) =>
    new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(n);
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
          fontSize: 13,
        }}
      >
        <span style={{ color: "#0f1a2e", fontWeight: 500 }}>{label}</span>
        <span>
          {placeholder ? (
            <span style={{ color: "#8a99b0", fontSize: 12 }}>{placeholder}</span>
          ) : (
            <>
              <span style={{ color: "#0f2748", fontWeight: 600 }}>{fmtTwd(amount)}</span>
              <span style={{ color: "#8a99b0", fontSize: 11, marginLeft: 8 }}>
                · {count} 筆 · {pct}%
              </span>
            </>
          )}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "#eef4fa",
          borderRadius: 9999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const { user, isAdmin } = await getAdminUser();

  // 未登入 → 導回首頁
  if (!user) {
    redirect("/?redirect=/admin");
  }

  // 已登入但不是 admin → 顯示友善阻擋頁面
  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="pt-24 pb-12 px-4 max-w-xl mx-auto text-center space-y-4">
          <div className="text-6xl">🔒</div>
          <h1 className="text-2xl font-serif text-gold-gradient">
            僅限創作者後台
          </h1>
          <p className="text-mystic-silver/70 leading-relaxed">
            你目前的帳號沒有後台權限。
            <br />
            請以管理員身份登入,或聯絡 app 所有者將你設為 admin。
          </p>
          <div className="text-xs text-mystic-silver/40 pt-4">
            登入帳號:{user.email}
          </div>
          <Link href="/" className="btn-gold inline-block mt-4">
            回到首頁
          </Link>
        </main>
      </div>
    );
  }

  const [stats, revenue] = await Promise.all([
    loadAdminStats(),
    loadRevenueStats(),
  ]);

  const fmtTwd = (n: number) =>
    new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(n);
  const monthly = revenue.todaySales.subscriptionsByPlan.find((p) => p.plan === "monthly");
  const yearly = revenue.todaySales.subscriptionsByPlan.find((p) => p.plan === "yearly");
  const totalSubsToday = (monthly?.count ?? 0) + (yearly?.count ?? 0);
  const totalSubsRevenueToday = (monthly?.revenue ?? 0) + (yearly?.revenue ?? 0);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-20 pb-12 px-4 max-w-6xl mx-auto">
        <div className="pt-4 space-y-6">
          {/* 標題 */}
          <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-mystic-silver/50">
                Creator Console
              </p>
              <h1 className="text-3xl font-serif text-gold-gradient mt-1">
                創作者後台
              </h1>
              <p className="text-sm text-mystic-silver/60 mt-1">
                歡迎回來,{user.email} · 最後更新於 {" "}
                {new Date().toLocaleString("zh-TW")}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/admin"
                className="px-3 py-2 rounded-full border border-mystic-gold/30 text-mystic-gold text-xs hover:bg-mystic-gold/10 transition-colors"
              >
                重新整理
              </Link>
              <Link
                href="/"
                className="px-3 py-2 rounded-full border border-mystic-silver/20 text-mystic-silver/80 text-xs hover:bg-mystic-silver/5 transition-colors"
              >
                回到 App
              </Link>
            </div>
          </header>

          {/* 核心指標 */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="總用戶數"
              value={stats.totalUsers.toLocaleString()}
              sublabel={`含 ${stats.totalAdmins} 位管理員`}
              icon="👥"
              accent="gold"
            />
            <StatCard
              label="總占卜次數"
              value={stats.totalDivinations.toLocaleString()}
              sublabel={`平均每人 ${stats.avgPerUser} 次`}
              icon="☯"
              accent="silver"
            />
            <StatCard
              label="今日占卜"
              value={stats.divinationsToday.toLocaleString()}
              sublabel={`本週 ${stats.divinationsThisWeek} · 本月 ${stats.divinationsThisMonth}`}
              icon="🌙"
              accent="rose"
            />
            <StatCard
              label="7 日活躍用戶"
              value={stats.activeUsers7d.toLocaleString()}
              sublabel={`7 日新加入 ${stats.newUsers7d} 人`}
              icon="✨"
              accent="emerald"
            />
          </section>

          {/* ── 今日銷售 ── */}
          <section className="mystic-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, color: "#1e4272", margin: 0, fontWeight: 600 }}>
                今日銷售
              </h2>
              <span style={{ fontSize: 11, color: "#8a99b0" }}>
                {new Date().toLocaleDateString("zh-TW")}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {/* 月訂閱 */}
              <div style={{ padding: 14, background: "#fafcfe", border: "1px solid #dbe3ee", borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "#8a99b0", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  📆 月訂閱(新)
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#1e4272" }}>
                  {monthly?.count ?? 0} <span style={{ fontSize: 13, color: "#5a6a82", fontWeight: 400 }}>人</span>
                </div>
                <div style={{ fontSize: 12, color: "#5a6a82", marginTop: 2 }}>
                  收入 {fmtTwd(monthly?.revenue ?? 0)}
                </div>
              </div>

              {/* 年訂閱 */}
              <div style={{ padding: 14, background: "#fafcfe", border: "1px solid #dbe3ee", borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "#8a99b0", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  🗓️ 年訂閱(新)
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#1e4272" }}>
                  {yearly?.count ?? 0} <span style={{ fontSize: 13, color: "#5a6a82", fontWeight: 400 }}>人</span>
                </div>
                <div style={{ fontSize: 12, color: "#5a6a82", marginTop: 2 }}>
                  收入 {fmtTwd(yearly?.revenue ?? 0)}
                </div>
              </div>

              {/* 加購點數 */}
              <div style={{ padding: 14, background: "#fafcfe", border: "1px solid #dbe3ee", borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "#8a99b0", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  ✦ 加購點數
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#1e4272" }}>
                  {revenue.todaySales.pack.count} <span style={{ fontSize: 13, color: "#5a6a82", fontWeight: 400 }}>筆</span>
                </div>
                <div style={{ fontSize: 12, color: "#5a6a82", marginTop: 2 }}>
                  收入 {fmtTwd(revenue.todaySales.pack.revenue)}
                </div>
              </div>

              {/* 今日總計 */}
              <div
                style={{
                  padding: 14,
                  background: "linear-gradient(135deg, #eef4fa 0%, #dae8f3 100%)",
                  border: "1px solid #b6cfe4",
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 11, color: "#1e4272", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>
                  💰 今日合計
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#0f2748" }}>
                  {fmtTwd(totalSubsRevenueToday + revenue.todaySales.pack.revenue)}
                </div>
                <div style={{ fontSize: 12, color: "#1e4272", marginTop: 2 }}>
                  訂閱 {totalSubsToday} 人 · 加購 {revenue.todaySales.pack.count} 筆
                </div>
              </div>
            </div>
          </section>

          {/* ── 本月各平台累積收益 ── */}
          <section className="mystic-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, color: "#1e4272", margin: 0, fontWeight: 600 }}>
                本月各平台累積收益
              </h2>
              <span style={{ fontSize: 11, color: "#8a99b0" }}>
                {new Date().getFullYear()} 年 {new Date().getMonth() + 1} 月
              </span>
            </div>

            {/* 三平台條形 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <PlatformBar
                label="🌐 網頁(ECPay)"
                amount={revenue.monthRevenue.web.amount}
                count={revenue.monthRevenue.web.count}
                total={revenue.monthRevenue.total}
                color="#3b6fa3"
              />
              <PlatformBar
                label="🤖 Google Play"
                amount={revenue.monthRevenue.google_play.amount}
                count={revenue.monthRevenue.google_play.count}
                total={revenue.monthRevenue.total}
                color="#1f7a43"
              />
              <PlatformBar
                label="🍎 Apple App Store"
                amount={revenue.monthRevenue.apple.amount}
                count={revenue.monthRevenue.apple.count}
                total={revenue.monthRevenue.total}
                color="#8a99b0"
                placeholder="尚未開放"
              />
            </div>

            {/* 總計 */}
            <div
              style={{
                paddingTop: 14,
                borderTop: "1px dashed #dbe3ee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span style={{ fontSize: 13, color: "#5a6a82" }}>本月三平台合計</span>
              <span style={{ fontSize: 26, fontWeight: 700, color: "#0f2748" }}>
                {fmtTwd(revenue.monthRevenue.total)}
              </span>
            </div>
          </section>

          {/* 每日趨勢 */}
          <section>
            <TrendChart
              data={stats.dailyTrend30d}
              title="每日占卜趨勢"
              subtitle="過去 30 天"
            />
          </section>

          {/* 分類 + 語系 + 熱門卦 */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CategoryBreakdown data={stats.categoryCounts} locale={LOCALE} />
            <LocaleSplit data={stats.localeCounts} locale={LOCALE} />
            <TopHexagrams data={stats.topHexagrams} locale={LOCALE} />
          </section>

          {/* 活動流 + 用戶 */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <RecentDivinations
                rows={stats.recentDivinations}
                locale={LOCALE}
              />
            </div>
            <div>
              <RecentUsers rows={stats.recentUsers} locale={LOCALE} />
            </div>
          </section>

          <footer className="text-center text-xs text-mystic-silver/40 pt-4">
            ☯ Creator Console · 資料來自 Supabase · 更新頻率:即時
          </footer>
        </div>
      </main>
    </div>
  );
}
