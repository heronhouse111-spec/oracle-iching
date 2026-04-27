/**
 * Server-side persona resolver — DB-first,fallback static
 *
 * AI route 從 client 拿到 personaId 後呼叫 resolvePersonaServer,
 * 它先查 personas 表;沒查到 / DB 掛掉就回 static 版本(lib/personas.ts)。
 *
 * 為什麼要分一支:lib/personas.ts 是同步且可被 client bundle 使用,
 * 不能 import server-only 的 supabase client。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  type Persona,
  type PersonaSystem,
  resolvePersona as resolvePersonaStatic,
  getDefaultPersonaIdForSystem,
} from "@/lib/personas";

interface PersonaRow {
  id: string;
  system: PersonaSystem;
  tier: "free" | "premium";
  active: boolean;
  sort_order: number;
  emoji: string | null;
  image_url: string | null;
  name_zh: string;
  name_en: string;
  name_ja: string | null;
  name_ko: string | null;
  tagline_zh: string;
  tagline_en: string;
  tagline_ja: string | null;
  tagline_ko: string | null;
  prompt_zh: string;
  prompt_en: string;
}

function rowToPersona(r: PersonaRow): Persona {
  return {
    id: r.id,
    system: r.system,
    tier: r.tier,
    emoji: r.emoji ?? "",
    nameZh: r.name_zh,
    nameEn: r.name_en,
    nameJa: r.name_ja ?? undefined,
    nameKo: r.name_ko ?? undefined,
    taglineZh: r.tagline_zh,
    taglineEn: r.tagline_en,
    taglineJa: r.tagline_ja ?? undefined,
    taglineKo: r.tagline_ko ?? undefined,
    promptZh: r.prompt_zh,
    promptEn: r.prompt_en,
  };
}

export async function fetchPersonaById(id: string | null | undefined): Promise<Persona | null> {
  if (!id) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("personas")
      .select("*")
      .eq("id", id)
      .eq("active", true)
      .maybeSingle();
    if (error || !data) return null;
    return rowToPersona(data as PersonaRow);
  } catch {
    return null;
  }
}

/**
 * DB 優先;查不到就退回 static lib/personas.ts。
 * Premium gating:DB 路徑也會檢查 isActive,跟 static 版本行為一致。
 */
export async function resolvePersonaServer(
  id: string | null | undefined,
  isActive: boolean,
): Promise<Persona> {
  const fromDb = await fetchPersonaById(id);
  if (fromDb) {
    if (fromDb.tier === "premium" && !isActive) {
      // 被鎖了 → 退回該系統預設(也試 DB 一次,沒就 static)
      const defaultId = getDefaultPersonaIdForSystem(fromDb.system);
      const fallback = await fetchPersonaById(defaultId);
      return fallback ?? resolvePersonaStatic(defaultId, isActive);
    }
    return fromDb;
  }
  // DB 沒這個 id → static fallback(包含 premium gating)
  return resolvePersonaStatic(id, isActive);
}
