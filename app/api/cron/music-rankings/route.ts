import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/music-rankings
 *
 * Vercel Cron 每天 00:00 UTC 呼叫(vercel.json 設定)。
 * 鎖定當日每首歌的分潤級距,collect_music() 結帳時會查當日快照。
 *
 * 安全:Vercel Cron 會帶 Authorization: Bearer <CRON_SECRET> header,
 * 我們也支援 INTERNAL_API_TOKEN(已在 Vercel env 裡)。
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  const internalToken = process.env.INTERNAL_API_TOKEN ?? "";

  // Vercel Cron 的 user-agent 是 'vercel-cron/1.0',且帶 Bearer CRON_SECRET
  const isVercelCron = request.headers.get("user-agent")?.includes("vercel-cron");
  const expectedBearer = cronSecret || internalToken;

  if (!isVercelCron || !expectedBearer || auth !== `Bearer ${expectedBearer}`) {
    if (!isVercelCron) {
      // 允許手動 trigger,但要帶 INTERNAL_API_TOKEN
      if (!internalToken || auth !== `Bearer ${internalToken}`) {
        return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("compute_music_daily_rankings", {});

  if (error) {
    console.error("[cron/music-rankings] RPC failed:", error);
    return new Response(
      JSON.stringify({ error: "RPC_FAILED", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ success: true, rankingsWritten: data ?? 0 }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
