import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/music/my
 * 回傳目前登入者的:
 *   - created: 自己創作的所有歌(含 private)
 *   - collected: 收藏的他人作品(JOIN generated_music)
 *   - supabaseUrl: 給前端拼 storage public URL 用
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "LOGIN_REQUIRED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [createdRes, collectedRes] = await Promise.all([
    supabase
      .from("generated_music")
      .select(
        "id, title, category_id, storage_path, duration_seconds, visibility, collect_count, creator_earnings_total, created_at, published_at",
      )
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("music_collections")
      .select(
        "music_id, collected_at, points_paid, generated_music(id, title, category_id, storage_path, duration_seconds, creator_display_name)",
      )
      .eq("user_id", user.id)
      .order("collected_at", { ascending: false }),
  ]);

  if (createdRes.error || collectedRes.error) {
    console.error("[music/my]", createdRes.error || collectedRes.error);
    return new Response(JSON.stringify({ error: "FETCH_FAILED" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      created: createdRes.data ?? [],
      collected: collectedRes.data ?? [],
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
