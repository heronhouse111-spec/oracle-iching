"use client";

/**
 * /iching/plum-blossom — 梅花易數 · 時間起卦流程頁
 *
 * 階段機:
 *   question → casting (~1.5s 起卦動畫) → reveal
 *
 * - question : 設問 + 分類選擇 + 心法提醒
 * - casting  : 顯示「起卦中…」短動畫,送 castEpochMs 到 server
 * - reveal   : 顯示本卦/動爻/之卦,串接 /api/iching/plum-blossom 流式 AI
 *
 * 關鍵 — castEpochMs:用客端 epoch 起卦,server 從這個時間算上下卦動爻。
 * 不用 server now() 是因為 server 可能在 UTC,user 在台灣;同一秒在不同時區
 * 算出來的卦不同。
 */

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import {
  trigramNames,
  hexagramAuspice,
  getHexagramByNumber,
} from "@/data/hexagrams";
import { hexagramImageKey } from "@/lib/ichingImages";
import { questionCategories } from "@/lib/divination";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";

type Phase = "question" | "casting" | "reveal";

interface Props {
  images: Record<string, string>;
}

const AUSPICE_STYLE = {
  great: { bg: "rgba(74,222,128,0.18)", text: "#86efac" },
  mixed: { bg: "rgba(212,168,85,0.20)", text: "#fde68a" },
  challenge: { bg: "rgba(248,113,113,0.18)", text: "#fca5a5" },
} as const;

export default function PlumBlossomFlowView({ images }: Props) {
  const { locale, t } = useLanguage();

  const [phase, setPhase] = useState<Phase>("question");
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<string>("general");

  const [hexNumber, setHexNumber] = useState<number | null>(null);
  const [relatingNumber, setRelatingNumber] = useState<number | null>(null);
  const [changingLine, setChangingLine] = useState<number | null>(null);
  const [aiText, setAiText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });

  const ranRef = useRef(false);

  const hex = hexNumber !== null ? getHexagramByNumber(hexNumber) : null;
  const relatingHex =
    relatingNumber !== null ? getHexagramByNumber(relatingNumber) : null;
  const upper = hex ? trigramNames[hex.upperTrigram] : null;
  const lower = hex ? trigramNames[hex.lowerTrigram] : null;
  const auspice = hex ? hexagramAuspice[hex.number] : null;

  async function startCast() {
    if (question.trim().length === 0) return;
    if (ranRef.current) return;
    ranRef.current = true;
    setPhase("casting");

    // 「起卦中」短停 1.4s 給儀式感,然後才送 request
    const castEpochMs = Date.now();
    await new Promise((r) => setTimeout(r, 1400));

    setIsStreaming(true);
    setAiText("");
    setStreamError(null);
    try {
      const res = await fetch("/api/iching/plum-blossom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          category,
          castEpochMs,
          locale,
        }),
      });

      if (res.status === 402) {
        const info = await parseInsufficientCredits(res);
        setIsStreaming(false);
        setPhase("question");
        ranRef.current = false;
        setCreditsModal({ open: true, required: info?.required ?? 5 });
        return;
      }
      if (!res.ok) {
        setIsStreaming(false);
        setPhase("question");
        ranRef.current = false;
        const txt = await res.text().catch(() => "");
        setStreamError(
          t(
            "AI 服務暫時無法回應,請稍後再試。",
            "AI service is temporarily unavailable, please try again later.",
            "AI サービスが一時的に利用できません。後ほどお試しください。",
            "AI 서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도하세요."
          )
        );
        console.error("plum-blossom API error:", res.status, txt);
        return;
      }

      const numStr = res.headers.get("X-PB-HexagramNumber");
      const relStr = res.headers.get("X-PB-RelatingNumber");
      const chStr = res.headers.get("X-PB-ChangingLine");
      const num = numStr ? parseInt(numStr, 10) : null;
      const rel = relStr ? parseInt(relStr, 10) : null;
      const ch = chStr ? parseInt(chStr, 10) : null;
      if (num) setHexNumber(num);
      if (rel) setRelatingNumber(rel);
      if (ch !== null && !Number.isNaN(ch)) setChangingLine(ch);

      setPhase("reveal");

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

  function reset() {
    setPhase("question");
    setQuestion("");
    setCategory("general");
    setHexNumber(null);
    setRelatingNumber(null);
    setChangingLine(null);
    setAiText("");
    setStreamError(null);
    ranRef.current = false;
  }

  return (
    <>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
        <nav style={{ fontSize: 12, color: "rgba(192,192,208,0.6)", marginBottom: 16 }}>
          <Link
            href="/iching"
            style={{ color: "rgba(212,168,85,0.7)", textDecoration: "none" }}
          >
            ← {t(
              "易經占卜方法選擇",
              "Choose I Ching Method",
              "易経占卜の方法選択",
              "주역 점법 선택"
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
              : phase === "casting"
                ? t("起卦中…", "Casting…", "起卦中…", "기괘 중…")
                : t("時間起卦結果", "Cast Result", "時間起卦の結果", "기괘 결과")}
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
              {/* 心法提醒 */}
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
                  {t(
                    "心法提醒",
                    "MIND NOTES",
                    "心法",
                    "마음가짐"
                  )}
                </div>
                <p style={{ color: "#e8e8f0", fontSize: 13.5, lineHeight: 1.85, margin: 0 }}>
                  {t(
                    "梅花易數的精神在於「萬物皆數」 — 你按下起卦的那一刻,當下的年月日時已決定了卦象。把問題寫清楚,輕輕按下起卦,讓時間自己說話。",
                    "The Plum Blossom way says 'all things are numbers' — the moment you cast, the year/month/day/hour decide the hexagram. Write the question clearly and let the moment itself speak.",
                    "梅花易数の精神は「万物は数」— 起卦の瞬間、その時刻の年月日時が卦を決める。問いを明確に書き、軽く起卦して、時にそのまま語らせる。",
                    "매화역수의 정신은 '만물은 수' — 기괘하는 순간의 연월일시가 괘를 결정합니다. 질문을 분명히 쓰고, 가볍게 기괘하여 시간이 스스로 말하게 하세요."
                  )}
                </p>
              </section>

              {/* 問題輸入 */}
              <section style={{ marginBottom: 18 }}>
                <label
                  htmlFor="pb-question"
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
                  id="pb-question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t(
                    "例如:此次合作能否順利?",
                    "e.g. Will this collaboration go smoothly?",
                    "例:今回の協業は順調に進むか?",
                    "예: 이번 협업이 순조로울까요?"
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

              {/* 類別選擇 */}
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

              {streamError && (
                <div
                  style={{
                    color: "#fca5a5",
                    fontSize: 13,
                    marginBottom: 14,
                    padding: "10px 12px",
                    border: "1px solid rgba(248,113,113,0.3)",
                    borderRadius: 8,
                    background: "rgba(248,113,113,0.08)",
                  }}
                >
                  {streamError}
                </div>
              )}

              <button
                type="button"
                onClick={startCast}
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
                  "✦ 起卦",
                  "✦ Cast Now",
                  "✦ 起卦する",
                  "✦ 기괘하기"
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

          {/* ────────── Phase 2: 起卦中 ────────── */}
          {phase === "casting" && (
            <motion.div
              key="casting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                textAlign: "center",
                padding: "60px 0",
                color: "rgba(192,192,208,0.85)",
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  fontSize: 56,
                  color: "#d4a855",
                  marginBottom: 18,
                }}
              >
                ☯
              </motion.div>
              <p style={{ fontSize: 14, lineHeight: 1.85 }}>
                {t(
                  "用此刻的年月日時為你起卦…",
                  "Casting from this very moment of year, month, day, and hour…",
                  "此の刻の年月日時から卦を立てています…",
                  "지금 이 순간의 연월일시로 괘를 세우는 중…"
                )}
              </p>
            </motion.div>
          )}

          {/* ────────── Phase 3: 揭示 ────────── */}
          {phase === "reveal" && hex && upper && lower && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* 卦象區 */}
              <section
                style={{
                  background: "rgba(13,13,43,0.55)",
                  border: "1px solid rgba(212,168,85,0.3)",
                  borderRadius: 14,
                  padding: 18,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(96px, 130px) 1fr",
                    gap: 14,
                    alignItems: "start",
                    marginBottom: 8,
                  }}
                >
                  {(() => {
                    const hexImgUrl = images[hexagramImageKey(hex.number)];
                    return (
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "9 / 14",
                          borderRadius: 8,
                          overflow: "hidden",
                          border: "1px solid rgba(212,168,85,0.3)",
                          background:
                            "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(13,13,43,0.6))",
                        }}
                      >
                        {hexImgUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={hexImgUrl}
                            alt={t(hex.nameZh, hex.nameEn, hex.nameJa, hex.nameKo)}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              display: "block",
                            }}
                          />
                        )}
                      </div>
                    );
                  })()}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "rgba(212,168,85,0.7)" }}>
                        {t("本卦", "Primary", "本卦", "본괘")}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(212,168,85,0.7)" }}>
                        {t(
                          `第 ${hex.number} 卦`,
                          `Hexagram ${hex.number}`,
                          `第 ${hex.number} 卦`,
                          `제 ${hex.number} 괘`
                        )}
                      </span>
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
                    <h2
                      className="text-gold-gradient"
                      style={{
                        fontFamily: "'Noto Serif TC', serif",
                        fontSize: 24,
                        margin: "0 0 8px",
                      }}
                    >
                      {t(hex.nameZh, hex.nameEn, hex.nameJa, hex.nameKo)}
                    </h2>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(192,192,208,0.7)",
                        marginBottom: 10,
                        lineHeight: 1.7,
                      }}
                    >
                      {upper.symbol}{" "}
                      {t(
                        `上 ${upper.zh}`,
                        `Upper ${upper.en.split(" ")[0]}`,
                        `上 ${upper.zh}`,
                        `상 ${upper.zh}`
                      )}
                      　/　{lower.symbol}{" "}
                      {t(
                        `下 ${lower.zh}`,
                        `Lower ${lower.en.split(" ")[0]}`,
                        `下 ${lower.zh}`,
                        `하 ${lower.zh}`
                      )}
                    </div>
                    {changingLine !== null && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#fca5a5",
                          lineHeight: 1.7,
                          marginBottom: 4,
                        }}
                      >
                        {t(
                          `動爻：第 ${changingLine + 1} 爻`,
                          `Changing line: line ${changingLine + 1}`,
                          `動爻:第 ${changingLine + 1} 爻`,
                          `동효: 제 ${changingLine + 1} 효`
                        )}
                      </div>
                    )}
                    {relatingHex && (
                      <div style={{ fontSize: 12, color: "#fca5a5", lineHeight: 1.7 }}>
                        {t(
                          `之卦：第 ${relatingHex.number} 卦 ${relatingHex.nameZh}`,
                          `Relating: ${relatingHex.number}. ${relatingHex.nameEn.split(" ")[0]}`,
                          `之卦:第 ${relatingHex.number} 卦 ${relatingHex.nameJa ?? relatingHex.nameZh}`,
                          `지괘: 제 ${relatingHex.number}괘 ${relatingHex.nameKo ?? relatingHex.nameEn.split(" ")[0]}`
                        )}
                      </div>
                    )}
                  </div>
                </div>
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
                  {t(
                    "AI 解卦",
                    "AI READING",
                    "AI 解卦",
                    "AI 풀이"
                  )}
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
                      "占卜師正在解讀本卦氣象、動爻時機與之卦走勢…",
                      "The diviner is reading the hexagram's mood, the changing-line moment, and the relating hexagram…",
                      "占い師が本卦の気象・動爻の時機・之卦の行方を読み解いています…",
                      "점술사가 본괘의 기운·동효의 시기·지괘의 흐름을 풀이하고 있습니다…"
                    )}
                  </p>
                )}
              </section>

              {/* 操作 */}
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
                  href="/iching"
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
                  {t("返回方法選擇", "Back to Methods", "方法選択へ戻る", "방법 선택으로")}
                </Link>
              </div>
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
    </>
  );
}
