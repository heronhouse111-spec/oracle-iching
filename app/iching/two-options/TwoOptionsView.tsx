"use client";

/**
 * /iching/two-options — 易經二擇一(雙卦版,client view)
 *
 * 為什麼存在:使用者問「該選 A 還是 B」這類二擇一題時,以往的 AI 解讀容易給
 * 「兩邊都好兩邊都壞」的水球話,缺乏明確方向。本頁把 A / B 兩個選項變成
 * 結構化欄位,各自起一卦(三錢法 6 次),送進 /api/divine/two-options 後
 * AI 會比對兩卦的吉凶 / 動爻 / 之卦走向,給出明確推一邊的決斷,600 字解說。
 *
 * 流程:
 *   ask     → 顯示主流程帶來的問題(唯讀)+ 只填選項 A + 選項 B
 *   throwA  → 為 A 擲三錢法 6 次 + 漸進揭示
 *   throwB  → 為 B 擲三錢法 6 次 + 漸進揭示
 *   result  → 並排顯示兩卦(本卦圖 + 變爻 + 之卦)+ AI 比對解讀(streaming)+ 存歷史
 *
 * 入場條件(對齊 plum-blossom / direction-hexagram):
 *   sessionStorage("iching_resume_state") 必須有 q + cat —— 來自首頁的問題步驟。
 *   缺了就 router.replace("/iching")。
 *
 * 跟 /iching/yes-no 的差別:
 *   - yes-no 是「快速一卦速答」(無變爻 / 鎖死 2 點)
 *   - two-options 是雙卦三錢法(各有變爻 / 之卦)+ 雙卦比對 AI prompt,
 *     走 IC_TWO_OPTIONS 10 點價,得到 600 字深入決策建議。
 */

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import {
  performDivination,
  type DivinationResult,
  questionCategories,
} from "@/lib/divination";
import {
  findHexagram,
  trigramNames,
  type Hexagram,
} from "@/data/hexagrams";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";
import { UI_CREDIT_COSTS } from "@/lib/uiCreditCosts";
import { saveDivination } from "@/lib/saveDivination";
import { hexagramImageKey, type IchingImagesMap } from "@/lib/ichingImages";

const RESUME_STATE_KEY = "iching_resume_state";
// 跟首頁那邊讀的 key shape 對齊 — 不要拼錯
const METHOD_RESULT_KEY = "iching_method_result_state";

type Step = "ask" | "throwA" | "throwB" | "result";

interface CastState {
  result: DivinationResult;
  primary: Hexagram;
  relating: Hexagram | null;
}

export default function TwoOptionsView({ images }: { images: IchingImagesMap }) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState<Step>("ask");
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("");
  const [gateChecked, setGateChecked] = useState(false);
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [castA, setCastA] = useState<CastState | null>(null);
  const [castB, setCastB] = useState<CastState | null>(null);
  const [revealedLinesA, setRevealedLinesA] = useState(0);
  const [revealedLinesB, setRevealedLinesB] = useState(0);
  const [aiText, setAiText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });
  const abortRef = useRef<AbortController | null>(null);

  const isZh = locale === "zh";

  const inputBase: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    fontSize: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(212,168,85,0.3)",
    borderRadius: 12,
    color: "#fff",
    outline: "none",
    fontFamily: "inherit",
  };

  // ── 入場守門:?resumeFlow=cast + sessionStorage 必備 q+cat ──
  // 對齊 plum-blossom / direction-hexagram 的 pattern — 問題在主流程已填過,
  // 這頁只填 A / B。缺資料就退回 /iching 重來。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("resumeFlow") !== "cast") {
      router.replace("/iching");
      return;
    }
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
      router.replace("/iching");
      return;
    }
    setQuestion(resumeState.question.trim());
    setCategory(resumeState.category);
    setGateChecked(true);
  }, [router]);

  const formValid =
    question.trim().length > 0 &&
    optionA.trim().length > 0 &&
    optionB.trim().length > 0;

  // 為單一選項擲三錢法 6 次,自下而上漸進揭示
  const performSingleCast = useCallback(
    async (setReveal: (n: number) => void): Promise<CastState> => {
      const result = performDivination();
      const primary = findHexagram(result.primaryLines);
      const relating = result.relatingLines
        ? findHexagram(result.relatingLines) ?? null
        : null;
      if (!primary) {
        throw new Error("Failed to find hexagram");
      }
      setReveal(0);
      for (let i = 1; i <= 6; i++) {
        await new Promise((r) => setTimeout(r, 130));
        setReveal(i);
      }
      await new Promise((r) => setTimeout(r, 320));
      return { result, primary, relating };
    },
    []
  );

  const handleThrow = useCallback(async () => {
    if (!formValid) return;

    // ── A 卦 ──
    setStep("throwA");
    setRevealedLinesA(0);
    let aCast: CastState;
    try {
      aCast = await performSingleCast(setRevealedLinesA);
      setCastA(aCast);
    } catch {
      setStep("ask");
      return;
    }

    // ── 過場(讓使用者看到 A 完成才開始 B,有節奏感) ──
    await new Promise((r) => setTimeout(r, 600));

    // ── B 卦 ──
    setStep("throwB");
    setRevealedLinesB(0);
    let bCast: CastState;
    try {
      bCast = await performSingleCast(setRevealedLinesB);
      setCastB(bCast);
    } catch {
      setStep("ask");
      return;
    }

    await new Promise((r) => setTimeout(r, 600));

    // ── 跳到首頁 result step,沿用主流程的統一結果頁(解說 + 繼續請教 + 衍伸占卜)──
    // 對齊 plum-blossom / direction-hexagram 的 hand-off pattern:
    //   把 castA + castB + question + category + A/B 標籤塞進 sessionStorage
    //   ("iching_method_result_state"),首頁的 resumeFlow=method-result effect 會
    //   讀出來、setState 落到 result step,並由 fetchAIReading 走 method='two-options'
    //   分支送到 /api/divine/two-options 拿 streaming 回應、寫進歷史、共用 chat / 衍伸。
    try {
      const payload = {
        method: "two-options" as const,
        question: question.trim(),
        category,
        hexagramNumber: aCast.primary.number,
        primaryLines: aCast.result.primaryLines,
        changingLines: aCast.result.changingLines,
        relatingNumber: aCast.relating?.number ?? null,
        relatingLines: aCast.result.relatingLines ?? null,
        castB: {
          hexagramNumber: bCast.primary.number,
          primaryLines: bCast.result.primaryLines,
          changingLines: bCast.result.changingLines,
          relatingNumber: bCast.relating?.number ?? null,
          relatingLines: bCast.result.relatingLines ?? null,
        },
        optionA: optionA.trim(),
        optionB: optionB.trim(),
      };
      sessionStorage.setItem(METHOD_RESULT_KEY, JSON.stringify(payload));
      sessionStorage.removeItem(RESUME_STATE_KEY);
      router.replace("/?resumeFlow=method-result");
    } catch (e) {
      console.error("[two-options] hand-off to home result step failed:", e);
      setStep("ask");
    }
  }, [formValid, question, category, optionA, optionB, performSingleCast, router]);

  const handleReset = () => {
    abortRef.current?.abort();
    setStep("ask");
    setQuestion("");
    setOptionA("");
    setOptionB("");
    setCastA(null);
    setCastB(null);
    setRevealedLinesA(0);
    setRevealedLinesB(0);
    setAiText("");
  };

  const cost = UI_CREDIT_COSTS.IC_TWO_OPTIONS;

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 28, fontWeight: 700, margin: 0 }}
          >
            {t(
              "易經二擇一",
              "I Ching · A or B",
              "易経 二択占い",
              "주역 양자택일"
            )}
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            {t(
              "把兩條路徑寫清楚 — A / B 各起一卦,AI 比對兩卦給出明確推一邊的決斷。",
              "Spell out both options — cast a hexagram for each, and AI compares them to give a committed recommendation.",
              "両方の道筋を明確に書いて、A / B それぞれに卦を立てましょう。AI が両卦を比較して明確に一方を推奨します。",
              "양쪽 갈림길을 명확히 적고 A / B 각각 괘를 세우세요. AI 가 두 괘를 비교해 분명한 추천을 드립니다."
            )}
          </p>
          <div style={{ color: "rgba(212,168,85,0.7)", fontSize: 11, marginTop: 6 }}>
            {t(
              `每次占卜消耗 ${cost} 點(A 卦 + B 卦,雙卦比對解讀約 600 字)`,
              `Each reading costs ${cost} credits (one cast for A + one for B, ~400-word comparison)`,
              `1回につき ${cost} ポイント消費(A 卦 + B 卦、双卦比較で約 500 文字)`,
              `1회 점에 ${cost} 포인트 소모 (A 괘 + B 괘, 양 괘 비교 약 500자)`
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "ask" && (
            <motion.div
              key="ask"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              {/* 問題 readonly banner — 來自主流程的問題步驟 (sessionStorage) */}
              <div
                style={{
                  background: "rgba(212,168,85,0.07)",
                  border: "1px solid rgba(212,168,85,0.25)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: 1,
                    color: "rgba(212,168,85,0.7)",
                    marginBottom: 4,
                  }}
                >
                  {t("你的問題", "YOUR QUESTION", "あなたの質問", "당신의 질문")}
                </div>
                <div
                  style={{
                    color: "#e8e8f0",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  {question}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label
                    style={{
                      color: "#d4a855",
                      fontSize: 13,
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 700,
                    }}
                  >
                    {t("選項 A", "Option A", "選択 A", "선택 A")}
                  </label>
                  <input
                    type="text"
                    value={optionA}
                    onChange={(e) => setOptionA(e.target.value)}
                    placeholder={t(
                      "例:留在現在公司",
                      "e.g., Stay at current company",
                      "例:今の会社に残る",
                      "예: 현재 회사에 남기"
                    )}
                    maxLength={60}
                    style={inputBase}
                  />
                </div>
                <div>
                  <label
                    style={{
                      color: "#d4a855",
                      fontSize: 13,
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 700,
                    }}
                  >
                    {t("選項 B", "Option B", "選択 B", "선택 B")}
                  </label>
                  <input
                    type="text"
                    value={optionB}
                    onChange={(e) => setOptionB(e.target.value)}
                    placeholder={t(
                      "例:跳槽到 X 公司",
                      "e.g., Switch to Company X",
                      "例:X 社に転職する",
                      "예: X 회사로 이직"
                    )}
                    maxLength={60}
                    style={inputBase}
                  />
                </div>
              </div>

              <div
                style={{
                  background: "rgba(212,168,85,0.07)",
                  border: "1px solid rgba(212,168,85,0.2)",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 12,
                  color: "rgba(192,192,208,0.85)",
                  lineHeight: 1.7,
                  marginBottom: 16,
                }}
              >
                {t(
                  "💡 A / B 寫得越具體,占卜越準。例如「留在現職、把產品做完」優於只寫「留下」。將為 A 跟 B 各起一卦(共兩次擲卦)。",
                  "💡 The more specific, the better. 'Stay and ship the product' beats just 'stay'. We'll cast a hexagram for A and another for B (two casts total).",
                  "💡 A / B は具体的に書くほど結果が深まります。「今の会社に残って製品を完成させる」は単なる「残る」より良い。A と B それぞれに卦を立てます(計2回の立卦)。",
                  "💡 A / B 는 구체적일수록 정확해집니다. '회사에 남아 제품을 완성한다' 가 단순히 '남기' 보다 낫습니다. A 와 B 각각 괘를 세웁니다(총 2회 기괘)."
                )}
              </div>

              <button
                onClick={handleThrow}
                disabled={!formValid}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  background: formValid
                    ? "linear-gradient(135deg, #d4a855, #f0d78c)"
                    : "rgba(212,168,85,0.2)",
                  color: formValid ? "#0a0a1a" : "rgba(192,192,208,0.4)",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: formValid ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                  boxShadow: formValid ? "0 8px 24px rgba(212,168,85,0.25)" : "none",
                }}
              >
                {t(
                  "✦ 為 A / B 各起一卦",
                  "✦ Cast for A and B",
                  "✦ A / B それぞれに卦を立てる",
                  "✦ A / B 각각 괘 세우기"
                )}
              </button>
            </motion.div>
          )}

          {(step === "throwA" || step === "throwB" || step === "result") && (
            <motion.div
              key="hex-area"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* 兩個選項回顧 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    background: "rgba(13,13,43,0.55)",
                    border: "1px solid rgba(212,168,85,0.25)",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      color: "#d4a855",
                      fontSize: 11,
                      letterSpacing: 1,
                      marginBottom: 4,
                      fontWeight: 700,
                    }}
                  >
                    {t("選項 A", "OPTION A", "選択 A", "선택 A")}
                  </div>
                  <div style={{ color: "#e8e8f0", fontSize: 13, lineHeight: 1.6 }}>
                    {optionA}
                  </div>
                </div>
                <div
                  style={{
                    background: "rgba(13,13,43,0.55)",
                    border: "1px solid rgba(212,168,85,0.25)",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      color: "#d4a855",
                      fontSize: 11,
                      letterSpacing: 1,
                      marginBottom: 4,
                      fontWeight: 700,
                    }}
                  >
                    {t("選項 B", "OPTION B", "選択 B", "선택 B")}
                  </div>
                  <div style={{ color: "#e8e8f0", fontSize: 13, lineHeight: 1.6 }}>
                    {optionB}
                  </div>
                </div>
              </div>

              {/* 兩個卦象並排 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                  marginBottom: 22,
                }}
              >
                <CastPanel
                  side="A"
                  cast={castA}
                  revealed={revealedLinesA}
                  active={step === "throwA"}
                  showFull={step === "result" || step === "throwB"}
                  isZh={isZh}
                  t={t}
                  images={images}
                />
                <CastPanel
                  side="B"
                  cast={castB}
                  revealed={revealedLinesB}
                  active={step === "throwB"}
                  showFull={step === "result"}
                  isZh={isZh}
                  t={t}
                  images={images}
                />
              </div>

              {step === "result" && (
                <>
                  <div
                    style={{
                      background: "rgba(13,13,43,0.6)",
                      border: "1px solid rgba(212,168,85,0.2)",
                      borderRadius: 14,
                      padding: 22,
                      margin: "0 auto 20px",
                      lineHeight: 1.85,
                      color: "#e8e8f0",
                      fontSize: 15,
                      minHeight: 200,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {aiText ||
                      (isLoading
                        ? t(
                            "占卜師正在比對兩卦...",
                            "Diviner is comparing the two hexagrams…",
                            "占い師が両卦を比較中…",
                            "점술가가 두 괘를 비교하는 중…"
                          )
                        : "")}
                    {isLoading && <span style={{ color: "#d4a855" }}> ▌</span>}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <button
                      onClick={handleReset}
                      style={{
                        padding: "12px 28px",
                        background: "transparent",
                        color: "#d4a855",
                        border: "1px solid rgba(212,168,85,0.5)",
                        borderRadius: 10,
                        fontSize: 14,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {t("✦ 再問一個", "✦ Ask another", "✦ もう一つ問う", "✦ 다시 물어보기")}
                    </button>
                    {castA?.primary && (
                      <Link
                        href={`/iching/hexagrams/${castA.primary.number}`}
                        style={{
                          color: "rgba(212,168,85,0.85)",
                          fontSize: 13,
                          textDecoration: "underline",
                        }}
                      >
                        {t(
                          `看 A 卦的完整介紹(第 ${castA.primary.number} 卦)→`,
                          `View A's hexagram entry (#${castA.primary.number}) →`,
                          `A 卦の完全解説を見る(第 ${castA.primary.number} 卦)→`,
                          `A 괘 전체 설명 보기 (제 ${castA.primary.number} 괘) →`
                        )}
                      </Link>
                    )}
                    {castB?.primary && (
                      <Link
                        href={`/iching/hexagrams/${castB.primary.number}`}
                        style={{
                          color: "rgba(212,168,85,0.85)",
                          fontSize: 13,
                          textDecoration: "underline",
                        }}
                      >
                        {t(
                          `看 B 卦的完整介紹(第 ${castB.primary.number} 卦)→`,
                          `View B's hexagram entry (#${castB.primary.number}) →`,
                          `B 卦の完全解説を見る(第 ${castB.primary.number} 卦)→`,
                          `B 괘 전체 설명 보기 (제 ${castB.primary.number} 괘) →`
                        )}
                      </Link>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <LoginOptionsModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <InsufficientCreditsModal
        open={creditsModal.open}
        required={creditsModal.required}
        onClose={() => setCreditsModal({ open: false, required: 0 })}
      />
    </main>
  );
}

// ──────────────────────────────────────────
// 單側卦面板 — 標題(A/B) + 卦線漸進揭示 + 卦名 + 上下卦
// ──────────────────────────────────────────
function CastPanel({
  side,
  cast,
  revealed,
  active,
  showFull,
  isZh,
  t,
  images,
}: {
  side: "A" | "B";
  cast: CastState | null;
  revealed: number;
  active: boolean;
  showFull: boolean;
  isZh: boolean;
  t: (zh: string, en: string, ja?: string, ko?: string) => string;
  images: IchingImagesMap;
}) {
  const labelZh = side === "A" ? "為 A 起卦" : "為 B 起卦";
  const labelEn = side === "A" ? "Cast for A" : "Cast for B";
  const labelJa = side === "A" ? "A の卦" : "B の卦";
  const labelKo = side === "A" ? "A 괘" : "B 괘";

  const heroImg = cast ? images[hexagramImageKey(cast.primary.number)] : undefined;

  return (
    <div
      style={{
        background: "rgba(13,13,43,0.55)",
        border: active
          ? "1px solid rgba(212,168,85,0.6)"
          : "1px solid rgba(212,168,85,0.25)",
        borderRadius: 14,
        padding: 16,
        textAlign: "center",
        boxShadow: active ? "0 0 24px rgba(212,168,85,0.18)" : undefined,
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: active ? "#fde68a" : "rgba(212,168,85,0.7)",
          marginBottom: 10,
          fontWeight: 700,
        }}
      >
        {t(labelZh, labelEn, labelJa, labelKo)}
        {active && (
          <span style={{ marginLeft: 6, opacity: 0.85 }}>
            {t("擲卦中…", "Casting…", "擲卦中…", "괘 던지는 중…")}
          </span>
        )}
      </div>

      <div
        style={{
          margin: "0 auto",
          width: "100%",
          maxWidth: 180,
          padding: "12px 8px",
        }}
      >
        {/* 動畫期間(revealed < 6)+ 沒卦圖檔可顯示時 → 用陰陽爻線。
            一旦六爻揭完(revealed >= 6 || showFull),改用卦象圖,不再重複顯示陰陽爻。 */}
        {cast && (revealed >= 6 || showFull) && heroImg ? null : cast ? (
          <HexagramLines
            lines={cast.primary.lines}
            changingIdx={cast.result.changingLines}
            revealedCount={showFull ? 6 : revealed}
          />
        ) : (
          <div
            style={{
              height: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(192,192,208,0.4)",
              fontSize: 12,
            }}
          >
            {t("等待中", "Waiting", "待機中", "대기 중")}
          </div>
        )}
      </div>

      {cast && (revealed >= 6 || showFull) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ marginTop: 8 }}
        >
          {/* 64 卦插圖(來自 admin 上傳的 iching_images app_content row),
              沒上傳時 fallback 為純 unicode 卦符 — 跟 /iching/hexagrams 詳細頁一致。 */}
          {heroImg ? (
            <div
              style={{
                width: "100%",
                maxWidth: 140,
                aspectRatio: "9 / 14",
                margin: "0 auto 8px",
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid rgba(212,168,85,0.4)",
                background:
                  "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(13,13,43,0.6))",
                boxShadow: "0 4px 18px rgba(212,168,85,0.18)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImg}
                alt={cast.primary.nameZh}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
          ) : (
            <div style={{ fontSize: 32, color: "rgba(212,168,85,0.9)", lineHeight: 1, marginBottom: 4 }}>
              {cast.primary.character}
            </div>
          )}
          <div
            style={{
              color: "#e8e8f0",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "'Noto Serif TC', serif",
            }}
          >
            {isZh ? cast.primary.nameZh : cast.primary.nameEn.split(" ")[0]}
          </div>
          <div style={{ color: "rgba(192,192,208,0.5)", fontSize: 11, marginTop: 2 }}>
            {t(
              `第 ${cast.primary.number} 卦`,
              `Hexagram ${cast.primary.number}`,
              `第 ${cast.primary.number} 卦`,
              `제 ${cast.primary.number} 괘`
            )}
          </div>

          {showFull && (
            <>
              <div style={{ marginTop: 10 }}>
                <UpperLowerTrigrams
                  upperCode={cast.primary.upperTrigram}
                  lowerCode={cast.primary.lowerTrigram}
                  isZh={isZh}
                  t={t}
                />
              </div>
              {cast.relating && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "6px 10px",
                    background: "rgba(212,168,85,0.08)",
                    border: "1px dashed rgba(212,168,85,0.35)",
                    borderRadius: 8,
                    fontSize: 11,
                    color: "rgba(232,232,240,0.85)",
                    lineHeight: 1.5,
                  }}
                >
                  {t(
                    `之卦 · 第 ${cast.relating.number} 卦 ${cast.relating.nameZh}`,
                    `Relating: #${cast.relating.number} ${cast.relating.nameEn.split(" ")[0]}`,
                    `之卦 · 第 ${cast.relating.number} 卦 ${cast.relating.nameZh}`,
                    `지괘 · 제 ${cast.relating.number} 괘 ${cast.relating.nameZh}`
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// 卦線渲染 — 漸進揭示 + 變爻標記(雙卦版尺寸縮小一些)
// ──────────────────────────────────────────
function HexagramLines({
  lines,
  changingIdx,
  revealedCount,
}: {
  lines: number[];
  changingIdx: number[];
  revealedCount: number;
}) {
  const w = 110;
  const h = 9;
  const gap = 9;
  const gapInner = 12;
  // lines[0] 是最下爻,渲染要倒過來;揭示順序仍從下到上
  const display = lines.map((line, i) => ({ line, originalIdx: i })).reverse();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        alignItems: "center",
      }}
    >
      {display.map(({ line, originalIdx }) => {
        const isRevealed = originalIdx < revealedCount;
        const isChanging = changingIdx.includes(originalIdx);
        return (
          <motion.div
            key={originalIdx}
            initial={false}
            animate={{
              opacity: isRevealed ? 1 : 0,
              scaleX: isRevealed ? 1 : 0.4,
            }}
            transition={{ duration: 0.25 }}
            style={{ width: w, transformOrigin: "center", position: "relative" }}
          >
            {line === 1 ? (
              <div
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: 2,
                  background: isChanging
                    ? "linear-gradient(90deg, #f87171, #fbbf24, #f87171)"
                    : "#d4a855",
                  boxShadow: isChanging
                    ? "0 0 10px rgba(248,113,113,0.55)"
                    : undefined,
                }}
              />
            ) : (
              <div style={{ display: "flex", gap: gapInner, width: "100%" }}>
                <div
                  style={{
                    flex: 1,
                    height: h,
                    borderRadius: 2,
                    background: isChanging
                      ? "linear-gradient(90deg, #f87171, #fbbf24)"
                      : "#d4a855",
                    boxShadow: isChanging
                      ? "0 0 10px rgba(248,113,113,0.55)"
                      : undefined,
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    height: h,
                    borderRadius: 2,
                    background: isChanging
                      ? "linear-gradient(90deg, #fbbf24, #f87171)"
                      : "#d4a855",
                    boxShadow: isChanging
                      ? "0 0 10px rgba(248,113,113,0.55)"
                      : undefined,
                  }}
                />
              </div>
            )}
            {isRevealed && isChanging && (
              <span
                style={{
                  position: "absolute",
                  right: -18,
                  top: -3,
                  fontSize: 12,
                  color: "#f87171",
                }}
              >
                ✦
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function UpperLowerTrigrams({
  upperCode,
  lowerCode,
  isZh,
  t,
}: {
  upperCode: string;
  lowerCode: string;
  isZh: boolean;
  t: (zh: string, en: string, ja?: string, ko?: string) => string;
}) {
  const upper = trigramNames[upperCode];
  const lower = trigramNames[lowerCode];
  if (!upper || !lower) return null;
  const upperName = isZh ? upper.zh : upper.en;
  const lowerName = isZh ? lower.zh : lower.en;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontSize: 11,
        color: "rgba(192,192,208,0.75)",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 16, color: "#d4a855" }}>{upper.symbol}</span>
      <span>{t(`上 ${upperName}`, `Upper ${upperName}`, `上 ${upperName}`, `상 ${upperName}`)}</span>
      <span style={{ color: "rgba(212,168,85,0.4)" }}>／</span>
      <span style={{ fontSize: 16, color: "#d4a855" }}>{lower.symbol}</span>
      <span>{t(`下 ${lowerName}`, `Lower ${lowerName}`, `下 ${lowerName}`, `하 ${lowerName}`)}</span>
    </div>
  );
}
