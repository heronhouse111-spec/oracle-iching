"use client";

/**
 * /iching/direction-hexagram — 方位卦象合參「卜卦工具」頁
 *
 * 流程定位:
 *   - 不再有設問頁、類別選擇、AI 串流、結果展示。
 *   - 只負責「轉羅盤 → 方位卜得 → 6 次擲爻」這一段過場。
 *   - 完成後把 directionTrigram + 卦資料 + question/category 寫入 sessionStorage,
 *     再 router.push 回首頁 ?resumeFlow=method-result 由首頁 result step 接手。
 *
 * 進場條件:
 *   必須帶 ?resumeFlow=compass,且 sessionStorage("iching_resume_state") 有 q+cat。
 *   缺一就 router.push("/iching")。
 *
 * 階段機:
 *   compass → compass-result(2 秒緩衝 + 點按下一步) → coins(自動連 6 次)
 *   coins 完 → 寫 method-result + redirect。
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import CompassWheel from "@/components/CompassWheel";
import CoinAnimation from "@/components/CoinAnimation";
import { trigramNames, findHexagram } from "@/data/hexagrams";
import { trigramImageKey } from "@/lib/ichingImages";
import { questionCategories } from "@/lib/divination";

const RESUME_STATE_KEY = "iching_resume_state";
const METHOD_RESULT_KEY = "iching_method_result_state";

type Phase = "compass" | "compass-result" | "coins";

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
  const lineValue: 0 | 1 = sum === 6 || sum === 8 ? 0 : 1;
  const isChanging = sum === 6 || sum === 9;
  return { coins, sum, lineValue, isChanging };
}

interface Props {
  /** key 形式 `trigram:<code>` → admin 上傳的八卦圖 storage url */
  images: Record<string, string>;
}

export default function DirectionHexagramFlowView({ images }: Props) {
  const { t } = useLanguage();
  const router = useRouter();

  const guardRef = useRef(false);
  const [resumeState, setResumeState] = useState<{
    question: string;
    category: string;
  } | null>(null);

  const [phase, setPhase] = useState<Phase>("compass");
  const [directionTrigram, setDirectionTrigram] = useState<string | null>(null);

  const [tosses, setTosses] = useState<CoinTossEntry[]>([]);
  const [currentCoins, setCurrentCoins] = useState<[number, number, number] | null>(
    null
  );
  const [isFlipping, setIsFlipping] = useState(false);
  const tossesRef = useRef<CoinTossEntry[]>([]);

  // ── 入場守門 ──
  useEffect(() => {
    if (guardRef.current) return;
    guardRef.current = true;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("resumeFlow") !== "compass") {
      router.replace("/iching");
      return;
    }

    let pending: { question?: string; category?: string } | null = null;
    try {
      const raw = sessionStorage.getItem(RESUME_STATE_KEY);
      if (raw) pending = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    if (
      !pending?.question?.trim() ||
      !pending?.category ||
      !questionCategories.some((c) => c.id === pending.category)
    ) {
      router.replace("/iching");
      return;
    }

    setResumeState({
      question: pending.question.trim(),
      category: pending.category,
    });
  }, [router]);

  // ── 階段 → 階段切換 ──
  function onCompassDone(code: string) {
    setDirectionTrigram(code);
    // 羅盤停定後緩衝 2 秒讓使用者看,再切到 compass-result
    setTimeout(() => setPhase("compass-result"), 2000);
  }

  async function startCoinTosses() {
    setTosses([]);
    tossesRef.current = [];
    for (let i = 0; i < 6; i++) {
      const t = tossOnce();
      setIsFlipping(true);
      setCurrentCoins(t.coins);
      await new Promise((r) => setTimeout(r, 1300));
      setIsFlipping(false);
      await new Promise((r) => setTimeout(r, 250));
      tossesRef.current = [...tossesRef.current, t];
      setTosses(tossesRef.current);
    }
    setCurrentCoins(null);

    // 6 爻完 → 算卦 + 寫 method-result + 跳回首頁
    if (!resumeState || !directionTrigram) return;
    const primaryLines = tossesRef.current.map((t) => t.lineValue);
    const changingLines = tossesRef.current
      .map((t, i) => (t.isChanging ? i : -1))
      .filter((i) => i !== -1);
    const hex = findHexagram(primaryLines);
    if (!hex) {
      console.error("[direction-hex] could not resolve hexagram");
      router.replace("/iching");
      return;
    }
    let relatingNumber: number | null = null;
    let relatingLines: number[] | null = null;
    if (changingLines.length > 0) {
      relatingLines = primaryLines.map((line, i) =>
        changingLines.includes(i) ? (line === 1 ? 0 : 1) : line
      );
      const relatingHex = findHexagram(relatingLines);
      relatingNumber = relatingHex?.number ?? null;
    }

    try {
      sessionStorage.setItem(
        METHOD_RESULT_KEY,
        JSON.stringify({
          method: "direction-hexagram",
          question: resumeState.question,
          category: resumeState.category,
          directionTrigram,
          hexagramNumber: hex.number,
          primaryLines,
          changingLines,
          relatingNumber,
          relatingLines,
        })
      );
      sessionStorage.removeItem(RESUME_STATE_KEY);
      router.replace("/?resumeFlow=method-result");
    } catch (e) {
      console.error("[direction-hex] redirect failed:", e);
      router.replace("/iching");
    }
  }

  // 沒通過守門就別 render 內容(避免閃畫面)
  if (!resumeState) return null;

  const directionTg = directionTrigram ? trigramNames[directionTrigram] : null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "16px" }}>
      <header style={{ textAlign: "center", marginBottom: 24, marginTop: 16 }}>
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
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 28,
            fontWeight: 700,
            margin: 0,
          }}
        >
          {phase === "compass"
            ? t("第一步 · 卜方位", "Step 1 · Spin the Compass", "第一段 · 方位を占う", "1단계 · 방위 점치기")
            : phase === "compass-result"
              ? t("方位卜得", "Direction Drawn", "方位を得たり", "방위를 얻다")
              : t("第二步 · 卜六爻", "Step 2 · Cast Six Lines", "第二段 · 六爻を立てる", "2단계 · 육효 세우기")}
        </h1>
      </header>

      <AnimatePresence mode="wait">
        {/* ────────── 羅盤 ────────── */}
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

        {/* ────────── 方位卜得結果頁 ────────── */}
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
                onClick={() => {
                  setPhase("coins");
                  // 進入 coins 階段後立即開始擲錢
                  setTimeout(() => void startCoinTosses(), 200);
                }}
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

        {/* ────────── 銅錢卜爻 ────────── */}
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

            <CoinAnimation coins={currentCoins} isFlipping={isFlipping} />

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

            {tosses.length === 6 && (
              <div
                style={{
                  marginTop: 24,
                  fontSize: 13,
                  color: "rgba(212,168,85,0.85)",
                  fontStyle: "italic",
                }}
              >
                {t(
                  "六爻已成 · 整理結果中…",
                  "Six lines complete · preparing the result…",
                  "六爻完成 · 結果を整えています…",
                  "여섯 효 완성 · 결과 정리 중…"
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 退出口 — 萬一卡住可以回去 */}
      <div
        style={{
          marginTop: 32,
          textAlign: "center",
          fontSize: 11,
          color: "rgba(192,192,208,0.5)",
        }}
      >
        <Link
          href="/iching"
          style={{ color: "rgba(212,168,85,0.6)", textDecoration: "none" }}
        >
          ← {t(
            "返回方法選擇",
            "Back to methods",
            "方法選択へ戻る",
            "방법 선택으로"
          )}
        </Link>
      </div>
    </div>
  );
}
