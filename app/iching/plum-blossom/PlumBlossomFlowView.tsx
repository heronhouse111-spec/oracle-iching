"use client";

/**
 * /iching/plum-blossom — 梅花易數「起卦工具」頁
 *
 * 流程定位:
 *   - 不再有設問頁、類別選擇、AI 串流、結果展示。
 *   - 只負責「起卦動畫 + 用客端時間算出本卦」這一段過場。
 *   - 算完後把卦資料 + question/category 寫入 sessionStorage,
 *     再 router.push 回首頁 `?resumeFlow=method-result` 由首頁 result step 接手
 *     (顯示卦象 / AI 解卦 / 分享 / 衍伸對話 / 歷史等共用 UI)。
 *
 * 進場條件:
 *   必須帶 ?resumeFlow=cast,且 sessionStorage("iching_resume_state") 有 q+cat。
 *   缺一就 router.push("/iching") — 不再支援獨立設問。
 *
 * 動畫節奏:
 *   ☯ 脈動 ~1.6s,給使用者「起卦中」的儀式感,但又不會等太久。
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import { castPlumBlossom } from "@/lib/plumBlossom";
import { questionCategories } from "@/lib/divination";

// 跟 home page 那邊讀取的 key shape 對齊 — 不要拼錯
const RESUME_STATE_KEY = "iching_resume_state";
const METHOD_RESULT_KEY = "iching_method_result_state";

export default function PlumBlossomFlowView() {
  const { t } = useLanguage();
  const router = useRouter();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (typeof window === "undefined") return;

    // ── 1. 入場守門:沒帶 ?resumeFlow=cast 就直接送回 /iching ──
    const params = new URLSearchParams(window.location.search);
    if (params.get("resumeFlow") !== "cast") {
      router.replace("/iching");
      return;
    }

    // ── 2. 讀 sessionStorage 拿 question + category ──
    let resumeState: { question?: string; category?: string } | null = null;
    try {
      const raw = sessionStorage.getItem(RESUME_STATE_KEY);
      if (raw) resumeState = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    if (
      !resumeState?.question?.trim() ||
      !resumeState?.category ||
      !questionCategories.some((c) => c.id === resumeState.category)
    ) {
      // 沒前置 state 就退回去重新走完整流程
      router.replace("/iching");
      return;
    }

    // ── 3. 起卦動畫 ~1.6s,然後算卦 + 寫 method-result + 跳回首頁 ──
    const castEpochMs = Date.now();
    const timer = window.setTimeout(() => {
      try {
        const result = castPlumBlossom(new Date(castEpochMs));
        const payload = {
          method: "plum-blossom" as const,
          question: resumeState!.question!.trim(),
          category: resumeState!.category!,
          hexagramNumber: result.primaryHex.number,
          primaryLines: result.primaryLines,
          changingLines: result.changingLines,
          relatingNumber: result.relatingHex.number,
          relatingLines: result.relatingLines,
          castEpochMs,
        };
        sessionStorage.setItem(METHOD_RESULT_KEY, JSON.stringify(payload));
        sessionStorage.removeItem(RESUME_STATE_KEY);
        router.replace("/?resumeFlow=method-result");
      } catch (e) {
        console.error("[plum-blossom] cast/redirect failed:", e);
        router.replace("/iching");
      }
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "16px",
        textAlign: "center",
      }}
    >
      <header style={{ marginBottom: 28, marginTop: 32 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: 3,
            color: "rgba(212,168,85,0.7)",
            marginBottom: 6,
          }}
        >
          {t(
            "梅花易數 · 時間起卦",
            "PLUM BLOSSOM · TIME CASTING",
            "梅花易数 · 時間起卦",
            "매화역수 · 시간 기괘"
          )}
        </p>
        <h1
          className="text-gold-gradient"
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 28,
            fontWeight: 700,
            margin: 0,
          }}
        >
          {t("起卦中…", "Casting…", "起卦中…", "기괘 중…")}
        </h1>
      </header>

      <div style={{ padding: "60px 0" }}>
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            fontSize: 64,
            color: "#d4a855",
            lineHeight: 1,
            marginBottom: 18,
            filter: "drop-shadow(0 0 20px rgba(212,168,85,0.55))",
          }}
        >
          ☯
        </motion.div>
        <p
          style={{
            color: "rgba(192,192,208,0.85)",
            fontSize: 14,
            lineHeight: 1.85,
          }}
        >
          {t(
            "用此刻的年月日時為你起卦…",
            "Casting from this very moment of year, month, day, and hour…",
            "此の刻の年月日時から卦を立てています…",
            "지금 이 순간의 연월일시로 괘를 세우는 중…"
          )}
        </p>
      </div>
    </div>
  );
}
