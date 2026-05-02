/**
 * Admin dashboard data loaders.
 *
 * 所有函式都以 server-side Supabase client 執行,並且仰賴
 * admin_schema.sql 中加入的 is_admin RLS policy。非 admin 呼叫時
 * 會因為 RLS 過濾而只拿到自己的資料(或空結果),所以後台本身
 * 還是必須在 page 層做權限守衛。
 */

import { createClient } from "@/lib/supabase/server";

export interface DivinationRow {
  id: string;
  user_id: string | null;
  question: string;
  category: string;
  hexagram_number: number;
  relating_hexagram_number: number | null;
  locale: string;
  created_at: string;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  signed_up_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  preferred_locale: string | null;
  is_admin: boolean | null;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface HexagramCount {
  hexagram_number: number;
  count: number;
}

export interface LocaleCount {
  locale: string;
  count: number;
}

export interface AdminStats {
  totalUsers: number;
  totalAdmins: number;
  totalDivinations: number;
  divinationsToday: number;
  divinationsThisWeek: number;
  divinationsThisMonth: number;
  activeUsers7d: number;
  newUsers7d: number;
  avgPerUser: number;
  dailyTrend30d: DailyPoint[];
  categoryCounts: CategoryCount[];
  topHexagrams: HexagramCount[];
  localeCounts: LocaleCount[];
  recentDivinations: DivinationRow[];
  recentUsers: AdminUserRow[];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 檢查目前登入者是否為 admin。沒登入回 null,非 admin 回 false。 */
export async function getAdminUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isAdmin: false as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    profile,
    isAdmin: Boolean(profile?.is_admin),
  };
}

/** 一次拉齊後台所需的統計資料。 */
export async function loadAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = startOfDay(now);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 含今天共 7 天
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 含今天共 30 天
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // 週一為一週起點

  const [
    totalUsersRes,
    totalAdminsRes,
    totalDivinationsRes,
    divinationsTodayRes,
    divinationsThisWeekRes,
    divinationsThisMonthRes,
    newUsers7dRes,
    recent30dRes, // 用來計算每日趨勢 + 熱門卦 + 分類 + 語系 + 活躍使用者
    recentDivinationsRes,
    recentUsersRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true),
    supabase.from("divinations").select("id", { count: "exact", head: true }),
    supabase
      .from("divinations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("divinations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart.toISOString()),
    supabase
      .from("divinations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
    // Admin 目前的趨勢/分類/卦象分析只針對易經紀錄;塔羅統計後續再補(需另外聚合)
    supabase
      .from("divinations")
      .select("id,user_id,category,hexagram_number,locale,created_at")
      .eq("divine_type", "iching")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("divinations")
      .select(
        "id,user_id,question,category,hexagram_number,relating_hexagram_number,locale,created_at"
      )
      .eq("divine_type", "iching")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("admin_users_view")
      .select(
        "id,email,signed_up_at,last_sign_in_at,display_name,preferred_locale,is_admin"
      )
      .order("signed_up_at", { ascending: false })
      .limit(10),
  ]);

  const totalUsers = totalUsersRes.count ?? 0;
  const totalAdmins = totalAdminsRes.count ?? 0;
  const totalDivinations = totalDivinationsRes.count ?? 0;
  const divinationsToday = divinationsTodayRes.count ?? 0;
  const divinationsThisWeek = divinationsThisWeekRes.count ?? 0;
  const divinationsThisMonth = divinationsThisMonthRes.count ?? 0;
  const newUsers7d = newUsers7dRes.count ?? 0;

  const recent30d = (recent30dRes.data ?? []) as Array<{
    id: string;
    user_id: string | null;
    category: string;
    hexagram_number: number;
    locale: string;
    created_at: string;
  }>;

  // ── 每日趨勢 (過去 30 天) ──────────────────────────
  const bucket = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    bucket.set(isoDate(d), 0);
  }
  for (const row of recent30d) {
    const key = row.created_at.slice(0, 10);
    if (bucket.has(key)) bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }
  const dailyTrend30d: DailyPoint[] = Array.from(bucket.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── 分類分布 ─────────────────────────────────────
  const catMap = new Map<string, number>();
  for (const row of recent30d) {
    catMap.set(row.category, (catMap.get(row.category) ?? 0) + 1);
  }
  const categoryCounts: CategoryCount[] = Array.from(catMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // ── 熱門卦象 ─────────────────────────────────────
  const hexMap = new Map<number, number>();
  for (const row of recent30d) {
    hexMap.set(
      row.hexagram_number,
      (hexMap.get(row.hexagram_number) ?? 0) + 1
    );
  }
  const topHexagrams: HexagramCount[] = Array.from(hexMap.entries())
    .map(([hexagram_number, count]) => ({ hexagram_number, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── 語系分布 ─────────────────────────────────────
  const localeMap = new Map<string, number>();
  for (const row of recent30d) {
    localeMap.set(row.locale, (localeMap.get(row.locale) ?? 0) + 1);
  }
  const localeCounts: LocaleCount[] = Array.from(localeMap.entries())
    .map(([locale, count]) => ({ locale, count }))
    .sort((a, b) => b.count - a.count);

  // ── 7 天內活躍使用者 ─────────────────────────────
  const activeSet = new Set<string>();
  const sevenDaysAgoIso = sevenDaysAgo.toISOString();
  for (const row of recent30d) {
    if (row.user_id && row.created_at >= sevenDaysAgoIso) {
      activeSet.add(row.user_id);
    }
  }
  const activeUsers7d = activeSet.size;

  const avgPerUser =
    totalUsers > 0 ? Math.round((totalDivinations / totalUsers) * 10) / 10 : 0;

  return {
    totalUsers,
    totalAdmins,
    totalDivinations,
    divinationsToday,
    divinationsThisWeek,
    divinationsThisMonth,
    activeUsers7d,
    newUsers7d,
    avgPerUser,
    dailyTrend30d,
    categoryCounts,
    topHexagrams,
    localeCounts,
    recentDivinations: (recentDivinationsRes.data ?? []) as DivinationRow[],
    recentUsers: (recentUsersRes.data ?? []) as AdminUserRow[],
  };
}

// ─────────────────────────────────────────────
// Collection stats — 卡牌收集系統指標(phase 20)
// ─────────────────────────────────────────────

export interface CollectionStats {
  totalRowsIching: number;          // user_collections 易經 row 總數(含重複次數)
  totalRowsTarot: number;
  uniqueOwnersIching: number;       // 至少抽過一張的 user 數(易經)
  uniqueOwnersTarot: number;
  milestonesGranted: number;         // 已發出里程碑次數
  totalRewardCreditsGranted: number; // 透過 collection_milestone 發出的 credits
  topIching: HexagramCount[];        // 最熱門 5 卦(distinct user 數量)
  topTarot: Array<{ card_id: string; count: number }>;
}

export async function loadCollectionStats(): Promise<CollectionStats> {
  const supabase = await createClient();

  // 收藏筆數(分 type)
  const [ichingCntRes, tarotCntRes] = await Promise.all([
    supabase
      .from("user_collections")
      .select("user_id, card_id", { count: "exact" })
      .eq("collection_type", "iching"),
    supabase
      .from("user_collections")
      .select("user_id, card_id", { count: "exact" })
      .eq("collection_type", "tarot"),
  ]);

  const ichingRows = ichingCntRes.data ?? [];
  const tarotRows = tarotCntRes.data ?? [];

  const totalRowsIching = ichingCntRes.count ?? ichingRows.length;
  const totalRowsTarot = tarotCntRes.count ?? tarotRows.length;
  const uniqueOwnersIching = new Set(ichingRows.map((r) => r.user_id)).size;
  const uniqueOwnersTarot = new Set(tarotRows.map((r) => r.user_id)).size;

  // 最熱門卡(被多少 distinct user 收到)
  const ichingMap = new Map<string, Set<string>>();
  for (const r of ichingRows) {
    if (!ichingMap.has(r.card_id)) ichingMap.set(r.card_id, new Set());
    ichingMap.get(r.card_id)!.add(r.user_id);
  }
  const topIching: HexagramCount[] = Array.from(ichingMap.entries())
    .map(([card_id, users]) => ({
      hexagram_number: parseInt(card_id, 10),
      count: users.size,
    }))
    .filter((x) => Number.isFinite(x.hexagram_number))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const tarotMap = new Map<string, Set<string>>();
  for (const r of tarotRows) {
    if (!tarotMap.has(r.card_id)) tarotMap.set(r.card_id, new Set());
    tarotMap.get(r.card_id)!.add(r.user_id);
  }
  const topTarot = Array.from(tarotMap.entries())
    .map(([card_id, users]) => ({ card_id, count: users.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 里程碑發出統計
  const { count: milestonesCount } = await supabase
    .from("collection_milestones")
    .select("milestone_id", { count: "exact", head: true });

  const { data: rewardRows } = await supabase
    .from("collection_milestones")
    .select("reward_credits");
  const totalRewardCreditsGranted =
    (rewardRows ?? []).reduce((sum, r) => sum + (r.reward_credits ?? 0), 0);

  return {
    totalRowsIching,
    totalRowsTarot,
    uniqueOwnersIching,
    uniqueOwnersTarot,
    milestonesGranted: milestonesCount ?? 0,
    totalRewardCreditsGranted,
    topIching,
    topTarot,
  };
}
