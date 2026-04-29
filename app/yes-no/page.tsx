"use client";

/**
 * /yes-no — Yes/No 一張牌快速占卜
 *
 * 流程:輸入問題 → 抽 1 張牌 → 顯示牌與正逆位 → AI 一段話解釋 → CTA 引導去主流程
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import { tarotDeck, CARD_BACK_IMAGE } from "@/data/tarot";
import { drawOneCard } from "@/data/spreads";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";

type Step = "ask" | "drawing" | "result";
type Verdict = "yes" | "no" | "depends";

export default function YesNoPage() {
  const { locale, t } = useLanguage();
  const [step, setStep] = useState<Step>("ask");
  const [question, setQuestion] = useState("");
  const [drawnCardId, setDrawnCardId] = useState<string | null>(null);
  const [isReversed, setIsReversed] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [aiText, setAiText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });
  const abortRef = useRef<AbortController | null>(null);

  const card = drawnCardId ? tarotDeck.find((c) => c.id === drawnCardId) : null;

  const handleDraw = async () => {
    if (!question.trim()) return;
    setStep("drawing");
    const drawn = drawOneCard();
    setDrawnCardId(drawn.card.id);
    setIsReversed(drawn.isReversed);

    // 翻牌動畫 1 秒後 fetch
    await new Promise((r) => setTimeout(r, 900));

    setStep("result");
    setIsLoading(true);
    setAiText("");

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/yesno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: drawn.card.id,
          isReversed: drawn.isReversed,
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
        setAiText(t(
          "AI 服務暫時無法回應,請稍後再試。",
          "AI service is temporarily unavailable, please try again later.",
          "AI サービスが一時的に利用できません。しばらくしてから再度お試しください。",
          "AI 서비스가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요."
        ));
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
        setAiText(t(
          "發生錯誤,請再試一次。",
          "Something went wrong, please retry.",
          "エラーが発生しました。もう一度お試しください。",
          "오류가 발생했습니다. 다시 시도해 주세요."
        ));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep("ask");
    setQuestion("");
    setDrawnCardId(null);
    setIsReversed(false);
    setVerdict(null);
    setAiText("");
  };

  // 16px input(memory:iOS Safari auto-zoom)
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
            {t("Yes/No 一張牌占卜", "Yes/No Tarot", "Yes/No 一枚引きタロット", "Yes/No 한 장 타로")}
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            {t(
              "問一個明確的二元問題,抽一張牌,看見答案的方向。",
              "Ask a clear binary question, draw one card, glimpse the direction."
            )}
          </p>
          <div style={{ color: "rgba(212,168,85,0.7)", fontSize: 11, marginTop: 6 }}>
            {t(
              "每次占卜消耗 1 點",
              "Each reading costs 1 credit",
              "1 回の占いで 1 ポイント消費",
              "1회 점 1 포인트 소모"
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
                    "你想問什麼?(請以是/否能回答的方式)",
                    "Your yes/no question:",
                    "何を聞きたいですか?(はい/いいえで答えられる形で)",
                    "무엇을 묻고 싶나요?(예/아니오로 답할 수 있게)"
                  )}
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t(
                    "例:這個月我會收到那個工作的 offer 嗎?",
                    "e.g., Will I receive that job offer this month?"
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
                {t("✦ 抽一張牌", "✦ Draw One Card", "✦ 1 枚引く", "✦ 한 장 뽑기")}
              </button>
            </motion.div>
          )}

          {(step === "drawing" || step === "result") && card && (
            <motion.div
              key="card-area"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{ textAlign: "center" }}
            >
              <motion.div
                style={{
                  margin: "20px auto 16px",
                  perspective: 1200,
                  width: 180,
                  height: 280,
                }}
              >
                <motion.div
                  initial={{ rotateY: 180 }}
                  animate={{
                    rotateY: step === "result" ? 0 : 180,
                    rotate: step === "result" && isReversed ? 180 : 0,
                  }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid rgba(212,168,85,0.5)",
                      boxShadow: "0 8px 32px rgba(212,168,85,0.25)",
                    }}
                  >
                    <Image
                      src={card.imagePath}
                      alt={t(card.nameZh, card.nameEn)}
                      width={360}
                      height={560}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid rgba(212,168,85,0.5)",
                      boxShadow: "0 8px 32px rgba(212,168,85,0.25)",
                    }}
                  >
                    <Image
                      src={CARD_BACK_IMAGE}
                      alt="card back"
                      width={360}
                      height={560}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                </motion.div>
              </motion.div>

              {step === "result" && (
                <>
                  <div
                    style={{
                      color: "#c0c0d0",
                      fontSize: 14,
                      marginBottom: 4,
                      fontFamily: "'Noto Serif TC', serif",
                    }}
                  >
                    {t(card.nameZh, card.nameEn)}
                    <span style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginLeft: 6 }}>
                      ({isReversed
                        ? t("逆位", "Reversed", "逆位置", "역방향")
                        : t("正位", "Upright", "正位置", "정방향")})
                    </span>
                  </div>

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
                            "塔羅師正在解讀…",
                            "Tarot reader is interpreting…",
                            "タロット占い師が解読中…",
                            "타로 점술사가 해석 중…"
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
                      {t(
                        "✦ 再問一個",
                        "✦ Ask another",
                        "✦ もう一つ質問",
                        "✦ 또 하나 묻기"
                      )}
                    </button>
                    <Link
                      href="/"
                      style={{
                        color: "rgba(212,168,85,0.8)",
                        fontSize: 13,
                        textDecoration: "underline",
                      }}
                    >
                      {t(
                        "想看更深入的解讀?試試完整占卜 →",
                        "Want a deeper reading? Try a full divination →",
                        "より深い解読が見たい?完全な占いを試す →",
                        "더 깊은 해석을 보고 싶나요? 완전한 점을 시도하세요 →"
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
