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
  /** 易經占法分流 — 預設 'main'(三錢全卦)。phase16/17/31 加的欄位。 */
  method?: "main" | "plum-blossom" | "direction-hexagram" | "two-options";
  /** 方位卦象合參才有值;3-bit binary trigram code(後天八卦其一)。其他占法為 null。 */
  directionTrigram?: string | null;
  /** 占卜時選的 AI 占卜師 id(lib/personas.ts)。phase18 加的欄位,讓分享頁/分享圖顯示正確的占卜師名字。 */
  personaId?: string | null;
  /** 二擇一才有 — 主流程過來填的選項標籤。phase15 已加的兩欄(原本給 tarot two-options
   *  spread 用),這裡讓易經 two-options 也共用同欄。 */
  twoOptionA?: string | null;
  twoOptionB?: string | null;
  /** 二擇一才有 — B 選項的卦資料(A 走主欄位)。phase31 新增的 cast_b_* 欄位。 */
  castB?: {
    hexagramNumber: number;
    primaryLines: number[];
    changingLines: number[];
    relatingHexagramNumber: number | null;
  } | null;
}

export interface SavedTarotCard {
  cardId: string;
  /** position key — 對應 data/spreads.ts 該牌陣的 SpreadPosition.key,任意 string */
  position: string;
  isReversed: boolean;
}

export interface SaveTarotDivinationParams {
  divineType: "tarot";
  question: string;
  category: string;
  /** 對應 data/spreads.ts 的 Spread.id;舊紀錄沒這欄會在 Phase 12 backfill 為 'three-card' */
  spreadId: string;
  tarotCards: SavedTarotCard[];
  aiReading: string;
  locale: string;
  /** 占卜時選的 AI 占卜師 id(lib/personas.ts)。phase18 加的欄位。 */
  personaId?: string | null;
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
    persona_id: params.personaId ?? null,
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
          tarot_spread_id: params.spreadId,
        }
      : {
          ...base,
          hexagram_number: params.hexagramNumber,
          primary_lines: params.primaryLines,
          changing_lines: params.changingLines,
          relating_hexagram_number: params.relatingHexagramNumber,
          tarot_cards: null,
          tarot_spread_id: null,
          // phase16/17/31 加入的占法分流欄位 — 預設 'main',
          // plum-blossom / direction-hexagram / two-options 才覆寫
          method: params.method ?? "main",
          direction_trigram: params.directionTrigram ?? null,
          // 二擇一(phase31)— A 卦走主欄位,B 卦走 cast_b_* 欄位
          two_option_a: params.twoOptionA ?? null,
          two_option_b: params.twoOptionB ?? null,
          cast_b_hexagram_number: params.castB?.hexagramNumber ?? null,
          cast_b_primary_lines: params.castB?.primaryLines ?? null,
          cast_b_changing_lines: params.castB?.changingLines ?? null,
          cast_b_relating_hexagram_number:
            params.castB?.relatingHexagramNumber ?? null,
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
  spreadId: string;
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
  /** tarot 衍伸 follow-up 才有值;舊資料可能沒這欄 — 讀取端要 default 到 'three-card' */
  spreadId?: string | null;
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
          spreadId: payload.spreadId,
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
