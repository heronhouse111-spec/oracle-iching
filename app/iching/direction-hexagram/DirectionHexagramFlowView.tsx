"use client";

/**
 * /iching/direction-hexagram — 方位卦象合參占卜流程頁
 *
 * 階段機:
 *   question → compass → coins → reveal
 *
 * - question: 設問 + 分類選擇 + 心法提醒
 * - compass : 顯示 CompassWheel,點擊轉動,~3 秒後拿到 trigram code
 * - coins   : 連續 6 次三錢擲卦,自動執行 + 動畫(每爻間隔 1.4s)
 * - reveal  : 顯示方位 + 完整六爻卦,串接 /api/iching/direction-hexagram 流式 AI
 *
 * 跟既有流程一致:
 *   - 訪客可用,但不存 DB、不扣點(API 那層判斷)
 *   - 登入用戶會扣 CREDIT_COSTS.DIRECTION_HEX
 *   - 點數不足 → 402 → 顯示 InsufficientCreditsModal
 */

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import CompassWheel from "@/components/CompassWheel";
import CoinAnimation from "@/components/CoinAnimation";
import {
  trigramNames,
  hexagramAuspice,
  trigramRelationship,
  findHexagram,
} from "@/data/hexagrams";
import { trigramImageKey } from "@/lib/ichingImages";
import { questionCategories } from "@/lib/divination";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";

type Phase =
  | "question"
  | "compass"
  | "compass-result" // 羅盤停定後的「方位卜得」結果頁,使用者按下一步才進入 coins
  | "coins"
  | "reveal";

interface CoinTossEntry {
  coins: [number, number, number];
  sum: number;
  lineValue: 0 | 1;
  isChanging: boolean;
}

function tossOnce(): CoinTossEntry {
  const coins: [number, number, number] = [
    Math.random() < 0.5 ? 2 : 3,
    Math.random() < 0.5 ? 2 : 3,
    Math.random() < 0.5 ? 2 : 3,
  ];
  const sum = coins[0] + coins[1] + coins[2];
  // 6 老陰(0,變)/ 7 少陽(1,不變)/ 8 少陰(0,不變)/ 9 老陽(1,變)
  const lineValue: 0 | 1 = sum === 6 || sum === 8 ? 0 : 1;
  const isChanging = sum === 6 || sum === 9;
  return { coins, sum, lineValue, isChanging };
}

const AUSPICE_STYLE = {
  great: { bg: "rgba(74,222,128,0.18)", text: "#86efac" },
  mixed: { bg: "rgba(212,168,85,0.20)", text: "#fde68a" },
  challenge: { bg: "rgba(248,113,113,0.18)", text: "#fca5a5" },
} as const;

interface Props {
  /** key 形式 `trigram:<code>` → admin 上傳的八卦圖 storage url。沒上傳就是 undefined。 */
  images: Record<string, string>;
}

export default function DirectionHexagramFlowView({ images }: Props) {
  const { locale, t } = useLanguage();

  const [phase, setPhase] = useState<Phase>("question");
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<string>("general");

  // 第一段 · 方位
  const [directionTrigram, setDirectionTrigram] = useState<string | null>(null);

  // 第二段 · 六爻
  const [tosses, setTosses] = useState<CoinTossEntry[]>([]);
  const [currentCoins, setCurrentCoins] = useState<[number, number, number] | null>(
    null
  );
  const [isFlipping, setIsFlipping] = useState(false);

  // 揭示 + AI
  const [hexNumber, setHexNumber] = useState<number | null>(null);
  const [relatingNumber, setRelatingNumber] = useState<number | null>(null);
  const [aiText, setAiText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Modals
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });

  const tossesRef = useRef<CoinTossEntry[]>([]);

  // ──────────────────────────────────────────
  // 階段 → 階段切換
  // ──────────────────────────────────────────
  function startCompass() {
    if (question.trim().length === 0) return;
    setPhase("compass");
  }

  function onCompassDone(code: string) {
    setDirectionTrigram(code);
    // 羅盤停定後再停 2 秒(讓使用者看完指針指向哪),
    // 才轉場到「方位卜得」結果頁。使用者按下一步才會進入 coins。
    setTimeout(() => setPhase("compass-result"), 2000);
  }

  async function startCoinTosses() {
    setTosses([]);
    tossesRef.current = [];
    // 6 次擲錢,每次 1.4s 動畫(對應 CoinAnimation 內的 ~1.2s + 緩衝)
    for (let i = 0; i < 6; i++) {
      const t = tossOnce();
      setIsFlipping(true);
      setCurrentCoins(t.coins);
      // 動畫進行中
      await new Promise((r) => setTimeout(r, 1300));
      setIsFlipping(false);
      // 顯示結果一下
      await new Promise((r) => setTimeout(r, 250));
      tossesRef.current = [...tossesRef.current, t];
      setTosses(tossesRef.current);
    }
    setCurrentCoins(null);
    // 6 爻完 → reveal + 呼叫 AI
    setPhase("reveal");
    void callAi();
  }

  async function callAi() {
    if (!directionTrigram || tossesRef.current.length !== 6) return;

    const primaryLines = tossesRef.current.map((t) => t.lineValue);
    const changingLines = tossesRef.current
      .map((t, i) => (t.isChanging ? i : -1))
      .filter((i) => i !== -1);

    setIsStreaming(true);
    setAiText("");
    setStreamError(null);

    try {
      const res = await fetch("/api/iching/direction-hexagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          category,
          directionTrigram,
          primaryLines,
          changingLines,
          locale,
        }),
      });

      if (res.status === 402) {
        const info = await parseInsufficientCredits(res);
        setIsStreaming(false);
        setCreditsModal({ open: true, required: info?.required ?? 6 });
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
        console.error("direction-hex API error:", res.status, txt);
        return;
      }

      const numStr = res.headers.get("X-DH-HexagramNumber");
      const relStr = res.headers.get("X-DH-RelatingNumber");
      const num = numStr ? parseInt(numStr, 10) : null;
      const rel = relStr ? parseInt(relStr, 10) : null;
      if (num) setHexNumber(num);
      if (rel) setRelatingNumber(rel);

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
          "오류が発生しました。다시 시도하세요。"
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
    setDirectionTrigram(null);
    setTosses([]);
    tossesRef.current = [];
    setHexNumber(null);
    setRelatingNumber(null);
    setAiText("");
    setStreamError(null);
  }

  // ──────────────────────────────────────────
  // Derived: hexagram from current lines
  // ──────────────────────────────────────────
  const primaryLines = tosses.map((t) => t.lineValue);
  const hex = hexNumber !== null ? findHexagram(primaryLines) : null;
  const directionTg = directionTrigram ? trigramNames[directionTrigram] : null;
  const upper = hex ? trigramNames[hex.upperTrigram] : null;
  const lower = hex ? trigramNames[hex.lowerTrigram] : null;
  const auspice = hex ? hexagramAuspice[hex.number] : null;
  const relationship =
    hex && trigramRelationship(hex.upperTrigram, hex.lowerTrigram);

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
              "方位 × 卦象 合參",
              "DIRECTION × HEXAGRAM",
              "方位 × 卦象 合参",
              "방위 × 괘상 합참"
            )}
          </p>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 28, fontWeight: 700, margin: 0 }}
          >
            {phase === "question"
              ? t("靜心設問", "Frame Your Question", "静心して問いを定める", "마음을 가라앉히고 묻기")
              : phase === "compass"
                ? t("第一步 · 卜方位", "Step 1 · Spin the Compass", "第一段 · 方位を占う", "1단계 · 방위 점치기")
                : phase === "compass-result"
                  ? t("方位卜得", "Direction Drawn", "方位を得たり", "방위를 얻다")
                  : phase === "coins"
                    ? t("第二步 · 卜六爻", "Step 2 · Cast Six Lines", "第二段 · 六爻を立てる", "2단계 · 육효 세우기")
                    : t("合參結果", "Combined Reading", "合参の結果", "합참 결과")}
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
                    "焚香或靜坐片刻,把問題在心中明確化。問得越具體,卦象回的訊息也越具體。同一事不宜反覆占問。",
                    "Burn incense or sit quietly. Bring the question into focus — the more concrete the asking, the more concrete the reply. Don't divine the same matter repeatedly.",
                    "香を焚くかしばし静坐し、問いを心に明確にする。具体的に問えば、応えも具体的。同じ事を繰り返し占わぬこと。",
                    "향을 사르거나 잠시 정좌하여 질문을 마음에 분명히 하세요. 구체적으로 물을수록 응답도 구체적입니다. 같은 일을 반복해 점치지 마세요."
                  )}
                </p>
              </section>

              {/* 問題輸入 */}
              <section style={{ marginBottom: 18 }}>
                <label
                  htmlFor="dh-question"
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
                  id="dh-question"
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

              <button
                type="button"
                onClick={startCompass}
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
                  "靜心完畢,進入卜方位 →",
                  "I'm Ready · Spin the Compass →",
                  "心が定まった。方位を占う →",
                  "마음이 가라앉음 · 방위 점치기 →"
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
                  "登入會員自動扣 6 點(訪客可體驗,但不存記錄、無扣點)",
                  "6 credits charged for logged-in members (guests can preview without saving or charging)",
                  "ログイン会員は 6 ポイント自動消費(ゲストは記録なし・課金なしで体験可)",
                  "로그인 회원은 6 포인트 자동 차감(게스트는 저장·차감 없이 체험 가능)"
                )}
              </div>
            </motion.div>
          )}

          {/* ────────── Phase 2: 羅盤 ────────── */}
          {phase === "compass" && (
            <motion.div
              key="compass"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              style={{ textAlign: "center" }}
            >
              <p
                style={{
                  color: "rgba(192,192,208,0.85)",
                  fontSize: 14,
                  lineHeight: 1.85,
                  marginBottom: 24,
                }}
              >
                {t(
                  "心中默念你的問題,然後轉動羅盤。指針所指的方位,即是事之所在。",
                  "Hold your question in mind, then spin the compass. Where the pointer lands is where the matter lies.",
                  "心中で問いを念じてから羅盤を回す。指針の指す方位こそが事の在処。",
                  "마음속으로 질문을 떠올린 뒤 나침반을 돌리세요. 바늘이 가리키는 방위가 일의 자리입니다."
                )}
              </p>

              <CompassWheel onResult={onCompassDone} disabled={!!directionTrigram} />

              {/* 停定後不在這頁顯示結果 — onCompassDone 會延遲 2 秒後切到 compass-result phase。
                  期間圖上指針還停在剛指到的方位,使用者看得到「指到哪」這個瞬間。 */}
              {directionTrigram && (
                <div
                  style={{
                    marginTop: 18,
                    fontSize: 12,
                    color: "rgba(212,168,85,0.7)",
                    fontStyle: "italic",
                  }}
                >
                  {t(
                    "指針已停定 · 整理結果中…",
                    "Pointer settled · preparing the result…",
                    "指針停止 · 結果を整えています…",
                    "바늘이 멈춤 · 결과 정리 중…"
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ────────── Phase 2.5: 方位卜得結果 ────────── */}
          {phase === "compass-result" && directionTg && (
            <motion.div
              key="compass-result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              style={{ textAlign: "center" }}
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.17, 0.67, 0.3, 0.99] }}
                style={{
                  display: "inline-block",
                  padding: "32px 28px",
                  background:
                    "linear-gradient(135deg, rgba(13,13,43,0.85), rgba(40,30,80,0.85))",
                  border: "1px solid #d4a855",
                  borderRadius: 18,
                  boxShadow:
                    "0 8px 32px rgba(212,168,85,0.25), inset 0 0 24px rgba(212,168,85,0.06)",
                  minWidth: 300,
                  maxWidth: 480,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: 3,
                    color: "rgba(212,168,85,0.7)",
                    marginBottom: 14,
                  }}
                >
                  {t(
                    "方位卜得",
                    "DIRECTION DRAWN",
                    "得た方位",
                    "얻은 방위"
                  )}
                </div>
                {/* 圖片框 — 跟 /iching/hexagrams 八卦速覽同 9:14 直幅。
                    admin 有上傳就用真圖,沒上傳 fallback 顯示 Unicode 卦符。 */}
                {(() => {
                  const imgUrl = directionTrigram
                    ? images[trigramImageKey(directionTrigram)]
                    : undefined;
                  return (
                    <div
                      style={{
                        width: 144,
                        margin: "0 auto 16px",
                        aspectRatio: "9 / 14",
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "1px solid rgba(212,168,85,0.4)",
                        background:
                          "linear-gradient(135deg, rgba(212,168,85,0.10), rgba(13,13,43,0.6))",
                        boxShadow:
                          "0 4px 18px rgba(212,168,85,0.25), inset 0 0 12px rgba(212,168,85,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {imgUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgUrl}
                          alt={t(
                            directionTg.zh,
                            directionTg.en,
                            directionTg.ja,
                            directionTg.ko
                          )}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 64,
                            color: "#d4a855",
                            lineHeight: 1,
                            filter: "drop-shadow(0 0 16px rgba(212,168,85,0.5))",
                          }}
                        >
                          {directionTg.symbol}
                        </span>
                      )}
                    </div>
                  );
                })()}
                <div
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: 26,
                    color: "#fde68a",
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  {t(directionTg.zh, directionTg.en, directionTg.ja, directionTg.ko)}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "rgba(212,168,85,0.85)",
                    marginBottom: 18,
                  }}
                >
                  {t(
                    directionTg.directionZh,
                    directionTg.directionEn,
                    directionTg.directionJa,
                    directionTg.directionKo
                  )}
                </div>
                <div
                  style={{
                    textAlign: "left",
                    fontSize: 13,
                    color: "#c0c0d0",
                    lineHeight: 1.85,
                    paddingTop: 14,
                    borderTop: "1px dashed rgba(212,168,85,0.25)",
                  }}
                >
                  <div style={{ marginBottom: 4 }}>
                    <strong style={{ color: "rgba(212,168,85,0.9)" }}>
                      {t("人事", "People", "人事", "인사")}
                    </strong>
                    ：
                    {t(
                      directionTg.peopleZh,
                      directionTg.peopleEn,
                      directionTg.peopleJa,
                      directionTg.peopleKo
                    )}
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <strong style={{ color: "rgba(212,168,85,0.9)" }}>
                      {t("事理", "Matters", "事理", "사리")}
                    </strong>
                    ：
                    {t(
                      directionTg.mattersZh,
                      directionTg.mattersEn,
                      directionTg.mattersJa,
                      directionTg.mattersKo
                    )}
                  </div>
                  <div>
                    <strong style={{ color: "rgba(212,168,85,0.9)" }}>
                      {t("提示", "Advice", "助言", "조언")}
                    </strong>
                    ：
                    <span style={{ color: "#e8e8f0" }}>
                      {t(
                        directionTg.adviceZh,
                        directionTg.adviceEn,
                        directionTg.adviceJa,
                        directionTg.adviceKo
                      )}
                    </span>
                  </div>
                </div>
              </motion.div>

              <div style={{ marginTop: 28 }}>
                <button
                  type="button"
                  onClick={() => setPhase("coins")}
                  style={{
                    padding: "12px 30px",
                    background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                    color: "#0a0a1a",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    minWidth: 220,
                  }}
                >
                  {t(
                    "下一步 · 占卜 64 卦 →",
                    "Next · Cast the Hexagram →",
                    "次へ · 64卦を占う →",
                    "다음 · 64괘 점치기 →"
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ────────── Phase 3: 銅錢卜爻 ────────── */}
          {phase === "coins" && (
            <motion.div
              key="coins"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              style={{ textAlign: "center" }}
            >
              <p
                style={{
                  color: "rgba(192,192,208,0.85)",
                  fontSize: 14,
                  lineHeight: 1.85,
                  marginBottom: 16,
                }}
              >
                {t(
                  "用三枚銅錢擲六次,自下而上得六爻成卦。",
                  "Toss three coins six times — bottom toss is line 1, top toss is line 6.",
                  "三枚の銅貨を六回投げ、下から順に六爻を作る。",
                  "동전 세 개를 여섯 번 던져 아래에서 위로 여섯 효를 만듭니다."
                )}
              </p>

              {/* 進度顯示 */}
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(212,168,85,0.85)",
                  marginBottom: 12,
                }}
              >
                {t(
                  `第 ${tosses.length + (currentCoins ? 1 : 0)} / 6 爻`,
                  `Line ${tosses.length + (currentCoins ? 1 : 0)} / 6`,
                  `第 ${tosses.length + (currentCoins ? 1 : 0)} / 6 爻`,
                  `${tosses.length + (currentCoins ? 1 : 0)} / 6 효`
                )}
              </div>

              {/* 銅錢動畫區 */}
              <CoinAnimation coins={currentCoins} isFlipping={isFlipping} />

              {/* 已成的爻列表 */}
              {tosses.length > 0 && (
                <div
                  style={{
                    marginTop: 18,
                    display: "flex",
                    flexDirection: "column-reverse",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  {tosses.map((t, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        fontSize: 12,
                        color: "rgba(192,192,208,0.85)",
                      }}
                    >
                      <span style={{ width: 30, textAlign: "right" }}>#{i + 1}</span>
                      <div style={{ width: 80 }}>
                        {t.lineValue === 1 ? (
                          <div
                            style={{
                              height: 6,
                              borderRadius: 2,
                              background: t.isChanging ? "#fca5a5" : "#d4a855",
                            }}
                          />
                        ) : (
                          <div style={{ display: "flex", gap: 8 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 6,
                                borderRadius: 2,
                                background: t.isChanging ? "#fca5a5" : "#d4a855",
                              }}
                            />
                            <div
                              style={{
                                flex: 1,
                                height: 6,
                                borderRadius: 2,
                                background: t.isChanging ? "#fca5a5" : "#d4a855",
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <span style={{ width: 40, fontSize: 11 }}>
                        {t.isChanging ? "★" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 起始 / 重擲按鈕 */}
              {tosses.length === 0 && !isFlipping && !currentCoins && (
                <button
                  type="button"
                  onClick={startCoinTosses}
                  style={{
                    marginTop: 22,
                    padding: "12px 32px",
                    background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                    color: "#0a0a1a",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t(
                    "✦ 開始擲六爻",
                    "✦ Begin Six Tosses",
                    "✦ 六爻を投げ始める",
                    "✦ 여섯 효 던지기 시작"
                  )}
                </button>
              )}
            </motion.div>
          )}

          {/* ────────── Phase 4: 揭示 + AI ────────── */}
          {phase === "reveal" && hex && directionTg && upper && lower && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* 方位 */}
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
                    fontSize: 11,
                    letterSpacing: 2,
                    color: "rgba(212,168,85,0.7)",
                    marginBottom: 8,
                  }}
                >
                  {t("第一段 · 方位", "STAGE 1 · DIRECTION", "第一段 · 方位", "1단 · 방위")}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 32, color: "#d4a855", lineHeight: 1 }}>
                    {directionTg.symbol}
                  </span>
                  <div>
                    <div
                      style={{
                        fontFamily: "'Noto Serif TC', serif",
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#fde68a",
                      }}
                    >
                      {t(directionTg.zh, directionTg.en, directionTg.ja, directionTg.ko)}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(212,168,85,0.85)" }}>
                      {t(
                        directionTg.directionZh,
                        directionTg.directionEn,
                        directionTg.directionJa,
                        directionTg.directionKo
                      )}
                    </div>
                  </div>
                </div>
                <p
                  style={{
                    color: "#c0c0d0",
                    fontSize: 13,
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >
                  <strong style={{ color: "rgba(212,168,85,0.9)" }}>
                    {t("人事", "People", "人事", "인사")}
                  </strong>
                  ：
                  {t(
                    directionTg.peopleZh,
                    directionTg.peopleEn,
                    directionTg.peopleJa,
                    directionTg.peopleKo
                  )}
                  <br />
                  <strong style={{ color: "rgba(212,168,85,0.9)" }}>
                    {t("事理", "Matters", "事理", "사리")}
                  </strong>
                  ：
                  {t(
                    directionTg.mattersZh,
                    directionTg.mattersEn,
                    directionTg.mattersJa,
                    directionTg.mattersKo
                  )}
                </p>
              </section>

              {/* 卦象 */}
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
                    fontSize: 11,
                    letterSpacing: 2,
                    color: "rgba(212,168,85,0.7)",
                    marginBottom: 8,
                  }}
                >
                  {t(
                    "第二段 · 六爻卦象",
                    "STAGE 2 · HEXAGRAM",
                    "第二段 · 六爻卦象",
                    "2단 · 육효 괘상"
                  )}
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
                      `第 ${hex.number} 卦`,
                      `Hexagram ${hex.number}`,
                      `第 ${hex.number} 卦`,
                      `제 ${hex.number} 괘`
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
                    {t(hex.nameZh, hex.nameEn, hex.nameJa, hex.nameKo)}
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
                  {relatingNumber && (
                    <>
                      　·
                      <span style={{ color: "#fca5a5" }}>
                        {t(
                          `之卦：第 ${relatingNumber} 卦`,
                          `Relating: ${relatingNumber}`,
                          `之卦:第 ${relatingNumber} 卦`,
                          `지괘: 제 ${relatingNumber} 괘`
                        )}
                      </span>
                    </>
                  )}
                </div>
                <Link
                  href={`/iching/hexagrams/${hex.number}`}
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

              {/* AI 合參解讀 */}
              <section
                style={{
                  background:
                    "linear-gradient(135deg, rgba(212,168,85,0.10), rgba(99,179,237,0.08))",
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
                    "合參解讀",
                    "COMBINED READING",
                    "合参解読",
                    "합참 해독"
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
                      "占卜師正在合參方位與卦象…",
                      "The diviner is weaving direction and hexagram together…",
                      "占い師が方位と卦象を合わせ参じています…",
                      "점술사가 방위와 괘상을 합쳐 보고 있습니다…"
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
