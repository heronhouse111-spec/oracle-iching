/**
 * 音樂相關共用 TS 型別 — DB row 對應 + UI 用簡化版。
 * Phase 27。
 */

export type MusicCategoryId =
  | "meditation"
  | "mystery"
  | "nature"
  | "oriental"
  | "focus"
  | "dream";

export type MusicVisibility =
  | "private"
  | "public"
  | "removed_by_user"
  | "removed_by_moderation";

export type MusicProvider = "stable_audio" | "mubert" | "platform_seed";

export type MusicTier = "top10" | "top50" | "top100" | "long_tail";

export interface MusicTrack {
  id: string;
  creatorId: string | null;
  creatorDisplayName: string | null;
  title: string;
  prompt: string;
  promptLocale: "zh" | "en" | "ja" | "ko";
  categoryId: MusicCategoryId;
  audioUrl: string;
  durationSeconds: number;
  provider: MusicProvider;
  visibility: MusicVisibility;
  isSeed: boolean;
  isFree: boolean;
  playCount: number;
  collectCount: number;
  creatorEarningsTotal: number;
  publishedAt: string | null;
  createdAt: string;
}

export const CATEGORY_META: {
  id: MusicCategoryId;
  emoji: string;
  labelZh: string;
  labelEn: string;
  labelJa: string;
  labelKo: string;
}[] = [
  { id: "meditation", emoji: "🧘", labelZh: "冥想", labelEn: "Meditation", labelJa: "瞑想", labelKo: "명상" },
  { id: "mystery",    emoji: "🔮", labelZh: "神秘", labelEn: "Mystery",    labelJa: "神秘", labelKo: "신비" },
  { id: "nature",     emoji: "🌿", labelZh: "自然", labelEn: "Nature",     labelJa: "自然", labelKo: "자연" },
  { id: "oriental",   emoji: "🏮", labelZh: "東方", labelEn: "Oriental",   labelJa: "東洋", labelKo: "동양" },
  { id: "focus",      emoji: "🎯", labelZh: "專注", labelEn: "Focus",      labelJa: "集中", labelKo: "집중" },
  { id: "dream",      emoji: "🌙", labelZh: "夢境", labelEn: "Dream",      labelJa: "夢境", labelKo: "꿈" },
];

export function categoryLabel(
  id: MusicCategoryId,
  locale: "zh" | "en" | "ja" | "ko",
): string {
  const c = CATEGORY_META.find((x) => x.id === id);
  if (!c) return id;
  if (locale === "en") return c.labelEn;
  if (locale === "ja") return c.labelJa;
  if (locale === "ko") return c.labelKo;
  return c.labelZh;
}

export function categoryEmoji(id: MusicCategoryId): string {
  return CATEGORY_META.find((x) => x.id === id)?.emoji ?? "🎵";
}

export function buildAudioUrl(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/app-music/${storagePath}`;
}
