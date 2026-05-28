/**
 * NativePurchaseNotice —— 在 native 殼內顯示「購買管道不同」的告示。
 *
 * 取代:
 *   舊版 TwaPurchaseNotice.tsx(2026-04-25 deprecated,因違反 Play anti-steering)。
 *
 * 用途:
 *   提示使用者「目前在 App 內某些購買方式不一樣」,但**不導引到外部頁面**。
 *   例:
 *     - iOS 第一版若走 Reader App 模式 → 顯示「iOS 版暫不販售」純陳述
 *     - TWA 內如果遇到某個 SKU 在 Play 還沒建好 → 顯示「目前不可購買」
 *
 * 合規重點(避免 Apple 4.7 / Google anti-steering 退件):
 *   1. ❌ 不能提到「網頁版」「browser」「web」之類字眼
 *   2. ❌ 不能放任何超連結 / URL / domain 名稱
 *   3. ❌ 不能放「Continue on web」「在瀏覽器中購買」的 CTA
 *   4. ✅ 純粹中性陳述「目前不可購買」或「請使用其他平台」
 *   5. ✅ 可以放「了解更多」連到 App 內的 FAQ / 客服頁(不導出 App)
 *
 * 文案在 i18n/messages/*.ts 找:
 *   - notices.nativePurchase.iosUnavailable
 *   - notices.nativePurchase.twaUnavailable
 *   - notices.nativePurchase.iosSubscriptionOnly
 *   (若還沒加,本元件 fallback 顯示繁中預設文案)
 */

"use client";

import { useIsNativeWrapper } from "@/lib/hooks/useIsNativeWrapper";
import type { Platform } from "@/lib/billing/platform";

interface Props {
  /**
   * 變體:
   *   - "credit_pack"    → 點數包不可購買
   *   - "subscription"   → 訂閱不可購買
   *   - "general"        → 通用「此功能在 App 內不可用」
   */
  variant?: "credit_pack" | "subscription" | "general";
  /**
   * 是否在 web 環境也顯示。
   * 預設 false(web 應該直接顯示購買 UI,不需要這個告示)。
   * 設 true 用於「全平台都還沒上線」的功能。
   */
  showOnWeb?: boolean;
  /**
   * 自訂文案。傳了就完全覆蓋預設文案(包含 platform 條件)。
   * 用於 i18n 從外面注入翻譯字串。
   */
  message?: string;
  /** 額外 className(對外暴露讓 caller 客製化邊距等) */
  className?: string;
}

const DEFAULT_MESSAGES: Record<Platform, Record<"credit_pack" | "subscription" | "general", string>> = {
  ios: {
    credit_pack: "目前此版本不販售點數方案。",
    subscription: "目前此版本不販售訂閱方案。",
    general: "此功能目前在這個版本不可用。",
  },
  twa: {
    credit_pack: "此商品暫時無法購買,請稍後再試。",
    subscription: "此訂閱方案暫時無法購買,請稍後再試。",
    general: "此功能目前不可用,請稍後再試。",
  },
  web: {
    credit_pack: "此商品暫時無法購買,請稍後再試。",
    subscription: "此訂閱方案暫時無法購買,請稍後再試。",
    general: "此功能目前不可用,請稍後再試。",
  },
};

export default function NativePurchaseNotice({
  variant = "general",
  showOnWeb = false,
  message,
  className = "",
}: Props) {
  const platform = useIsNativeWrapper();

  // hydration 前 platform 為 null → 暫時不渲染,避免 SSR/CSR 文案不一致
  if (platform === null) return null;

  // web 預設不顯示
  if (platform === "web" && !showOnWeb) return null;

  const text = message ?? DEFAULT_MESSAGES[platform][variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border border-gray-700/60 bg-gray-900/40 p-4 text-sm text-gray-300 ${className}`}
    >
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}

/**
 * Inline 版本 —— 短一行、不需要邊框背景,放在 button 旁邊。
 * 例如 InsufficientCreditsModal 內,沒點數時 button 是「取消」,旁邊用 inline 提示「目前不可購買」。
 */
export function NativePurchaseNoticeInline({
  variant = "general",
  message,
  className = "",
}: Pick<Props, "variant" | "message" | "className">) {
  const platform = useIsNativeWrapper();
  if (platform === null) return null;
  if (platform === "web") return null;

  const text = message ?? DEFAULT_MESSAGES[platform][variant];

  return (
    <span className={`text-xs text-gray-400 ${className}`} role="status">
      {text}
    </span>
  );
}
