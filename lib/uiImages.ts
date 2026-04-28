/**
 * uiImages.ts — server-side helper to read the UI image slot map.
 *
 * Mirrors what /api/ui-images returns, but accessible directly from server
 * components / route handlers without an HTTP hop. Returns {} on any error
 * (the UI is designed to fall back to emoji whenever a slot is missing).
 */

import { createClient } from "@/lib/supabase/server";

export type UiImagesMap = Record<string, string>;

export async function getUiImages(): Promise<UiImagesMap> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_content")
      .select("value")
      .eq("key", "ui_images")
      .maybeSingle();
    if (error || !data?.value) return {};
    return data.value as UiImagesMap;
  } catch {
    return {};
  }
}
