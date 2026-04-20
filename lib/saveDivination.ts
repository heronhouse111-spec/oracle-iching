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

/**
 * 「相關衍伸問題繼續占卜」— 把新占卜塞進原始 divination 的 follow_ups 陣列尾端。
 *
 * schema 參見 supabase/phase4_followups.sql。只會在「已登入 + Supabase 有設定」
 * 時動作 — 未登入的訪客在 UI 會被擋,根本不會進到這條路徑。
 *
 * 使用 JSONB || operator 做 atomic append(避免多 tab 同時操作時互蓋),
 * 改用 RPC 會更穩,但目前流程單用戶單連線足夠。
 */
export interface FollowUpIchingPayload {
  divineType: "iching";
  question: string;
  hexagramNumber: number;
  primaryLines: number[];
  changingLines: number[];
  relatingHexagramNumber: number | null;
  aiReading: string;
}

export interface FollowUpTarotPayload {
  divineType: "tarot";
  question: string;
  tarotCards: SavedTarotCard[];
  aiReading: string;
}

export type FollowUpPayload = FollowUpIchingPayload | FollowUpTarotPayload;

export interface SavedFollowUp {
  id: string;
  question: string;
  createdAt: string;
  divineType: "iching" | "tarot";
  aiReading: string;
  hexagramNumber?: number | null;
  primaryLines?: number[] | null;
  changingLines?: number[] | null;
  relatingHexagramNumber?: number | null;
  tarotCards?: SavedTarotCard[] | null;
}

export async function appendFollowUp(
  parentId: string,
  payload: FollowUpPayload
): Promise<SavedFollowUp | null> {
  const entry: SavedFollowUp =
    payload.divineType === "tarot"
      ? {
          id: crypto.randomUUID(),
          question: payload.question,
          createdAt: new Date().toISOString(),
          divineType: "tarot",
          aiReading: payload.aiReading,
          tarotCards: payload.tarotCards,
          hexagramNumber: null,
          primaryLines: null,
          changingLines: null,
          relatingHexagramNumber: null,
        }
      : {
          id: crypto.randomUUID(),
          question: payload.question,
          createdAt: new Date().toISOString(),
          divineType: "iching",
          aiReading: payload.aiReading,
          hexagramNumber: payload.hexagramNumber,
          primaryLines: payload.primaryLines,
          changingLines: payload.changingLines,
          relatingHexagramNumber: payload.relatingHexagramNumber,
          tarotCards: null,
        };

  if (!isSupabaseConfigured) return entry;

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return entry;

    // 先讀回現有 follow_ups,append 一筆再寫回 — 單用戶 single-tab 情境夠用
    const { data: row, error: readErr } = await supabase
      .from("divinations")
      .select("follow_ups")
      .eq("id", parentId)
      .maybeSingle();

    if (readErr) {
      console.error("appendFollowUp: read failed", readErr);
      return entry;
    }

    const existing: SavedFollowUp[] = Array.isArray(row?.follow_ups)
      ? (row!.follow_ups as SavedFollowUp[])
      : [];
    const next = [...existing, entry];

    const { error: writeErr } = await supabase
      .from("divinations")
      .update({ follow_ups: next })
      .eq("id", parentId);

    if (writeErr) {
      console.error("appendFollowUp: write failed", writeErr);
    }
  } catch (e) {
    console.error("appendFollowUp error:", e);
  }

  return entry;
}
