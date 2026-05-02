"use client";

/**
 * NewCardToast — 「✨ 新卡牌解鎖!」浮動通知
 *
 * 給 daily / 主流占卜結果頁用。當 server response header 帶 X-Collection-IsNew=1
 * 或 X-Collection-NewCount > 0 時,顯示一個 ~5 秒會自動消失的 toast。
 *
 * 也會顯示因里程碑獲得的 credits(若 X-Collection-Rewards > 0)。
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  /** 是否顯示 toast — controlled by parent */
  show: boolean;
  /** 卡牌類型 — 決定點擊時跳到哪個圖鑑頁 */
  type: "iching" | "tarot";
  /** 新卡的中文/英文/日文/韓文顯示名(parent 自己選最合適的字串) */
  cardName: string;
  /** 該 type 目前已收 distinct 數;會顯示 「23/64」 */
  collectionCount: number;
  /** 同 type 卡牌總數(易經 64 / 塔羅 78) */
  total: number;
  /** 這次因里程碑得到的 credits 加總(可能 0) */
  rewardCredits: number;
  /** 自動消失後通知 parent 把 show 設回 false */
  onDismiss: () => void;
  /** 自動消失秒數,預設 6s */
  durationMs?: number;
}

export default function NewCardToast({
  show,
  type,
  cardName,
  collectionCount,
  total,
  rewardCredits,
  onDismiss,
  durationMs = 6000,
}: Props) {
  const { t } = useLanguage();
  const [enter, setEnter] = useState(false);

  useEffect(() => {
    if (!show) return;
    const t1 = setTimeout(() => setEnter(true), 30);
    const t2 = setTimeout(() => setEnter(false), durationMs - 300);
    const t3 = setTimeout(onDismiss, durationMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [show, durationMs, onDismiss]);

  if (!show) return null;

  const indexHref = type === "iching" ? "/iching/hexagrams" : "/tarot/cards";

  return (
    <div
      style={{
        position: "fixed",
        top: 80,
        left: "50%",
        transform: `translateX(-50%) translateY(${enter ? 0 : -20}px)`,
        opacity: enter ? 1 : 0,
        transition: "opacity 0.3s ease, transform 0.3s ease",
        zIndex: 9999,
        maxWidth: "92%",
        width: 380,
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(13,13,43,0.95), rgba(30,15,60,0.95))",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(212,168,85,0.6)",
          borderRadius: 14,
          padding: "14px 18px",
          boxShadow: "0 10px 40px rgba(212,168,85,0.25), 0 4px 16px rgba(0,0,0,0.5)",
          color: "#e8e8f0",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 28, lineHeight: 1, marginTop: 2 }}>✨</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Noto Serif TC', serif",
                fontSize: 15,
                fontWeight: 700,
                color: "#fde68a",
                marginBottom: 4,
              }}
            >
              {t("新卡牌解鎖!", "New card unlocked!", "新カード解錠!", "새 카드 잠금 해제!")}
            </div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>{cardName}</div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(192,192,208,0.75)",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span>
                {t("收藏進度", "Collection", "収集進度", "수집 진행")}{" "}
                <strong style={{ color: "#fde68a" }}>
                  {collectionCount}/{total}
                </strong>
              </span>
              {rewardCredits > 0 && (
                <span
                  style={{
                    color: "#6ee7b7",
                    background: "rgba(110,231,183,0.12)",
                    border: "1px solid rgba(110,231,183,0.4)",
                    padding: "1px 8px",
                    borderRadius: 9999,
                  }}
                >
                  +{rewardCredits} ✦
                </span>
              )}
            </div>
            <div style={{ marginTop: 10 }}>
              <Link
                href={indexHref}
                style={{
                  fontSize: 12,
                  color: "#d4a855",
                  textDecoration: "none",
                  borderBottom: "1px dashed rgba(212,168,85,0.5)",
                  paddingBottom: 1,
                }}
              >
                {t("查看收藏 →", "View collection →", "コレクションを見る →", "수집 보기 →")}
              </Link>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label={t("關閉", "Close", "閉じる", "닫기")}
            style={{
              background: "none",
              border: "none",
              color: "rgba(192,192,208,0.5)",
              fontSize: 18,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
