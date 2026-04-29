"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";

export interface InsufficientCreditsModalProps {
  open: boolean;
  required: number;
  onClose: () => void;
}

/**
 * 點數不足 modal —— 402 從 /api/divine|tarot|chat 回來時由 page.tsx 觸發顯示。
 *
 * UI 不分 TWA / web,一律顯示「升級訂閱 / 購買點數」CTA:
 *   - TWA 環境:點下去進到 /account/upgrade 或 /account/credits,
 *               那兩頁會走 Play Billing(Digital Goods API)
 *   - Web 環境:點下去進到同樣的頁面,但走網頁版的 ECPay 流程
 *
 * 為什麼不分 TWA / web:
 *   Google Play 的 anti-steering 政策禁止 TWA 內出現「請到網頁版購買」這類訊息。
 *   舊版本曾經放過顯示 oracle.heronhouse.me URL 的 TWA 分支,**已移除**。
 *   現在 TWA 內的購買流程是用 Play Billing,所以 CTA 直接點下去就 OK。
 */
export default function InsufficientCreditsModal({
  open,
  required,
  onClose,
}: InsufficientCreditsModalProps) {
  const { t } = useLanguage();

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(5,5,20,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mystic-card"
        style={{
          maxWidth: 380,
          width: "100%",
          padding: "28px 24px 20px",
          textAlign: "center",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label={t("關閉", "Close", "閉じる", "닫기")}
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            width: 28,
            height: 28,
            background: "none",
            border: "none",
            color: "rgba(192,192,208,0.6)",
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <div style={{ fontSize: 36, marginBottom: 6 }}>✦</div>
        <h3
          className="text-gold-gradient"
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          {t("點數不足", "Out of Credits", "ポイント不足", "포인트 부족")}
        </h3>
        <p style={{ color: "rgba(192,192,208,0.75)", fontSize: 13, marginBottom: 20 }}>
          {t(
            `這次占卜需要 ${required} 點,你目前的點數不夠。`,
            `This reading costs ${required} credits, and you don't have enough.`,
            `この占いには ${required} ポイントが必要ですが、現在のポイントが足りません。`,
            `이 점에는 ${required} 포인트가 필요하지만 현재 포인트가 부족합니다.`
          )}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* 升級訂閱 —— 主要 CTA */}
          <Link
            href="/account/upgrade"
            onClick={onClose}
            style={{
              display: "block",
              padding: "11px 16px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #d4a855 0%, #b88a3f 100%)",
              color: "#1a1530",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            {t(
              "升級訂閱 · 每月補點數",
              "Upgrade · Monthly Refill",
              "アップグレード · 毎月ポイント補充",
              "업그레이드 · 월마다 포인트 충전"
            )}
          </Link>

          {/* 購買點數包 —— 次要 */}
          <Link
            href="/account/credits"
            onClick={onClose}
            style={{
              display: "block",
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(212,168,85,0.35)",
              color: "#d4a855",
              fontWeight: 600,
              fontSize: 13,
              textDecoration: "none",
              background: "none",
            }}
          >
            {t("購買點數包", "Buy Credit Pack", "ポイントパックを購入", "포인트 팩 구매")}
          </Link>

          {/* 看廣告領點 —— Phase D 才接,先灰掉 */}
          <button
            type="button"
            disabled
            title={t("即將推出", "Coming soon", "近日公開", "곧 출시")}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(192,192,208,0.15)",
              color: "rgba(192,192,208,0.4)",
              fontSize: 13,
              background: "none",
              cursor: "not-allowed",
            }}
          >
            {t(
              "看廣告領點數(即將推出)",
              "Watch Ad for Credits (Coming soon)",
              "広告を見てポイント獲得(近日公開)",
              "광고 보고 포인트 받기(곧 출시)"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
