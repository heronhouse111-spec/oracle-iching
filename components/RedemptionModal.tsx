"use client";

/**
 * RedemptionModal — 重複卡兌換點數
 *
 * 玩家拿同卡的 10 張重複(obtain_count >= 10)兌換 N 點。比率(每組幾點)
 * 由 admin 在 /admin/credit-costs 改 REDEEM_DUPLICATE_RATE,parent 透過 props 傳入。
 *
 * 流程:
 *   1. 玩家在圖鑑點「↺ 兌換」pill → parent 開 modal,傳入 cardId / cardCount / rate
 *   2. 玩家用 +/- 選組數(每組 10 張),按「兌換」
 *   3. POST /api/collection/redeem,成功 → onSuccess(result),parent 自己更新本地 count
 *      + 彈 toast(沿用 NewCardToast 的 isNew=false 變體 — 避免引入新元件)
 *
 * 失敗顯示 inline 錯誤(insufficient_duplicates / redemption_disabled / 網路錯誤)。
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/i18n/LanguageContext";

const CARDS_PER_SET = 10;

export interface RedemptionResult {
  countAfter: number;
  sets: number;
  creditsGranted: number;
  newBalance: number;
  rate: number;
}

export interface RedemptionModalProps {
  open: boolean;
  /** 收藏分類 — 對應 /api/collection/redeem 的 collectionType */
  collectionType: "iching" | "iching_trigram" | "tarot";
  /** 該卡 id(hexagram '1'..'64' / trigram code / tarot slug) */
  cardId: string;
  /** 顯示用卡名(parent 已 i18n 過) */
  cardName: string;
  /** 卡圖 URL(可選 — trigram / hexagram 直接給 storage url、tarot 給 imagePath) */
  cardImageUrl?: string;
  /** 目前持有張數(由 parent 從 obtainCounts 傳) */
  currentCount: number;
  /** 每組(10 張)可換的點數,從 server 端 getCreditCost("REDEEM_DUPLICATE_RATE") 拿 */
  rate: number;
  onClose: () => void;
  onSuccess: (result: RedemptionResult) => void;
}

export default function RedemptionModal({
  open,
  collectionType,
  cardId,
  cardName,
  cardImageUrl,
  currentCount,
  rate,
  onClose,
  onSuccess,
}: RedemptionModalProps) {
  const { t } = useLanguage();
  const [sets, setSets] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxSets = Math.floor(currentCount / CARDS_PER_SET);
  const canRedeem = maxSets >= 1 && rate > 0;

  // ESC 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  // open 時重置
  useEffect(() => {
    if (open) {
      setSets(1);
      setError(null);
      setSubmitting(false);
    }
  }, [open, cardId]);

  if (!open) return null;

  const totalCards = sets * CARDS_PER_SET;
  const totalCredits = sets * rate;
  const countAfter = currentCount - totalCards;

  const handleSubmit = async () => {
    if (!canRedeem || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/collection/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionType, cardId, sets }),
      });
      const json = await res.json();
      if (!res.ok) {
        const code = json.error as string | undefined;
        if (code === "unauthorized") {
          setError(t("請先登入", "Please sign in", "ログインしてください", "로그인해주세요"));
        } else if (code === "insufficient_duplicates") {
          setError(
            t(
              "重複張數不足,請刷新頁面",
              "Not enough duplicates, please refresh",
              "重複枚数が不足しています、再読み込みしてください",
              "중복 수량이 부족합니다, 새로고침해주세요",
            ),
          );
        } else if (code === "redemption_disabled") {
          setError(
            t(
              "兌換功能暫時關閉",
              "Redemption is temporarily disabled",
              "交換機能は一時停止中です",
              "교환 기능이 일시 중지되었습니다",
            ),
          );
        } else {
          setError(
            t(
              `兌換失敗:${json.detail ?? code ?? res.status}`,
              `Redemption failed: ${json.detail ?? code ?? res.status}`,
              `交換失敗:${json.detail ?? code ?? res.status}`,
              `교환 실패: ${json.detail ?? code ?? res.status}`,
            ),
          );
        }
        setSubmitting(false);
        return;
      }
      onSuccess(json as RedemptionResult);
    } catch (e) {
      setError(
        t(
          `網路錯誤:${e instanceof Error ? e.message : String(e)}`,
          `Network error: ${e instanceof Error ? e.message : String(e)}`,
          `ネットワークエラー:${e instanceof Error ? e.message : String(e)}`,
          `네트워크 오류: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={() => !submitting && onClose()}
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
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mystic-card"
        style={{
          maxWidth: 380,
          width: "100%",
          padding: "24px 22px 18px",
          textAlign: "center",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          disabled={submitting}
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
            cursor: submitting ? "not-allowed" : "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <h3
          className="text-gold-gradient"
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 18,
            fontWeight: 700,
            marginTop: 0,
            marginBottom: 14,
          }}
        >
          ↺ {t("重複卡兌換", "Redeem Duplicates", "重複カード交換", "중복 카드 교환")}
        </h3>

        {/* 卡圖 + 名稱 */}
        <div
          style={{
            display: "flex",
            gap: 14,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          {cardImageUrl && (
            <div
              style={{
                width: 64,
                aspectRatio: "9 / 14",
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid rgba(212,168,85,0.3)",
                flexShrink: 0,
                background: "rgba(13,13,43,0.5)",
              }}
            >
              {/* 用 next/image 拿不到外部 URL allowlist 時 fallback 一般 img */}
              {cardImageUrl.startsWith("/") ? (
                <Image
                  src={cardImageUrl}
                  alt={cardName}
                  width={120}
                  height={186}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cardImageUrl}
                  alt={cardName}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              )}
            </div>
          )}
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'Noto Serif TC', serif",
                fontSize: 15,
                color: "#fde68a",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              {cardName}
            </div>
            <div style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}>
              {t("目前持有", "You have", "現在の所持", "현재 보유")}{" "}
              <strong style={{ color: "#fde68a" }}>×{currentCount}</strong>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(192,192,208,0.55)",
                marginTop: 2,
              }}
            >
              {t(
                `每 ${CARDS_PER_SET} 張 = ${rate} 點`,
                `${CARDS_PER_SET} cards = ${rate} credits`,
                `${CARDS_PER_SET} 枚 = ${rate} ポイント`,
                `${CARDS_PER_SET}장 = ${rate} 포인트`,
              )}
            </div>
          </div>
        </div>

        {!canRedeem ? (
          <div
            style={{
              padding: "14px 12px",
              borderRadius: 8,
              background: "rgba(192,192,208,0.06)",
              color: "rgba(192,192,208,0.7)",
              fontSize: 12,
              marginBottom: 14,
              lineHeight: 1.7,
            }}
          >
            {rate <= 0
              ? t(
                  "兌換功能目前關閉",
                  "Redemption is currently disabled",
                  "交換機能は現在停止中",
                  "교환 기능이 현재 중지됨",
                )
              : t(
                  `需要至少 ${CARDS_PER_SET} 張同卡重複才能兌換`,
                  `Need at least ${CARDS_PER_SET} duplicates of the same card`,
                  `同じカードを ${CARDS_PER_SET} 枚以上集める必要があります`,
                  `같은 카드를 ${CARDS_PER_SET}장 이상 모아야 합니다`,
                )}
          </div>
        ) : (
          <>
            {/* 組數選擇器 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setSets((s) => Math.max(1, s - 1))}
                disabled={sets <= 1 || submitting}
                aria-label={t("減少", "Decrease", "減少", "감소")}
                style={stepBtnStyle(sets > 1 && !submitting)}
              >
                −
              </button>
              <div
                style={{
                  minWidth: 110,
                  fontSize: 13,
                  color: "#e8e8f0",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 700, color: "#fde68a", fontSize: 15 }}>
                  {sets} {t("組", "set(s)", "セット", "세트")}
                </div>
                <div style={{ fontSize: 11, color: "rgba(192,192,208,0.6)" }}>
                  {totalCards} {t("張", "cards", "枚", "장")} →{" "}
                  <strong style={{ color: "#6ee7b7" }}>+{totalCredits} ✦</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSets((s) => Math.min(maxSets, s + 1))}
                disabled={sets >= maxSets || submitting}
                aria-label={t("增加", "Increase", "増加", "증가")}
                style={stepBtnStyle(sets < maxSets && !submitting)}
              >
                +
              </button>
            </div>

            <div
              style={{
                fontSize: 11,
                color: "rgba(192,192,208,0.5)",
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              {t(
                `兌換後剩 ×${countAfter}(收藏記錄保留)`,
                `Will leave ×${countAfter} (collection record kept)`,
                `交換後 ×${countAfter} 残ります(コレクション記録は保持)`,
                `교환 후 ×${countAfter} 남음 (수집 기록 유지)`,
              )}
            </div>
          </>
        )}

        {error && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "#fca5a5",
              fontSize: 12,
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {/* 主按鈕 */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canRedeem || submitting}
          style={{
            display: "block",
            width: "100%",
            padding: "11px 16px",
            borderRadius: 10,
            background: canRedeem
              ? "linear-gradient(135deg, #d4a855 0%, #b88a3f 100%)"
              : "rgba(192,192,208,0.12)",
            color: canRedeem ? "#1a1530" : "rgba(192,192,208,0.5)",
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: canRedeem && !submitting ? "pointer" : "not-allowed",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting
            ? t("兌換中…", "Redeeming…", "交換中…", "교환 중…")
            : canRedeem
              ? t(
                  `兌換 +${totalCredits} 點`,
                  `Redeem +${totalCredits} credits`,
                  `+${totalCredits} ポイントに交換`,
                  `+${totalCredits} 포인트로 교환`,
                )
              : t("無法兌換", "Cannot redeem", "交換不可", "교환 불가")}
        </button>
      </div>
    </div>
  );
}

const stepBtnStyle = (enabled: boolean): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  border: enabled
    ? "1px solid rgba(212,168,85,0.5)"
    : "1px solid rgba(192,192,208,0.15)",
  background: enabled ? "rgba(212,168,85,0.08)" : "transparent",
  color: enabled ? "#fde68a" : "rgba(192,192,208,0.3)",
  fontSize: 18,
  fontWeight: 700,
  cursor: enabled ? "pointer" : "not-allowed",
  lineHeight: 1,
});
