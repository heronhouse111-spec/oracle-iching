import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/music/free-tracks
 *
 * 輕量端點:回傳平台 2 首永久免費歌曲(完整資訊 + storage 公開 URL)。
 * 給 MusicPlayerProvider 開機 auto-init 用 — 不需登入,不打 leaderboard 表。
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_music")
    .select(
      "id, title, title_translations, category_id, storage_path, duration_seconds, creator_display_name",
    )
    .eq("is_free", true)
    .eq("visibility", "public")
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[free-tracks]", error);
    return new Response(
      JSON.stringify({ tracks: [], error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const tracks = (data ?? []).map((t) => ({
    ...t,
    audio_url: `${supabaseUrl}/storage/v1/object/public/app-music/${t.storage_path}`,
  }));

  return new Response(JSON.stringify({ tracks }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // 邊緣快取 5 分鐘 — 免費歌列表不會頻繁變
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
