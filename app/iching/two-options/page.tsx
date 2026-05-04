"use client";

/**
 * /iching/two-options — 易經二擇一
 *
 * 為什麼存在:使用者問「該選 A 還是 B」這類二擇一題時,以往的 AI 解讀
 * 容易給「兩邊都好兩邊都壞」的水球話,缺乏明確方向。這個頁面把 A / B 兩
 * 個選項變成結構化欄位,送進 /api/divine 後啟動「強建議模式」,
 * AI 必須以卦象為據,結尾明確推一邊。
 *
 * 流程:
 *   ask → 填問題 + 選項 A + 選項 B
 *   throwing → 三錢法 6 次自動擲爻 + 漸進揭示
 *   result → 顯示卦象(本卦 + 變爻 + 之卦)+ AI 解讀(streaming)
 *
 * 跟 /iching/yes-no 的差別:
 *   - yes-no 是「快速一卦速答」(無變爻 / 鎖死 1 點)
 *   - two-options 是完整三錢法占卜(有變爻 / 之卦),走 DIVINE 5 點價,
 *     得到的是更深入的決策建議。
 */

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import {
  performDivination,
  type DivinationResult,
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

type Step = "ask" | "throwing" | "result";

export default function IChingTwoOptionsPage() {
  const { locale, t } = useLanguage();
  const [step, setStep] = useState<Step>("ask");
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [divResult, setDivResult] = useState<DivinationResult | null>(null);
  const [hex, setHex] = useState<Hexagram | null>(null);
  const [relatingHex, setRelatingHex] = useState<Hexagram | null>(null);
  const [revealedLines, setRevealedLines] = useState(0);
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

  const formValid =
    question.trim().length > 0 &&
    optionA.trim().length > 0 &&
    optionB.trim().length > 0;

  const handleThrow = useCallback(async () => {
    if (!formValid) return;
    setStep("throwing");

    // 三錢法 6 次擲爻(server-side data flow 跟主流程一致 — 把擲出來的
    // 卦交給 /api/divine 做解讀)
    const result = performDivination();
    const primaryHex = findHexagram(result.primaryLines) ?? null;
    const relHex = result.relatingLines
      ? findHexagram(result.relatingLines) ?? null
      : null;
    setDivResult(result);
    setHex(primaryHex);
    setRelatingHex(relHex);
    setRevealedLines(0);

    // 自下而上揭示六爻 — 一爻 130ms,六爻 ~780ms
    for (let i = 1; i <= 6; i++) {
      await new Promise((r) => setTimeout(r, 130));
      setRevealedLines(i);
    }
    await new Promise((r) => setTimeout(r, 240));

    setStep("result");
    if (!primaryHex) {
      setAiText(
        t(
          "卦象解析失敗,請再試一次。",
          "Failed to interpret hexagram, please try again.",
          "卦の解析に失敗しました。もう一度お試しください。",
          "괘 해석에 실패했습니다. 다시 시도해 주세요."
        )
      );
      return;
    }

    setIsLoading(true);
    setAiText("");

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/divine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hexagramNumber: primaryHex.number,
          hexagramName: isZh ? primaryHex.nameZh : primaryHex.nameEn,
          changingLines: result.changingLines,
          relatingHexagramNumber: relHex?.number ?? null,
          question: question.trim(),
          // 把 A/B 一起當成 question 的延伸 — API route 內部會看到
          // twoOptionA/twoOptionB 結構化欄位後啟動強建議模式
          // (命名跟 /api/tarot 對齊)
          twoOptionA: optionA.trim(),
          twoOptionB: optionB.trim(),
          // category 給「綜合」這個語意,讓 prompt 裡的 (category) 標籤好看一點
          category: t("二擇一決策", "two-choice decision", "二択の決定", "양자택일 결정"),
          locale: locale === "zh" || locale === "en" ? locale : "en",
          // 二擇一不走衍伸鏈、不走 deep mode、不傳 persona — 用預設即可
        }),
        signal: ac.signal,
      });

      if (res.status === 401) {
        setIsLoading(false);
        setLoginOpen(true);
        return;
      }
      const creditsErr = await parseInsufficientCredits(res);
      if (creditsErr) {
        setIsLoading(false);
        setCreditsModal({ open: true, required: creditsErr.required });
        return;
      }
      if (!res.ok) {
        setIsLoading(false);
        setAiText(
          t(
            "AI 服務暫時無法回應,請稍後再試。",
            "AI service is temporarily unavailable, please try again later.",
            "AI サービスが一時的に応答できません。後ほどお試しください。",
            "AI 서비스가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요."
          )
        );
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
      if ((e as Error).name !== "AbortError") {
        console.error(e);
        setAiText(
          t(
            "發生錯誤,請再試一次。",
            "Something went wrong, please retry.",
            "エラーが発生しました。再度お試しください。",
            "오류가 발생했습니다. 다시 시도해 주세요."
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [formValid, question, optionA, optionB, isZh, locale, t]);

  const handleReset = () => {
    abortRef.current?.abort();
    setStep("ask");
    setQuestion("");
    setOptionA("");
    setOptionB("");
    setDivResult(null);
    setHex(null);
    setRelatingHex(null);
    setRevealedLines(0);
    setAiText("");
  };

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
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
              "卡在兩個選項之間時,把問題與兩條路徑寫清楚,起一卦,得到明確的方向建議。",
              "Stuck between two paths? Spell out the question and both options — draw a hexagram and get a clear, committed recommendation.",
              "二つの選択肢の間で迷ったら、質問と両方の道筋を明確に書き、卦を立てて、はっきりとした方向性のアドバイスを得ましょう。",
              "두 선택지 사이에서 망설일 때, 질문과 두 갈림길을 명확히 적고 괘를 세워 분명한 방향 추천을 받아 보세요."
            )}
          </p>
          <div style={{ color: "rgba(212,168,85,0.7)", fontSize: 11, marginTop: 6 }}>
            {t(
              "每次占卜消耗 5 點(訪客首次免費)",
              "Each reading costs 5 credits (first one free for guests)",
              "1回につき 5 ポイント消費(初回はゲストも無料)",
              "1회 점에 5포인트 소모 (게스트 첫 회 무료)"
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
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{ color: "#c0c0d0", fontSize: 13, display: "block", marginBottom: 6 }}
                >
                  {t(
                    "你正在糾結什麼?",
                    "What are you torn between?",
                    "今、何に迷っていますか?",
                    "지금 무엇 때문에 고민하고 계신가요?"
                  )}
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t(
                    "例:接下來要不要換工作?",
                    "e.g., Should I change jobs next?",
                    "例:次に転職するべきか?",
                    "예: 다음에 이직해야 할까요?"
                  )}
                  rows={2}
                  maxLength={140}
                  style={{ ...inputBase, resize: "vertical", lineHeight: 1.6 }}
                />
                <div
                  style={{
                    color: "rgba(192,192,208,0.5)",
                    fontSize: 11,
                    textAlign: "right",
                    marginTop: 4,
                  }}
                >
                  {question.length} / 140
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
                  "💡 寫法越具體,占卜越準。例如把 A 寫成「留在現在公司、把產品做完」、B 寫成「離職轉去 X 創投、做投資人關係」,而不是只寫「留下」/「離職」。",
                  "💡 The more specific, the better. Write A as 'stay and ship the product' and B as 'leave for VC X, do investor relations' — not just 'stay' / 'leave'.",
                  "💡 具体的に書くほど結果が深まります。A は「今の会社に残って製品を完成させる」、B は「VC X に転職して投資家対応をする」のように、ただの「残る」/「辞める」ではなく状況を書きましょう。",
                  "💡 구체적일수록 점이 정확합니다. A 는 '회사에 남아 제품을 완성한다', B 는 'X VC 로 이직해 IR 을 담당한다' 처럼 단순히 '남기' / '떠나기' 대신 상황을 적으세요."
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
                {t("✦ 起卦,看建議", "✦ Cast & Get Verdict", "✦ 卦を立てて結論を見る", "✦ 괘 세우고 결론 보기")}
              </button>
            </motion.div>
          )}

          {(step === "throwing" || step === "result") && hex && (
            <motion.div
              key="hex-area"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{ textAlign: "center" }}
            >
              {/* 兩個選項回顧:讓使用者在 result 頁仍能看到自己當初寫的 A / B */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 18,
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    background: "rgba(13,13,43,0.55)",
                    border: "1px solid rgba(212,168,85,0.2)",
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
                    border: "1px solid rgba(212,168,85,0.2)",
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

              <div
                style={{
                  margin: "0 auto 16px",
                  width: 220,
                  padding: 24,
                  borderRadius: 16,
                  background: "rgba(13,13,43,0.6)",
                  border: "1px solid rgba(212,168,85,0.4)",
                  boxShadow: "0 8px 32px rgba(212,168,85,0.18)",
                }}
              >
                <HexagramLines
                  lines={hex.lines}
                  changingIdx={divResult?.changingLines ?? []}
                  revealedCount={step === "result" ? 6 : revealedLines}
                />

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: step === "result" || revealedLines >= 6 ? 1 : 0,
                  }}
                  transition={{ duration: 0.4, delay: step === "result" ? 0 : 0.1 }}
                  style={{ marginTop: 16 }}
                >
                  <div
                    style={{
                      fontSize: 44,
                      color: "rgba(212,168,85,0.9)",
                      lineHeight: 1,
                      marginBottom: 8,
                    }}
                  >
                    {hex.character}
                  </div>
                  <div
                    style={{
                      color: "#e8e8f0",
                      fontSize: 18,
                      fontWeight: 700,
                      fontFamily: "'Noto Serif TC', serif",
                    }}
                  >
                    {isZh ? hex.nameZh : hex.nameEn.split(" ")[0]}
                  </div>
                  <div style={{ color: "rgba(192,192,208,0.5)", fontSize: 11, marginTop: 2 }}>
                    {t(
                      `第 ${hex.number} 卦`,
                      `Hexagram ${hex.number}`,
                      `第 ${hex.number} 卦`,
                      `제 ${hex.number} 괘`
                    )}
                  </div>
                </motion.div>
              </div>

              {step === "result" && (
                <>
                  <UpperLowerTrigrams
                    upperCode={hex.upperTrigram}
                    lowerCode={hex.lowerTrigram}
                    isZh={isZh}
                    t={t}
                  />

                  {relatingHex && (
                    <div
                      style={{
                        margin: "10px auto 16px",
                        padding: "10px 16px",
                        background: "rgba(212,168,85,0.08)",
                        border: "1px dashed rgba(212,168,85,0.35)",
                        borderRadius: 10,
                        display: "inline-block",
                        fontSize: 13,
                        color: "rgba(232,232,240,0.85)",
                      }}
                    >
                      {t(
                        `之卦:第 ${relatingHex.number} 卦 ${relatingHex.nameZh}`,
                        `Relating: Hexagram ${relatingHex.number} — ${relatingHex.nameEn.split(" ")[0]}`,
                        `之卦:第 ${relatingHex.number} 卦 ${relatingHex.nameZh}`,
                        `지괘: 제 ${relatingHex.number} 괘 ${relatingHex.nameZh}`
                      )}
                    </div>
                  )}

                  {isZh && (
                    <div
                      style={{
                        background: "rgba(13,13,43,0.5)",
                        border: "1px solid rgba(212,168,85,0.18)",
                        borderRadius: 10,
                        padding: 12,
                        margin: "0 auto 14px",
                        maxWidth: 560,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(212,168,85,0.7)",
                          letterSpacing: 1,
                          marginBottom: 4,
                        }}
                      >
                        卦辭
                      </div>
                      <div
                        style={{
                          color: "#fde68a",
                          fontSize: 15,
                          fontWeight: 700,
                          fontFamily: "'Noto Serif TC', serif",
                          lineHeight: 1.7,
                        }}
                      >
                        {hex.judgmentZh}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      background: "rgba(13,13,43,0.6)",
                      border: "1px solid rgba(212,168,85,0.2)",
                      borderRadius: 14,
                      padding: 20,
                      margin: "0 auto 20px",
                      maxWidth: 560,
                      textAlign: "left",
                      lineHeight: 1.8,
                      color: "#e8e8f0",
                      fontSize: 15,
                      minHeight: 120,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {aiText ||
                      (isLoading
                        ? t(
                            "占卜師正在解讀…",
                            "Diviner is interpreting…",
                            "占い師が解読中…",
                            "점술가가 해석 중…"
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
                    <Link
                      href={`/iching/hexagrams/${hex.number}`}
                      style={{
                        color: "rgba(212,168,85,0.85)",
                        fontSize: 13,
                        textDecoration: "underline",
                      }}
                    >
                      {t(
                        `看這一卦的完整介紹 →`,
                        `View this hexagram's full entry →`,
                        `この卦の完全解説を見る →`,
                        `이 괘의 전체 설명 보기 →`
                      )}
                    </Link>
                    <Link
                      href="/"
                      style={{
                        color: "rgba(212,168,85,0.7)",
                        fontSize: 13,
                        textDecoration: "underline",
                      }}
                    >
                      {t(
                        "想看更深入的解讀?試試完整占卜 →",
                        "Want a deeper reading? Try a full divination →",
                        "より深い解読を見たい?完全占いへ →",
                        "더 깊은 해석을 원하시나요? 전체 점으로 →"
                      )}
                    </Link>
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
// 卦線渲染 — 漸進揭示 + 變爻標記
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
  const w = 130;
  const h = 11;
  const gap = 12;
  const gapInner = 14;
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
                    ? "0 0 12px rgba(248,113,113,0.55)"
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
                      ? "0 0 12px rgba(248,113,113,0.55)"
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
                      ? "0 0 12px rgba(248,113,113,0.55)"
                      : undefined,
                  }}
                />
              </div>
            )}
            {isRevealed && isChanging && (
              <span
                style={{
                  position: "absolute",
                  right: -22,
                  top: -4,
                  fontSize: 14,
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
        gap: 14,
        margin: "4px 0 8px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 20, color: "#d4a855", lineHeight: 1 }}>
          {upper.symbol}
        </span>
        <span style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}>
          {t(`上 ${upperName}`, `Upper ${upperName}`, `上 ${upperName}`, `상 ${upperName}`)}
        </span>
      </div>
      <span style={{ color: "rgba(212,168,85,0.4)" }}>／</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 20, color: "#d4a855", lineHeight: 1 }}>
          {lower.symbol}
        </span>
        <span style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}>
          {t(`下 ${lowerName}`, `Lower ${lowerName}`, `下 ${lowerName}`, `하 ${lowerName}`)}
        </span>
      </div>
    </div>
  );
}
