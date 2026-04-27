/**
 * 後台收益統計 — 三大平台分別計算
 *
 *   1. Web 平台:走 hub 的 payments.payment_orders(ECPay 訂單,service_code='ORC')
 *   2. Google Play:走本地 play_purchases(status='granted'),價格 join credit_packs / subscription_plans 的 play_sku_id
 *   3. Apple App Store:尚未整合,目前回 0
 *
 * 全部用台幣 NTD 計算(因為 web ECPay + Play Console TW 區都是 TWD;
 * USD 訂閱未來開通後再加 currency conversion)。
 */

import { createClient } from "@/lib/supabase/server";

export interface PlatformRevenue {
  amount: number;       // NTD
  count: number;        // 訂單筆數
}

export interface RevenueBreakdown {
  web: PlatformRevenue;
  google_play: PlatformRevenue;
  apple: PlatformRevenue;
  total: number;        // NTD,三平台合計
}

export interface PlanCount {
  plan: "monthly" | "yearly";
  count: number;        // 今日新訂閱人數
  revenue: number;      // 今日訂閱貢獻收入 NTD
}

export interface PackCount {
  count: number;        // 今日購買加購方案的人次
  revenue: number;      // 今日加購方案收入 NTD
}

export interface TodaySalesStats {
  /** 今日各訂閱方案新訂閱人數 + 收入(只算當天 *新* 訂閱,續期不計) */
  subscriptionsByPlan: PlanCount[];
  /** 今日加購點數的人數 + 金額 */
  pack: PackCount;
}

export interface RevenueStats {
  todaySales: TodaySalesStats;
  monthRevenue: RevenueBreakdown;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

interface WebOrderRow {
  amount: number;
  is_recurring: boolean | null;
  period_type: "M" | "Y" | null;
  created_at: string;
}

interface PlayPurchaseRow {
  sku: string;
  product_type: "consumable" | "subscription";
  subscription_plan: "monthly" | "yearly" | null;
  created_at: string;
}

interface PriceMapEntry {
  sku: string;
  price_twd: number;
}

export async function loadRevenueStats(): Promise<RevenueStats> {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  // ─────────────── 平行抓全部資料 ───────────────
  const [
    webMonthRes,
    playMonthRes,
    creditPacksRes,
    subscriptionPlansRes,
  ] = await Promise.all([
    // 1. 本月所有 paid 的 web 訂單(用來算 web revenue + 今日 web 銷售)
    supabase
      .schema("payments")
      .from("payment_orders")
      .select("amount, is_recurring, period_type, created_at")
      .eq("payment_status", "paid")
      .eq("service_code", "ORC")
      .gte("created_at", monthStart.toISOString()),

    // 2. 本月所有 granted 的 Play 購買
    supabase
      .from("play_purchases")
      .select("sku, product_type, subscription_plan, created_at")
      .eq("status", "granted")
      .gte("created_at", monthStart.toISOString()),

    // 3. credit_packs 拿價格(SKU → price_twd)
    supabase
      .from("credit_packs")
      .select("play_sku_id, price_twd"),

    // 4. subscription_plans 拿價格
    supabase
      .from("subscription_plans")
      .select("play_sku_id, price_twd"),
  ]);

  const webOrders = ((webMonthRes.data ?? []) as unknown) as WebOrderRow[];
  const playOrders = ((playMonthRes.data ?? []) as unknown) as PlayPurchaseRow[];

  // SKU → price 對照
  const priceMap = new Map<string, number>();
  for (const row of (creditPacksRes.data ?? []) as PriceMapEntry[]) {
    if (row.sku) priceMap.set(row.sku, row.price_twd);
  }
  for (const row of (subscriptionPlansRes.data ?? []) as PriceMapEntry[]) {
    if (row.sku) priceMap.set(row.sku, row.price_twd);
  }
  // credit_packs/subscription_plans 的欄位實際是 play_sku_id,上面型別簡化了。
  // 重新建一次正確的 priceMap:
  priceMap.clear();
  for (const row of (creditPacksRes.data ?? []) as Array<{ play_sku_id: string | null; price_twd: number }>) {
    if (row.play_sku_id) priceMap.set(row.play_sku_id, row.price_twd);
  }
  for (const row of (subscriptionPlansRes.data ?? []) as Array<{ play_sku_id: string | null; price_twd: number }>) {
    if (row.play_sku_id) priceMap.set(row.play_sku_id, row.price_twd);
  }

  // ─────────────── 今日銷售 ───────────────
  const todayIso = todayStart.toISOString();

  // Web 今日訂閱:filter is_recurring=true + created_at >= today,group by period_type
  const webTodaySubs = webOrders.filter(
    (o) => o.is_recurring === true && o.created_at >= todayIso,
  );
  // Play 今日訂閱
  const playTodaySubs = playOrders.filter(
    (o) => o.product_type === "subscription" && o.created_at >= todayIso,
  );

  let monthlyCount = 0;
  let monthlyRevenue = 0;
  let yearlyCount = 0;
  let yearlyRevenue = 0;

  for (const o of webTodaySubs) {
    if (o.period_type === "M") {
      monthlyCount++;
      monthlyRevenue += o.amount;
    } else if (o.period_type === "Y") {
      yearlyCount++;
      yearlyRevenue += o.amount;
    }
  }
  for (const o of playTodaySubs) {
    const price = priceMap.get(o.sku) ?? 0;
    if (o.subscription_plan === "monthly") {
      monthlyCount++;
      monthlyRevenue += price;
    } else if (o.subscription_plan === "yearly") {
      yearlyCount++;
      yearlyRevenue += price;
    }
  }

  // 今日加購方案
  const webTodayPacks = webOrders.filter(
    (o) => !o.is_recurring && o.created_at >= todayIso,
  );
  const playTodayPacks = playOrders.filter(
    (o) => o.product_type === "consumable" && o.created_at >= todayIso,
  );

  const packCount = webTodayPacks.length + playTodayPacks.length;
  let packRevenue = 0;
  for (const o of webTodayPacks) packRevenue += o.amount;
  for (const o of playTodayPacks) packRevenue += priceMap.get(o.sku) ?? 0;

  // ─────────────── 本月各平台累積收益 ───────────────
  // Web
  let webAmount = 0;
  for (const o of webOrders) webAmount += o.amount;
  const webCount = webOrders.length;

  // Google Play
  let playAmount = 0;
  for (const o of playOrders) playAmount += priceMap.get(o.sku) ?? 0;
  const playCount = playOrders.length;

  // Apple(尚未整合)
  const appleAmount = 0;
  const appleCount = 0;

  const total = webAmount + playAmount + appleAmount;

  return {
    todaySales: {
      subscriptionsByPlan: [
        { plan: "monthly", count: monthlyCount, revenue: monthlyRevenue },
        { plan: "yearly", count: yearlyCount, revenue: yearlyRevenue },
      ],
      pack: { count: packCount, revenue: packRevenue },
    },
    monthRevenue: {
      web: { amount: webAmount, count: webCount },
      google_play: { amount: playAmount, count: playCount },
      apple: { amount: appleAmount, count: appleCount },
      total,
    },
  };
}
