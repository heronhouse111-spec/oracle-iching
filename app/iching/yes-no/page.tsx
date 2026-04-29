"use client";

/**
 * /iching/yes-no — 易經一卦速答
 *
 * 流程跟 /yes-no(塔羅版)完全一致:
 *   ask  → 輸入問題
 *   drawing → 立刻抽一卦,六爻自下而上揭示(取代翻牌動畫)
 *   result → 顯示卦象 + verdict (yes/no/depends) + AI 一段解釋
 *
 * 差別:不擲銅錢、不算變爻 — 直接從 64 卦中抽一個。整個過程約 900ms 動畫
 * 對齊塔羅版的節奏。
 */

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import { hexagrams, getHexagramByNumber, trigramNames } from "@/data/hexagrams";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";

type Step = "ask" | "drawing" | "result";
type Verdict = "yes" | "no" | "depends";

export default function IChingYesNoPage() {
  const { locale, t } = useLanguage();
  const [step, setStep] = useState<Step>("ask");
  const [question, setQuestion] = useState("");
  const [hexNumber, setHexNumber] = useState<number | null>(null);
  const [revealedLines, setRevealedLines] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [aiText, setAiText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });
  const abortRef = useRef<AbortController | null>(null);

  const hex = hexNumber !== null ? getHexagramByNumber(hexNumber) : null;

  const handleDraw = async () => {
    if (!question.trim()) return;
    setStep("drawing");

    // 立刻抽一卦(no 擲銅錢過程)
    const drawnNum = Math.floor(Math.random() * hexagrams.length) + 1;
    setHexNumber(drawnNum);
    setRevealedLines(0);

    // 六爻自下而上揭示,每爻間隔 110ms,六爻 ~660ms
    for (let i = 1; i <= 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 110));
      setRevealedLines(i);
    }
    // 全部揭示完再停 200ms 讓使用者看一眼,進 result step 開始 fetch
    await new Promise((r) => setTimeout(r, 200));

    setStep("result");
    setIsLoading(true);
    setAiText("");

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/iching/yesno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hexagramNumber: drawnNum,
          hasChangingLine: false, // 速答不抽變爻
          question: question.trim(),
          locale,
        }),
        signal: ac.signal,
      });

      if (res.status === 401) {
        setIsLoading(false);
        setLoginOpen(true);
        return;
      }
      if (res.status === 402) {
        const info = await parseInsufficientCredits(res);
        setIsLoading(false);
        setCreditsModal({ open: true, required: info?.required ?? 1 });
        return;
      }
      if (!res.ok) {
        setIsLoading(false);
        setAiText(t("AI 服務暫時無法回應,請稍後再試。", "AI service is temporarily unavailable, please try again later."));
        return;
      }

      const v = res.headers.get("X-YesNo-Verdict") as Verdict | null;
      if (v) setVerdict(v);

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
        setAiText(t("發生錯誤,請再試一次。", "Something went wrong, please retry."));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep("ask");
    setQuestion("");
    setHexNumber(null);
    setRevealedLines(0);
    setVerdict(null);
    setAiText("");
  };

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

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 28, fontWeight: 700, margin: 0 }}
          >
            {t("Yes/No 一卦速答", "Yes/No I Ching", "Yes/No 一卦速答", "Yes/No 주역")}
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            {t(
              "問一個明確的二元問題,從 64 卦中立刻抽一卦,看見答案的方向。",
              "Ask a clear binary question, instantly draw one of the 64 hexagrams, glimpse the direction.",
              "明確な二択の質問を投げかけ、64卦から1卦を引いて方向性を見る。",
              "명확한 양자택일 질문을 던지고, 64괘에서 한 괘를 즉시 뽑아 방향을 봅니다."
            )}
          </p>
          <div style={{ color: "rgba(212,168,85,0.7)", fontSize: 11, marginTop: 6 }}>
            {t("每次占卜消耗 1 點", "Each reading costs 1 credit", "1回につき 1 ポイント消費", "1회 점에 1포인트 소모")}
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
                    "你想問什麼?(請以是/否能回答的方式)",
                    "Your yes/no question:",
                    "Yes/No で答えられる質問:",
                    "예/아니오로 답할 수 있는 질문:"
                  )}
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t(
                    "例:這個月我會收到那個工作的 offer 嗎?",
                    "e.g., Will I receive that job offer this month?",
                    "例:今月あの仕事のオファーをもらえますか?",
                    "예: 이번 달에 그 일자리 제안을 받을 수 있을까요?"
                  )}
                  rows={3}
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

              <button
                onClick={handleDraw}
                disabled={!question.trim()}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  background: question.trim()
                    ? "linear-gradient(135deg, #d4a855, #f0d78c)"
                    : "rgba(212,168,85,0.2)",
                  color: question.trim() ? "#0a0a1a" : "rgba(192,192,208,0.4)",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: question.trim() ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                  boxShadow: question.trim() ? "0 8px 24px rgba(212,168,85,0.25)" : "none",
                }}
              >
                {t("✦ 抽一卦", "✦ Draw One Hexagram", "✦ 一卦を引く", "✦ 한 괘 뽑기")}
              </button>
            </motion.div>
          )}

          {(step === "drawing" || step === "result") && hex && (
            <motion.div
              key="hex-area"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{ textAlign: "center" }}
            >
              {/* 卦象顯示:六爻自下而上揭示 + 卦象大字 */}
              <div
                style={{
                  margin: "20px auto 16px",
                  width: 200,
                  padding: 24,
                  borderRadius: 16,
                  background: "rgba(13,13,43,0.6)",
                  border: "1px solid rgba(212,168,85,0.4)",
                  boxShadow: "0 8px 32px rgba(212,168,85,0.18)",
                }}
              >
                {/* 六爻 — drawing step 時依 revealedLines 漸進顯示;result step 全部顯示 */}
                <HexagramLines
                  lines={hex.lines}
                  revealedCount={step === "result" ? 6 : revealedLines}
                />

                {/* 卦象 Unicode 大字 + 卦名 — 全部揭示後才顯現 */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: (step === "result" || revealedLines >= 6) ? 1 : 0,
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
                    {t(
                      hex.nameZh,
                      hex.nameEn.split(" ")[0],
                      hex.nameJa,
                      hex.nameKo
                    )}
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
                  {/* 上下卦組成 */}
                  <UpperLowerTrigrams
                    upperCode={hex.upperTrigram}
                    lowerCode={hex.lowerTrigram}
                    t={t}
                  />

                  {verdict && (
                    <motion.div
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4 }}
                      style={{
                        margin: "20px auto",
                        display: "inline-block",
                        padding: "12px 36px",
                        borderRadius: 100,
                        fontSize: 28,
                        fontWeight: 800,
                        fontFamily: "'Noto Serif TC', serif",
                        letterSpacing: 2,
                        background:
                          verdict === "yes"
                            ? "linear-gradient(135deg, #4ade80, #22c55e)"
                            : verdict === "no"
                              ? "linear-gradient(135deg, #f87171, #ef4444)"
                              : "linear-gradient(135deg, #d4a855, #f0d78c)",
                        color: "#0a0a1a",
                        boxShadow:
                          verdict === "yes"
                            ? "0 0 32px rgba(74,222,128,0.4)"
                            : verdict === "no"
                              ? "0 0 32px rgba(248,113,113,0.4)"
                              : "0 0 32px rgba(212,168,85,0.4)",
                      }}
                    >
                      {verdict === "yes"
                        ? t("YES · 是", "YES", "YES · はい", "YES · 예")
                        : verdict === "no"
                          ? t("NO · 否", "NO", "NO · いいえ", "NO · 아니오")
                          : t("看條件 · DEPENDS", "DEPENDS", "条件次第 · DEPENDS", "조건부 · DEPENDS")}
                    </motion.div>
                  )}

                  {/* 卦辭原文 — 古漢語跨語系統一顯示;對照頁籤上方有現代訳 */}
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
                      {t("卦辭", "Judgment", "卦辞", "괘사")}
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
                      minHeight: 100,
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

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
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
// 卦線渲染:支援漸進揭示(自下而上)— drawing 動畫專用
// ──────────────────────────────────────────
function HexagramLines({
  lines,
  revealedCount,
}: {
  lines: number[];
  revealedCount: number;
}) {
  const w = 130;
  const h = 11;
  const gap = 12;
  const gapInner = 14;
  // lines[0] 是最下爻,渲染要倒過來(最上爻畫在上面)
  // 但「揭示順序」要從最下爻(lines[0])開始,所以渲染時要對應 idx 反向
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
      {display.map(({ line, originalIdx }, _idx) => {
        const isRevealed = originalIdx < revealedCount;
        return (
          <motion.div
            key={originalIdx}
            initial={false}
            animate={{
              opacity: isRevealed ? 1 : 0,
              scaleX: isRevealed ? 1 : 0.4,
            }}
            transition={{ duration: 0.25 }}
            style={{ width: w, transformOrigin: "center" }}
          >
            {line === 1 ? (
              <div
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: 2,
                  background: "#d4a855",
                }}
              />
            ) : (
              <div style={{ display: "flex", gap: gapInner, width: "100%" }}>
                <div style={{ flex: 1, height: h, borderRadius: 2, background: "#d4a855" }} />
                <div style={{ flex: 1, height: h, borderRadius: 2, background: "#d4a855" }} />
              </div>
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
  t,
}: {
  upperCode: string;
  lowerCode: string;
  t: (zh: string, en: string, ja?: string, ko?: string) => string;
}) {
  const upper = trigramNames[upperCode];
  const lower = trigramNames[lowerCode];
  if (!upper || !lower) return null;
  const upperName = t(upper.zh, upper.en, upper.ja, upper.ko);
  const lowerName = t(lower.zh, lower.en, lower.ja, lower.ko);
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
