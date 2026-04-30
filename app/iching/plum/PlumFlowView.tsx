"use client";

/**
 * 梅花易數 · 時間起卦的占卜流程 client view。
 *
 * 階段機:question → breathing → casting → result
 *   - question: 設問 + 類別選擇 + 心法提醒
 *   - breathing: 三秒呼吸圈,「✦ 此刻起卦」大按鈕,點下凍結 new Date() 進 casting
 *   - casting: 公式逐行 fade-in 動畫(年月日時 → mod8 → 上卦,加分 → mod8 → 下卦,mod6 → 動爻)
 *               約 5 秒後自動進 result
 *   - result : 本卦 + 動爻 + 之卦,串接 /api/iching/plum 流式 AI;含「公式攤開」摺疊區
 *
 * 跟既有 direction-hexagram 流程一致:
 *   - 訪客可體驗,但 API 那邊不存 DB、不扣點
 *   - 登入用戶會扣 CREDIT_COSTS.PLUM
 *   - 點數不足 → 402 → 顯示 InsufficientCreditsModal
 */

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import {
  trigramNames,
  hexagramAuspice,
} from "@/data/hexagrams";
import { questionCategories } from "@/lib/divination";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";
import {
  derivePlumFromDate,
  PLUM_TRIGRAM_NAMES_ZH,
  type PlumDerivation,
} from "@/lib/iching/plum";

type Phase = "question" | "breathing" | "casting" | "result";

const AUSPICE_STYLE = {
  great: { bg: "rgba(74,222,128,0.18)", text: "#86efac" },
  mixed: { bg: "rgba(212,168,85,0.20)", text: "#fde68a" },
  challenge: { bg: "rgba(248,113,113,0.18)", text: "#fca5a5" },
} as const;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function PlumFlowView() {
  const { locale, t } = useLanguage();

  const [phase, setPhase] = useState<Phase>("question");
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<string>("general");

  const [derivation, setDerivation] = useState<PlumDerivation | null>(null);
  const [castAt, setCastAt] = useState<Date | null>(null);

  const [aiText, setAiText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [showFormulaDetail, setShowFormulaDetail] = useState(false);

  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });

  const aiCalledRef = useRef(false);

  // ──────────────────────────────────────────
  // 階段切換
  // ──────────────────────────────────────────
  function startBreathing() {
    if (question.trim().length === 0) return;
    setPhase("breathing");
  }

  function castNow() {
    const now = new Date();
    const d = derivePlumFromDate(now);
    setCastAt(now);
    setDerivation(d);
    setPhase("casting");
    // 起卦動畫進行中,提早約 4 秒就觸發 AI,讓 streaming 跟動畫尾段重疊。
    window.setTimeout(() => {
      if (!aiCalledRef.current) {
        aiCalledRef.current = true;
        void callAi(now, d);
      }
    }, 3800);
    // 約 5.4 秒後切到 result 階段(配合下方 reveal 動畫的最後一行 + 緩衝)。
    window.setTimeout(() => {
      setPhase("result");
    }, 5400);
  }

  function reset() {
    setPhase("question");
    setQuestion("");
    setCategory("general");
    setDerivation(null);
    setCastAt(null);
    setAiText("");
    setStreamError(null);
    setShowFormulaDetail(false);
    aiCalledRef.current = false;
  }

  // ──────────────────────────────────────────
  // AI 串流 — 在 castNow 觸發後 ~4 秒呼叫,串流結果跟動畫尾段重疊。
  // 直接收 now/d 引數,避免依賴 setState 排程後的 closure。
  // ──────────────────────────────────────────
  async function callAi(now: Date, d: PlumDerivation) {
    setIsStreaming(true);
    setAiText("");
    setStreamError(null);

    try {
      const res = await fetch("/api/iching/plum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          category,
          locale,
          castAtIso: now.toISOString(),
          numbers: d.numbers,
          sumUpper: d.sumUpper,
          sumLower: d.sumLower,
          upperIndex: d.upperIndex,
          lowerIndex: d.lowerIndex,
          changingLine: d.changingLine,
          primaryLines: d.primaryLines,
          transformedLines: d.transformedLines,
        }),
      });

      if (res.status === 402) {
        const info = await parseInsufficientCredits(res);
        setIsStreaming(false);
        setCreditsModal({ open: true, required: info?.required ?? 5 });
        return;
      }
      if (!res.ok) {
        setIsStreaming(false);
        const txt = await res.text().catch(() => "");
        setStreamError(
          t(
            "AI 服務暫時無法回應,請稍後再試。",
            "AI service is temporarily unavailable, please try again later.",
            "AI サービスが一時的に利用できません。後ほどお試しください。",
            "AI 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도하세요."
          )
        );
        console.error("plum API error:", res.status, txt);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiText((prev) => prev + decoder.decode(value, { stream: true }));
      }
      notifyCreditsChanged();
    } catch (e) {
      console.error(e);
      setStreamError(
        t(
          "發生錯誤,請再試一次。",
          "Something went wrong, please retry.",
          "エラーが発生しました。再試行してください。",
          "오류가 발생했습니다. 다시 시도하세요."
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  const upperTg = derivation ? trigramNames[derivation.upperCode] : null;
  const lowerTg = derivation ? trigramNames[derivation.lowerCode] : null;
  const primaryHex = derivation?.primaryHex;
  const transformedHex = derivation?.transformedHex;
  const auspice = primaryHex ? hexagramAuspice[primaryHex.number] : null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
      <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
        <Link
          href="/iching/methods/plum-blossom"
          style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}
        >
          ← {t(
            "梅花易數介紹",
            "Plum Blossom Method",
            "梅花易数の紹介",
            "매화역수 소개"
          )}
        </Link>
      </nav>

      <header style={{ textAlign: "center", marginBottom: 24 }}>
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
          {phase === "question"
            ? t("靜心設問", "Frame Your Question", "静心して問いを定める", "마음을 가라앉히고 묻기")
            : phase === "breathing"
              ? t("凝神 · 此刻", "Stillness · This Moment", "凝神 · 此刻", "마음 모음 · 지금 이 순간")
              : phase === "casting"
                ? t("起卦中…", "Casting…", "起卦中…", "괘를 세우는 중…")
                : t("梅花卦象", "Plum Blossom Reading", "梅花卦象", "매화 괘상")}
        </h1>
      </header>

      <AnimatePresence mode="wait">
        {/* ────────── Phase 1: 設問 ────────── */}
        {phase === "question" && (
          <motion.div
            key="question"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <section
              style={{
                background: "rgba(13,13,43,0.55)",
                border: "1px solid rgba(212,168,85,0.22)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  color: "rgba(212,168,85,0.7)",
                  marginBottom: 8,
                }}
              >
                {t("心法提醒", "MIND NOTES", "心法", "마음가짐")}
              </div>
              <p style={{ color: "#e8e8f0", fontSize: 13.5, lineHeight: 1.85, margin: 0 }}>
                {t(
                  "梅花易數重「機」— 此刻動念之時,即是答案之時。把問題在心中明確化,然後讓「按下按鈕」這一刻成為答案的引子。同一事不宜反覆占問。",
                  "Plum Blossom Numerology hinges on the moment — when the thought arises, the answer is already here. Bring the question into focus, then let the moment you press the button become the seed of the answer. Don't divine the same matter repeatedly.",
                  "梅花易数は「機」を重んじる — 念が動いた此の瞬間こそが答えの時。問いを心に明確にし、ボタンを押すその一瞬を答えの引き金とせよ。同じ事を繰り返し占うべからず。",
                  "매화역수는 '기(機)'를 중시합니다 — 생각이 움직이는 바로 이 순간이 답의 때. 질문을 마음속에 분명히 한 뒤, 버튼을 누르는 그 순간을 답의 단초로 삼으세요. 같은 일을 반복해 점치지 마세요."
                )}
              </p>
            </section>

            <section style={{ marginBottom: 18 }}>
              <label
                htmlFor="plum-question"
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "rgba(212,168,85,0.85)",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                {t("你的問題", "Your Question", "あなたの質問", "당신의 질문")}
              </label>
              <textarea
                id="plum-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t(
                  "例如:此次面試結果如何?",
                  "e.g. How will this interview go?",
                  "例:今回の面接の結果は?",
                  "예: 이번 면접 결과는 어떨까?"
                )}
                rows={3}
                maxLength={200}
                style={{
                  width: "100%",
                  padding: 12,
                  background: "rgba(13,13,43,0.6)",
                  border: "1px solid rgba(212,168,85,0.3)",
                  borderRadius: 10,
                  color: "#e8e8f0",
                  fontSize: 14,
                  lineHeight: 1.7,
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(192,192,208,0.5)",
                  marginTop: 4,
                  textAlign: "right",
                }}
              >
                {question.length} / 200
              </div>
            </section>

            <section style={{ marginBottom: 22 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: "rgba(212,168,85,0.85)",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                {t("問題類別", "Category", "カテゴリ", "분류")}
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                  gap: 8,
                }}
              >
                {questionCategories.map((c) => {
                  const active = category === c.id;
                  const cName =
                    locale === "ja"
                      ? c.nameJa
                      : locale === "ko"
                        ? c.nameKo
                        : locale === "en"
                          ? c.nameEn
                          : c.nameZh;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      style={{
                        padding: "8px 10px",
                        background: active
                          ? "rgba(212,168,85,0.18)"
                          : "rgba(13,13,43,0.4)",
                        border: active
                          ? "1px solid #d4a855"
                          : "1px solid rgba(212,168,85,0.15)",
                        borderRadius: 8,
                        color: active ? "#fde68a" : "#c0c0d0",
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{c.icon}</span>
                      <span>{cName}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <button
              type="button"
              onClick={startBreathing}
              disabled={question.trim().length === 0}
              style={{
                width: "100%",
                padding: "14px 0",
                background:
                  question.trim().length === 0
                    ? "rgba(212,168,85,0.2)"
                    : "linear-gradient(135deg, #d4a855, #f0d78c)",
                color: "#0a0a1a",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: question.trim().length === 0 ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {t(
                "靜心完畢,凝神此刻 →",
                "I'm Ready · Settle into the Moment →",
                "心が定まった。此刻を凝らす →",
                "마음이 가라앉음 · 지금에 집중 →"
              )}
            </button>

            <div
              style={{
                fontSize: 11,
                color: "rgba(212,168,85,0.6)",
                textAlign: "center",
                marginTop: 10,
              }}
            >
              {t(
                "登入會員自動扣 5 點(訪客可體驗,但不存記錄、無扣點)",
                "5 credits charged for logged-in members (guests can preview without saving or charging)",
                "ログイン会員は 5 ポイント自動消費(ゲストは記録なし・課金なしで体験可)",
                "로그인 회원은 5 포인트 자동 차감(게스트는 저장·차감 없이 체험 가능)"
              )}
            </div>
          </motion.div>
        )}

        {/* ────────── Phase 2: 凝神 / 呼吸 ────────── */}
        {phase === "breathing" && (
          <motion.div
            key="breathing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              minHeight: 400,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 0",
            }}
          >
            <p
              style={{
                color: "rgba(192,192,208,0.85)",
                fontSize: 14,
                lineHeight: 1.85,
                marginBottom: 32,
                textAlign: "center",
                maxWidth: 480,
              }}
            >
              {t(
                "深呼吸,把問題在心中默念三次。當你按下按鈕的那一刻,即是天回應你之刻。",
                "Breathe deeply. Repeat your question silently three times. The moment you press the button is the moment heaven answers.",
                "深く呼吸し、心中で問いを三度念ぜよ。ボタンを押す其の一瞬が、天の応える時。",
                "깊이 호흡하며 마음속으로 질문을 세 번 외세요. 버튼을 누르는 그 순간이 하늘이 답하는 때입니다."
              )}
            </p>

            <motion.div
              animate={{
                scale: [1, 1.18, 1],
                opacity: [0.5, 0.85, 0.5],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                width: 180,
                height: 180,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(212,168,85,0.35) 0%, rgba(212,168,85,0.05) 70%)",
                border: "1px solid rgba(212,168,85,0.4)",
                marginBottom: 36,
              }}
            />

            <button
              type="button"
              onClick={castNow}
              style={{
                padding: "14px 40px",
                background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                color: "#0a0a1a",
                border: "none",
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 4px 20px rgba(212,168,85,0.3)",
              }}
            >
              {t(
                "✦ 此刻起卦",
                "✦ Cast at This Moment",
                "✦ 此刻に起卦",
                "✦ 지금 이 순간 점치기"
              )}
            </button>
          </motion.div>
        )}

        {/* ────────── Phase 3: 起卦動畫 ────────── */}
        {phase === "casting" && derivation && castAt && (
          <CastingReveal
            derivation={derivation}
            castAt={castAt}
            t={t}
          />
        )}

        {/* ────────── Phase 4: 結果 ────────── */}
        {phase === "result" && derivation && primaryHex && transformedHex && upperTg && lowerTg && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* 本卦 */}
            <section
              style={{
                background: "rgba(13,13,43,0.55)",
                border: "1px solid rgba(212,168,85,0.3)",
                borderRadius: 14,
                padding: 18,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  color: "rgba(212,168,85,0.7)",
                  marginBottom: 8,
                }}
              >
                {t("本卦", "PRIMARY HEXAGRAM", "本卦", "본괘")}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 11, color: "rgba(212,168,85,0.7)" }}>
                  {t(
                    `第 ${primaryHex.number} 卦`,
                    `Hexagram ${primaryHex.number}`,
                    `第 ${primaryHex.number} 卦`,
                    `제 ${primaryHex.number} 괘`
                  )}
                </span>
                <h2
                  className="text-gold-gradient"
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: 24,
                    margin: 0,
                  }}
                >
                  {t(primaryHex.nameZh, primaryHex.nameEn, primaryHex.nameJa, primaryHex.nameKo)}
                </h2>
                {auspice && (
                  <span
                    style={{
                      background: AUSPICE_STYLE[auspice].bg,
                      color: AUSPICE_STYLE[auspice].text,
                      fontSize: 11,
                      padding: "2px 9px",
                      borderRadius: 100,
                      fontWeight: 600,
                    }}
                  >
                    {auspice === "great"
                      ? t("大吉", "Auspicious", "大吉", "대길")
                      : auspice === "challenge"
                        ? t("艱難", "Challenging", "艱難", "험난")
                        : t("中性", "Mixed", "中性", "중성")}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(192,192,208,0.7)",
                  marginBottom: 10,
                }}
              >
                {upperTg.symbol}{" "}
                {t(
                  `上 ${upperTg.zh}`,
                  `Upper ${upperTg.en.split(" ")[0]}`,
                  `上 ${upperTg.zh}`,
                  `상 ${upperTg.zh}`
                )}
                　/　{lowerTg.symbol}{" "}
                {t(
                  `下 ${lowerTg.zh}`,
                  `Lower ${lowerTg.en.split(" ")[0]}`,
                  `下 ${lowerTg.zh}`,
                  `하 ${lowerTg.zh}`
                )}
                　·{" "}
                <span style={{ color: "#fca5a5" }}>
                  {t(
                    `第 ${derivation.changingLine} 爻動`,
                    `Line ${derivation.changingLine} changes`,
                    `第 ${derivation.changingLine} 爻 動`,
                    `제 ${derivation.changingLine} 효 동`
                  )}
                </span>
              </div>
              <Link
                href={`/iching/hexagrams/${primaryHex.number}`}
                target="_blank"
                style={{
                  color: "#d4a855",
                  fontSize: 12,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                {t(
                  "看本卦完整介紹 →",
                  "Read full hexagram entry →",
                  "本卦の詳細を見る →",
                  "본괘 자세히 보기 →"
                )}
              </Link>
            </section>

            {/* 之卦 */}
            <section
              style={{
                background: "rgba(13,13,43,0.45)",
                border: "1px solid rgba(248,113,113,0.25)",
                borderRadius: 14,
                padding: 18,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  color: "rgba(252,165,165,0.85)",
                  marginBottom: 8,
                }}
              >
                {t("之卦 · 走向", "RELATING HEXAGRAM · DIRECTION", "之卦 · 行方", "지괘 · 흐름")}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 11, color: "rgba(252,165,165,0.7)" }}>
                  {t(
                    `第 ${transformedHex.number} 卦`,
                    `Hexagram ${transformedHex.number}`,
                    `第 ${transformedHex.number} 卦`,
                    `제 ${transformedHex.number} 괘`
                  )}
                </span>
                <h3
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: 20,
                    margin: 0,
                    color: "#fca5a5",
                  }}
                >
                  {t(
                    transformedHex.nameZh,
                    transformedHex.nameEn,
                    transformedHex.nameJa,
                    transformedHex.nameKo
                  )}
                </h3>
              </div>
              <Link
                href={`/iching/hexagrams/${transformedHex.number}`}
                target="_blank"
                style={{
                  color: "rgba(252,165,165,0.85)",
                  fontSize: 12,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                {t(
                  "看之卦完整介紹 →",
                  "Read relating hexagram →",
                  "之卦の詳細を見る →",
                  "지괘 자세히 보기 →"
                )}
              </Link>
            </section>

            {/* 公式攤開區 — 摺疊 */}
            <section
              style={{
                background: "rgba(13,13,43,0.4)",
                border: "1px solid rgba(212,168,85,0.18)",
                borderRadius: 14,
                marginBottom: 16,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setShowFormulaDetail((v) => !v)}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  background: "transparent",
                  border: "none",
                  color: "#d4a855",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  {t(
                    "公式攤開:為什麼是這一卦?",
                    "Show the Formula: Why this Hexagram?",
                    "公式を見る:なぜこの卦か?",
                    "공식 펼치기: 왜 이 괘인가?"
                  )}
                </span>
                <span style={{ fontSize: 12 }}>{showFormulaDetail ? "▲" : "▼"}</span>
              </button>
              {showFormulaDetail && (
                <div
                  style={{
                    padding: "0 18px 18px",
                    color: "#e8e8f0",
                    fontSize: 13,
                    lineHeight: 2,
                    fontFamily: "monospace, 'Noto Serif TC'",
                  }}
                >
                  <FormulaTable
                    derivation={derivation}
                    castAt={castAt!}
                    t={t}
                  />
                  <p
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      color: "rgba(192,192,208,0.65)",
                      lineHeight: 1.7,
                      fontFamily: "inherit",
                    }}
                  >
                    {t(
                      "註:此處用公曆原始數字 + 24 小時制 + 真實分鐘,屬「現代簡化版」。邵雍原法用農曆 + 地支年(子=1...亥=12),且只到時辰不到分。我們保留分以利同小時內仍可變卦。",
                      "Note: this version uses raw Gregorian numbers + 24-hour clock + real minutes — a 'modern simplified' variant. Shao Yong's original method uses the lunar calendar with 12-branch year numbering (Zi=1...Hai=12) and stops at the 2-hour timeblock. We keep minutes so the cast can still vary within the same hour.",
                      "註:本実装は公暦の素の数値 + 24時間制 + 実分を用いる「現代簡略版」。邵雍の原法は農暦 + 地支年(子=1...亥=12)で、時辰までしか用いない。同一時間内でも卦が変わるよう「分」を残してある。",
                      "참고: 본 구현은 공력의 원래 숫자 + 24시간제 + 실제 분을 사용하는 '현대 간략판'입니다. 소옹의 원법은 음력 + 지지년(자=1...해=12)을 사용하고 시진까지만 다룹니다. 같은 시간 내에서도 괘가 변하도록 '분'을 남겼습니다."
                    )}
                  </p>
                </div>
              )}
            </section>

            {/* AI 解讀 */}
            <section
              style={{
                background:
                  "linear-gradient(135deg, rgba(212,168,85,0.10), rgba(139,92,246,0.08))",
                border: "1px solid rgba(212,168,85,0.3)",
                borderRadius: 14,
                padding: 20,
                marginBottom: 16,
                minHeight: 120,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  color: "rgba(212,168,85,0.7)",
                  marginBottom: 10,
                }}
              >
                {t("AI 解卦", "AI READING", "AI 解卦", "AI 해독")}
              </div>
              {streamError ? (
                <p style={{ color: "#fca5a5", fontSize: 14, lineHeight: 1.85, margin: 0 }}>
                  {streamError}
                </p>
              ) : aiText ? (
                <p
                  style={{
                    color: "#e8e8f0",
                    fontSize: 14.5,
                    lineHeight: 2,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {aiText}
                  {isStreaming && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 16,
                        marginLeft: 4,
                        verticalAlign: "middle",
                        background: "#d4a855",
                        animation: "pulse 1s infinite",
                      }}
                    />
                  )}
                </p>
              ) : (
                <p
                  style={{
                    color: "rgba(192,192,208,0.6)",
                    fontSize: 13,
                    fontStyle: "italic",
                    margin: 0,
                  }}
                >
                  {t(
                    "占卜師正在合參本卦、動爻與之卦…",
                    "The diviner is weaving the primary, the changing line, and the relating hexagram together…",
                    "占い師が本卦、動爻、之卦を合わせ参じています…",
                    "점술사가 본괘·동효·지괘를 함께 보고 있습니다…"
                  )}
                </p>
              )}
            </section>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={reset}
                disabled={isStreaming}
                style={{
                  padding: "10px 22px",
                  background: "transparent",
                  color: "#d4a855",
                  border: "1px solid #d4a855",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: isStreaming ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  opacity: isStreaming ? 0.5 : 1,
                }}
              >
                {t("再卜一卦", "Cast Again", "もう一度占う", "다시 점치기")}
              </button>
              <Link
                href="/iching/methods/plum-blossom"
                style={{
                  padding: "10px 22px",
                  background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                  color: "#0a0a1a",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {t(
                  "返回梅花介紹",
                  "Back to Method",
                  "梅花の紹介へ戻る",
                  "매화 소개로 돌아가기"
                )}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InsufficientCreditsModal
        open={creditsModal.open}
        required={creditsModal.required}
        onClose={() => setCreditsModal({ open: false, required: 0 })}
      />
    </div>
  );
}

// ──────────────────────────────────────────
// 子元件:起卦動畫 — 公式逐行 fade-in
// ──────────────────────────────────────────
function CastingReveal({
  derivation,
  castAt,
  t,
}: {
  derivation: PlumDerivation;
  castAt: Date;
  t: (zh: string, en: string, ja: string, ko: string) => string;
}) {
  const { numbers, sumUpper, sumLower, upperIndex, lowerIndex, changingLine } = derivation;
  const upperTg = trigramNames[derivation.upperCode];
  const lowerTg = trigramNames[derivation.lowerCode];
  const upperZh = PLUM_TRIGRAM_NAMES_ZH[upperIndex - 1];
  const lowerZh = PLUM_TRIGRAM_NAMES_ZH[lowerIndex - 1];

  const lines: { delay: number; render: () => React.ReactNode }[] = [
    {
      delay: 0,
      render: () => (
        <div style={{ color: "rgba(212,168,85,0.9)", fontSize: 14 }}>
          {t("此刻", "This moment", "此刻", "지금")} ·{" "}
          <span style={{ fontFamily: "monospace" }}>
            {castAt.getFullYear()}/{pad2(castAt.getMonth() + 1)}/{pad2(castAt.getDate())}{" "}
            {pad2(castAt.getHours())}:{pad2(castAt.getMinutes())}
          </span>
        </div>
      ),
    },
    {
      delay: 0.7,
      render: () => (
        <div style={{ fontFamily: "monospace", fontSize: 14, color: "#e8e8f0" }}>
          {numbers.year} + {numbers.month} + {numbers.day} + {numbers.hour} ={" "}
          <strong style={{ color: "#fde68a" }}>{sumUpper}</strong>
        </div>
      ),
    },
    {
      delay: 1.4,
      render: () => (
        <div style={{ fontSize: 14 }}>
          <span style={{ fontFamily: "monospace", color: "#e8e8f0" }}>
            {sumUpper} mod 8 ={" "}
            <strong style={{ color: "#fde68a" }}>{upperIndex}</strong>
          </span>
          <span style={{ marginLeft: 10, color: "#d4a855" }}>
            → {t("上卦", "Upper", "上卦", "상괘")}{" "}
            <span style={{ fontSize: 22 }}>{upperTg.symbol}</span>{" "}
            {t(upperZh, upperTg.en.split(" ")[0], upperZh, upperZh)}
          </span>
        </div>
      ),
    },
    {
      delay: 2.1,
      render: () => (
        <div style={{ fontFamily: "monospace", fontSize: 14, color: "#e8e8f0" }}>
          {sumUpper} + {numbers.minute} ={" "}
          <strong style={{ color: "#fde68a" }}>{sumLower}</strong>
        </div>
      ),
    },
    {
      delay: 2.8,
      render: () => (
        <div style={{ fontSize: 14 }}>
          <span style={{ fontFamily: "monospace", color: "#e8e8f0" }}>
            {sumLower} mod 8 ={" "}
            <strong style={{ color: "#fde68a" }}>{lowerIndex}</strong>
          </span>
          <span style={{ marginLeft: 10, color: "#d4a855" }}>
            → {t("下卦", "Lower", "下卦", "하괘")}{" "}
            <span style={{ fontSize: 22 }}>{lowerTg.symbol}</span>{" "}
            {t(lowerZh, lowerTg.en.split(" ")[0], lowerZh, lowerZh)}
          </span>
        </div>
      ),
    },
    {
      delay: 3.5,
      render: () => (
        <div style={{ fontSize: 14 }}>
          <span style={{ fontFamily: "monospace", color: "#e8e8f0" }}>
            {sumLower} mod 6 ={" "}
            <strong style={{ color: "#fca5a5" }}>{changingLine}</strong>
          </span>
          <span style={{ marginLeft: 10, color: "#fca5a5" }}>
            →{" "}
            {t(
              `第 ${changingLine} 爻動`,
              `Line ${changingLine} changes`,
              `第 ${changingLine} 爻 動`,
              `제 ${changingLine} 효 동`
            )}
          </span>
        </div>
      ),
    },
    {
      delay: 4.4,
      render: () => (
        <div
          style={{
            marginTop: 8,
            paddingTop: 12,
            borderTop: "1px solid rgba(212,168,85,0.18)",
            fontSize: 16,
            color: "#fde68a",
            fontFamily: "'Noto Serif TC', serif",
          }}
        >
          {t(
            `本卦:${derivation.primaryHex.nameZh}　·　之卦:${derivation.transformedHex.nameZh}`,
            `Primary: ${derivation.primaryHex.nameEn.split(" ")[0]} · Relating: ${derivation.transformedHex.nameEn.split(" ")[0]}`,
            `本卦:${derivation.primaryHex.nameZh}　·　之卦:${derivation.transformedHex.nameZh}`,
            `본괘: ${derivation.primaryHex.nameZh}　·　지괘: ${derivation.transformedHex.nameZh}`
          )}
        </div>
      ),
    },
  ];

  return (
    <motion.div
      key="casting"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "rgba(13,13,43,0.55)",
        border: "1px solid rgba(212,168,85,0.3)",
        borderRadius: 14,
        padding: 24,
        minHeight: 320,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        justifyContent: "flex-start",
      }}
    >
      {lines.map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: line.delay, duration: 0.5 }}
        >
          {line.render()}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ──────────────────────────────────────────
// 子元件:result 階段的公式攤開表 — 靜態列出
// ──────────────────────────────────────────
function FormulaTable({
  derivation,
  castAt,
  t,
}: {
  derivation: PlumDerivation;
  castAt: Date;
  t: (zh: string, en: string, ja: string, ko: string) => string;
}) {
  const { numbers, sumUpper, sumLower, upperIndex, lowerIndex, changingLine } = derivation;
  const upperZh = PLUM_TRIGRAM_NAMES_ZH[upperIndex - 1];
  const lowerZh = PLUM_TRIGRAM_NAMES_ZH[lowerIndex - 1];
  const upperTg = trigramNames[derivation.upperCode];
  const lowerTg = trigramNames[derivation.lowerCode];

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: "monospace, 'Noto Serif TC'",
        fontSize: 13,
      }}
    >
      <tbody>
        <tr>
          <td style={cellLabel}>{t("此刻", "Moment", "此刻", "순간")}</td>
          <td style={cellValue}>
            {castAt.getFullYear()}/{pad2(castAt.getMonth() + 1)}/{pad2(castAt.getDate())}{" "}
            {pad2(castAt.getHours())}:{pad2(castAt.getMinutes())}
          </td>
        </tr>
        <tr>
          <td style={cellLabel}>
            {t("年+月+日+時", "Y+M+D+H", "年+月+日+時", "년+월+일+시")}
          </td>
          <td style={cellValue}>
            {numbers.year} + {numbers.month} + {numbers.day} + {numbers.hour} ={" "}
            <strong style={{ color: "#fde68a" }}>{sumUpper}</strong>
          </td>
        </tr>
        <tr>
          <td style={cellLabel}>{t("上卦", "Upper", "上卦", "상괘")}</td>
          <td style={cellValue}>
            {sumUpper} mod 8 = {upperIndex} →{" "}
            <span style={{ color: "#fde68a" }}>
              {upperTg.symbol} {t(upperZh, upperTg.en.split(" ")[0], upperZh, upperZh)}
            </span>
          </td>
        </tr>
        <tr>
          <td style={cellLabel}>+ {t("分", "Min", "分", "분")}</td>
          <td style={cellValue}>
            {sumUpper} + {numbers.minute} ={" "}
            <strong style={{ color: "#fde68a" }}>{sumLower}</strong>
          </td>
        </tr>
        <tr>
          <td style={cellLabel}>{t("下卦", "Lower", "下卦", "하괘")}</td>
          <td style={cellValue}>
            {sumLower} mod 8 = {lowerIndex} →{" "}
            <span style={{ color: "#fde68a" }}>
              {lowerTg.symbol} {t(lowerZh, lowerTg.en.split(" ")[0], lowerZh, lowerZh)}
            </span>
          </td>
        </tr>
        <tr>
          <td style={cellLabel}>{t("動爻", "Changing", "動爻", "동효")}</td>
          <td style={cellValue}>
            {sumLower} mod 6 = {changingLine} →{" "}
            <span style={{ color: "#fca5a5" }}>
              {t(
                `第 ${changingLine} 爻`,
                `Line ${changingLine}`,
                `第 ${changingLine} 爻`,
                `제 ${changingLine} 효`
              )}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const cellLabel: React.CSSProperties = {
  padding: "6px 10px 6px 0",
  color: "rgba(212,168,85,0.8)",
  whiteSpace: "nowrap",
  verticalAlign: "top",
  width: 1,
};

const cellValue: React.CSSProperties = {
  padding: "6px 0",
  color: "#e8e8f0",
};
