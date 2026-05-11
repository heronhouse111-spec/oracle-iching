"use client";

/**
 * CollectionRewardToast — 圖鑑頁(/tarot/cards、/iching/hexagrams)的未登入禮物提示
 *
 * 設計策略:
 *   ① 只對「未登入」顯示。已登入(authenticated === true)或還沒確認(null)都不出。
 *   ② 1.2 秒延遲滑入,讓使用者先看到圖鑑本身,再被引導 — 避免「秒跳廣告」感。
 *   ③ 按 X 後 7 天內不再煩同一台裝置(localStorage)。
 *   ④ 文案走「損失規避 + 禮物錨點」:強調「不登入抽到的卡會被遺忘」+ 具體 30 點。
 *   ⑤ 位置:桌機右下浮動,手機底部全寬(margin 留空)。CTA 為全寬主按鈕。
 *
 * 跟既有 CollectionProgress 的未登入 CTA 不衝突 — 那邊是 inline 區塊,這邊是 floating
 * "額外推一把"。兩者文案稍有差異避免重複:CollectionProgress 列價值 bullet、Toast 講情感。
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";

const STORAGE_KEY = "collection_reward_toast_dismissed_at";
const SUPPRESS_DAYS = 7;

interface Props {
  /**
   * 父層(TarotCardsIndexView / HexagramsIndexView)從 CollectionProgress 拿到的 auth 狀態。
   *   - true  → 已登入,完全不顯示
   *   - false → 未登入,該秀
   *   - null  → 還沒拿到 API 回應,先別秀(避免 SSR 後閃一下)
   */
  authenticated: boolean | null;
  /**
   * 場景文案:卡片用 "tarot"、卦象用 "iching"。讓 headline 微調更貼題。
   */
  surface: "tarot" | "iching";
}

export default function CollectionRewardToast({ authenticated, surface }: Props) {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 還沒拿到 auth 狀態 → 先不動
    if (authenticated === null) return;
    // 已登入 → 完全不顯示
    if (authenticated === true) return;

    // 檢查 localStorage 7 天 cooldown
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const dismissedAt = parseInt(raw, 10);
        const now = Date.now();
        if (Number.isFinite(dismissedAt) && now - dismissedAt < SUPPRESS_DAYS * 86400_000) {
          return;
        }
      }
    } catch {
      /* localStorage 不能用就直接放行 */
    }

    // 1.2 秒延遲,讓使用者先看到圖鑑
    const timer = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(timer);
  }, [authenticated]);

  const handleDismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const headline =
    surface === "tarot"
      ? t(
          "別讓你抽到的塔羅牌只是看過就忘",
          "Don't let the tarot cards you draw slip away",
          "引いたタロットを記憶に埋もれさせないで",
          "뽑은 타로 카드를 잊혀지게 두지 마세요",
        )
      : t(
          "別讓你抽到的卦只是看過就忘",
          "Don't let the hexagrams you draw slip away",
          "引いた卦を記憶に埋もれさせないで",
          "뽑은 괘를 잊혀지게 두지 마세요",
        );

  const body = t(
    "登入後永久保留收藏,集滿里程碑自動贈點。首次登入再送 30 點 — 等於 6 次免費占卜。",
    "Sign in to keep your collection forever and earn credit bonuses at milestones. First-time login: 30 free credits = 6 readings on us.",
    "ログインで収集を永久保存、達成ごとにポイント贈呈。初回登録は 30 ポイント無料 = 占い 6 回分。",
    "로그인하면 수집을 영구 보관, 마일스톤 달성마다 보너스. 첫 로그인 30 포인트 = 점 6회 무료.",
  );

  const ctaText = t(
    "免費登入領取 30 點",
    "Sign in — claim 30 free credits",
    "ログインして 30 ポイント受取",
    "로그인하고 30 포인트 받기",
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="reward-toast"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          role="dialog"
          aria-label={headline}
          style={{
            position: "fixed",
            zIndex: 90,
            // 桌機 → 右下角浮動
            // 手機 → 底部全寬 (透過 max-width + 兩側 margin 自動退讓);bottom 距離留給 mini-player
            right: "max(16px, env(safe-area-inset-right))",
            left: "auto",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
            maxWidth: "min(360px, calc(100vw - 32px))",
            width: "calc(100vw - 32px)",
            // 透過 right + 自動 left 在大螢幕固定右下;小螢幕讓 margin 把它推到中下
          }}
        >
          <div
            style={{
              position: "relative",
              padding: "18px 18px 16px",
              borderRadius: 14,
              background:
                "linear-gradient(135deg, rgba(13,13,43,0.96), rgba(76,29,149,0.55))",
              border: "1px solid rgba(212,168,85,0.55)",
              boxShadow:
                "0 14px 40px rgba(0,0,0,0.5), 0 0 24px rgba(212,168,85,0.25)",
              backdropFilter: "blur(8px)",
              color: "#e8e8f0",
              fontFamily: "inherit",
            }}
          >
            {/* X dismiss */}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={t("關閉", "Close", "閉じる", "닫기")}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(229,229,240,0.7)",
                fontSize: 14,
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              ✕
            </button>

            {/* Icon + headline */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 10,
                paddingRight: 28, // 留位給 X
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  lineHeight: 1,
                  flexShrink: 0,
                  filter: "drop-shadow(0 2px 4px rgba(212,168,85,0.4))",
                }}
                aria-hidden
              >
                🎁
              </div>
              <h3
                style={{
                  margin: 0,
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.45,
                  color: "#fde68a",
                  letterSpacing: 0.3,
                }}
              >
                {headline}
              </h3>
            </div>

            {/* Body */}
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 12.5,
                lineHeight: 1.7,
                color: "rgba(229,229,240,0.88)",
              }}
            >
              {body}
            </p>

            {/* Primary CTA */}
            <Link
              href="/login"
              onClick={() => {
                // 使用者點了 CTA 也視為「處理過」,7 天內不再煩
                try {
                  localStorage.setItem(STORAGE_KEY, String(Date.now()));
                } catch {
                  /* ignore */
                }
              }}
              style={{
                display: "block",
                padding: "11px 16px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                color: "#0a0a1a",
                fontSize: 14,
                fontWeight: 800,
                textDecoration: "none",
                textAlign: "center",
                boxShadow: "0 4px 14px rgba(212,168,85,0.45)",
                letterSpacing: 0.5,
              }}
            >
              ✦ {ctaText} →
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
