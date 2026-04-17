export interface SaveDivinationParams {
  question: string;
  category: string;
  hexagramNumber: number;
  primaryLines: number[];
  changingLines: number[];
  relatingHexagramNumber: number | null;
  aiReading: string;
  locale: string;
}

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

export async function saveDivination(params: SaveDivinationParams) {
  const record = {
    id: crypto.randomUUID(),
    question: params.question,
    category: params.category,
    hexagram_number: params.hexagramNumber,
    primary_lines: params.primaryLines,
    changing_lines: params.changingLines,
    relating_hexagram_number: params.relatingHexagramNumber,
    ai_reading: params.aiReading,
    locale: params.locale,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase.from("divinations").insert({
          ...record,
          user_id: user.id,
        });
        if (!error) return record;
        console.error("Supabase save failed:", error);
      }
    } catch (e) {
      console.error("Supabase error:", e);
    }
  }

  // Fallback to localStorage
  saveToLocalStorage(record);
  return record;
}

function saveToLocalStorage(record: Record<string, unknown>) {
  try {
    const existing = JSON.parse(localStorage.getItem("divination_history") || "[]");
    existing.unshift(record);
    localStorage.setItem("divination_history", JSON.stringify(existing.slice(0, 50)));
  } catch (e) {
    console.error("localStorage save failed:", e);
  }
}
