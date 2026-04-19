/**
 * 占卜紀錄存檔 — 支援易經 & 塔羅兩種占卜類型
 *
 * schema 參見 supabase/phase3_tarot.sql:
 *   - divine_type: 'iching' | 'tarot'
 *   - tarot_cards: JSONB | null  (tarot only)
 *   - hexagram_number / primary_lines / changing_lines / relating_hexagram_number: iching only
 *
 * 登入 + Supabase 有設定 → 存雲端(RLS 擋)
 * 沒登入或失敗 → fallback 到 localStorage(前 50 筆)
 */

export interface SaveIchingDivinationParams {
  divineType: "iching";
  question: string;
  category: string;
  hexagramNumber: number;
  primaryLines: number[];
  changingLines: number[];
  relatingHexagramNumber: number | null;
  aiReading: string;
  locale: string;
}

export interface SavedTarotCard {
  cardId: string;
  position: "past" | "present" | "future";
  isReversed: boolean;
}

export interface SaveTarotDivinationParams {
  divineType: "tarot";
  question: string;
  category: string;
  tarotCards: SavedTarotCard[];
  aiReading: string;
  locale: string;
}

export type SaveDivinationParams =
  | SaveIchingDivinationParams
  | SaveTarotDivinationParams;

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

export async function saveDivination(params: SaveDivinationParams) {
  const base = {
    id: crypto.randomUUID(),
    question: params.question,
    category: params.category,
    ai_reading: params.aiReading,
    locale: params.locale,
    divine_type: params.divineType,
    created_at: new Date().toISOString(),
  };

  const record =
    params.divineType === "tarot"
      ? {
          ...base,
          hexagram_number: null,
          primary_lines: null,
          changing_lines: null,
          relating_hexagram_number: null,
          tarot_cards: params.tarotCards,
        }
      : {
          ...base,
          hexagram_number: params.hexagramNumber,
          primary_lines: params.primaryLines,
          changing_lines: params.changingLines,
          relating_hexagram_number: params.relatingHexagramNumber,
          tarot_cards: null,
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
