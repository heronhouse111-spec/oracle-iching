"use client";

/**
 * DailyCheckInBanner — 每日簽到鉤子(phase 34)
 *
 * 顯示在首頁頂部(Header 之下、占卜流程之上)。三狀態:
 *   1. 未簽到 → 金色 banner + 「✨ 領取每日免費 Yes/No」按鈕
 *   2. 已簽到未用 → 綠色 banner + 「立即占卜 →」按鈕(導去 /yes-no)
 *   3. 已用 → 灰色 banner + 「明日再來」(可選擇隱藏,目前保留作 retention 暗示)
 *
 * 未登入(authenticated=false):隱藏整個 banner。Banner 不是登入鉤子,
 * 登入鉤子在主流程其他地方做(避免 banner 太雜)。
 *
 * Behavior:
 *   - mount 時 GET /api/daily-checkin/status 取狀態
 *   - 點「領取」→ POST /api/daily-checkin/claim → optimistic 切換到「已簽到」狀態
 *   - 點「立即占卜」→ window.location 跳 /yes-no(把 yes/no 流程獨立成一頁了,
 *     不直接 in-place 觸發,避免主流程占卜 state 被搶)
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";

interface CheckinStatus {
  authenticated: boolean;
  claimed: boolean;
  used: boolean;
}

export default function DailyCheckInBanner() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<CheckinStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-checkin/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as CheckinStatus;
      setStatus(data);
    } catch {
      /* 沿用舊 status */
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const handleClaim = async () => {
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-checkin/claim", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; reason?: string };
      if (data.ok) {
        // optimistic — 立刻切到「已領取」狀態,避免 banner 閃一下又重新 fetch
        setStatus((prev) =>
          prev ? { ...prev, claimed: true, used: false } : prev
        );
      } else if (data.reason === "ALREADY_CLAIMED_TODAY") {
        await refetch();
      } else {
        setError(t("領取失敗,稍後再試", "Claim failed — try again later", "受け取り失敗、後で再試行", "수령 실패, 나중에 다시 시도"));
      }
    } catch {
      setError(t("網路錯誤", "Network error", "ネットワークエラー", "네트워크 오류"));
    } finally {
      setClaiming(false);
    }
  };

  // 未登入 / 載入中 / 載入失敗 → 不顯示 banner
  if (!status || !status.authenticated) return null;

  // 三種狀態各自的樣式
  const isClaimable = !status.claimed;
  const isReady = status.claimed && !status.used;
  const isUsed = status.claimed && status.used;

  // 已用過 → 收成小提示條(不要太搶眼,避免每天都大佔版面)
  if (isUsed) {
    return (
      <div
        style={{
          margin: "0 auto 12px",
          maxWidth: 640,
          padding: "8px 14px",
          textAlign: "center",
          fontSize: 11.5,
          color: "rgba(192,192,208,0.55)",
          letterSpacing: 0.3,
        }}
      >
        ✓ {t(
          "今日簽到已使用 — 明日再來領免費 Yes/No 占卜",
          "Daily check-in used — come back tomorrow for another free Yes/No",
          "本日のチェックイン使用済 — 明日また無料 Yes/No 占いを受け取れます",
          "오늘 출석체크 사용 완료 — 내일 다시 무료 Yes/No 점 받기"
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        margin: "0 auto 16px",
        maxWidth: 640,
      }}
    >
      <div
        className="mystic-card"
        style={{
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          border: isReady
            ? "1px solid rgba(110,231,183,0.45)"
            : "1px solid rgba(212,168,85,0.5)",
          background: isReady
            ? "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(16,185,129,0.02))"
            : "linear-gradient(135deg, rgba(212,168,85,0.12), rgba(212,168,85,0.02))",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 14.5,
              color: isReady ? "#6ee7b7" : "#d4a855",
              fontWeight: 600,
              marginBottom: 3,
              letterSpacing: 0.3,
            }}
          >
            {isClaimable
              ? t(
                  "✨ 每日簽到 — 領取免費 Yes/No 占卜",
                  "✨ Daily Check-in — Claim Free Yes/No",
                  "✨ デイリーチェックイン — 無料 Yes/No 占いを受け取る",
                  "✨ 매일 출석체크 — 무료 Yes/No 점 받기"
                )
              : t(
                  "🌟 已簽到 — 你有 1 次免費 Yes/No 可用",
                  "🌟 Checked in — 1 free Yes/No reading available",
                  "🌟 チェックイン済 — 無料 Yes/No 占い 1 回利用可",
                  "🌟 출석체크 완료 — 무료 Yes/No 점 1회 사용 가능"
                )}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "rgba(192,192,208,0.65)",
              lineHeight: 1.5,
            }}
          >
            {isClaimable
              ? t(
                  "登入會員專屬,今日點一下即可領取(原 2 點)",
                  "Members only — one click to claim (normally 2 credits)",
                  "会員限定 — 今日ワンクリックで受け取り(通常 2 ポイント)",
                  "회원 전용 — 오늘 한 번 클릭으로 수령 (일반 2 포인트)"
                )
              : t(
                  "立即用免費 token 占卜,不扣點數",
                  "Use your free token now — no credits deducted",
                  "今すぐ無料トークンで占う、ポイント消費なし",
                  "지금 무료 토큰으로 점치기 — 포인트 차감 없음"
                )}
          </div>
          {error && (
            <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>
              {error}
            </div>
          )}
        </div>

        {isClaimable ? (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="btn-gold"
            style={{
              padding: "9px 18px",
              fontSize: 13,
              border: "none",
              cursor: claiming ? "wait" : "pointer",
              opacity: claiming ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {claiming
              ? t("領取中…", "Claiming…", "受け取り中…", "수령 중…")
              : t("領取", "Claim", "受け取る", "수령하기")}
          </button>
        ) : (
          <Link
            href="/yes-no"
            style={{
              padding: "9px 18px",
              fontSize: 13,
              borderRadius: 9999,
              background: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
              color: "#0a0a1a",
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {t("立即占卜 →", "Use Now →", "今すぐ占う →", "지금 점치기 →")}
          </Link>
        )}
      </div>
    </div>
  );
}
