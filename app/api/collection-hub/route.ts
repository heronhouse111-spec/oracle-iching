/**
 * GET /api/collection-hub — public
 *
 * 回 /collection 頁面所有 active 文案,給 client 渲染用。
 *
 * RLS 已設「Public can read active」,所以匿名也能拿。
 * cache: 'no-store' 給 admin 改完即時生效;若要進一步優化,
 * 之後可在這裡加 Next.js revalidateTag。
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collection_hub_content")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
