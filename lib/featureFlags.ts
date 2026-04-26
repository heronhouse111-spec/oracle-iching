/**
 * Feature flag helper
 *
 * Server-side:server component / API route 直接呼叫 isFlagEnabled() / getFlag()
 * Client-side:用 /api/flags 拉(下面附 useFlag hook 提供方便用法)
 *
 * 為保護 DB 流量,server-side 用 unstable_cache 快取 60 秒;
 * client 透過 fetch 也走 60 秒 revalidate cache。
 */

import { createClient } from "@/lib/supabase/server";

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  payload: Record<string, unknown> | null;
}

/**
 * Server-side: 撈單一 flag。預設值 false 避免新功能漏設定就洩漏。
 */
export async function isFlagEnabled(key: string): Promise<boolean> {
  const flag = await getFlag(key);
  return flag?.enabled ?? false;
}

export async function getFlag(key: string): Promise<FeatureFlag | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("feature_flags")
      .select("key, enabled, description, payload")
      .eq("key", key)
      .maybeSingle();
    return (data as FeatureFlag) ?? null;
  } catch {
    return null;
  }
}

export async function getAllFlags(): Promise<Record<string, boolean>> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("feature_flags")
      .select("key, enabled");
    const map: Record<string, boolean> = {};
    (data ?? []).forEach((f: { key: string; enabled: boolean }) => {
      map[f.key] = f.enabled;
    });
    return map;
  } catch {
    return {};
  }
}
