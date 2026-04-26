/**
 * GET /api/announcements — public,只回傳生效中的公告(active + 在時間區間內)
 *
 * 給前端 AnnouncementBanner component 拉。
 * RLS 已限制只 active+在時段內的給 anon/authenticated 看。
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60; // 1 分鐘 cache,公告改動 1 分內生效

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, zh_text, en_text, link_url, severity, display_order")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ announcements: [] });
  }

  return NextResponse.json({ announcements: data ?? [] });
}
