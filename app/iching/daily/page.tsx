"use client";

/**
 * /iching/daily — 每日一卦
 *
 * 跟 /daily (塔羅版) 同流程:
 *   - 必須登入(訪客 → 登入 modal)
 *   - 自動拉今天的卦 (server-side deterministic by user.id + date)
 *   - 同日重抽不再扣點(server 用 X-Daily-Reread header 告知)
 *   - AI 給今日訊息(streaming)
 *
 * 動畫:六爻自下而上揭示,取代塔羅的翻牌動畫,跟「擲銅錢」儀式感拉開區隔
 *      (這是「今天就是這一卦」,不是占卜過程)。
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import { getHexagramByNumber, trigramNames } from "@/data/hexagrams";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

type Phase = "idle" | "loading" | "revealing" | "ready" | "guest";

export default function IChingDailyPage() {
  const { locale, t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("idle");
  const [hexNumber, setHexNumber] = useState<number | null>(null);
  const [reread, setReread] = useState(false);
  const [aiText, setAiText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [dateKey, setDateKey] = useState("");
  const [revealedLines, setRevealedLines] = useState(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });
  const ranRef = useRef(false);

  const hex = hexNumber !== null ? getHexagramByNumber(hexNumber) : null;

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void start();
  }, []);

  async function start() {
    if (!isSupabaseConfigured) {
      setPhase("guest");
      return;
    }
    setPhase("loading");
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        setPhase("guest");
        return;
      }
      await fetchDaily();
    } catch (e) {
      console.error(e);
      setPhase("guest");
    }
  }

  async function fetchDaily() {
    setPhase("loading");
    setAiText("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/iching/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });

      if (res.status === 401) {
        setIsStreaming(false);
        setPhase("guest");
        setLoginOpen(true);
        return;
      }
      if (res.status === 402) {
        const info = await parseInsufficientCredits(res);
        setIsStreaming(false);
        setPhase("guest");
        setCreditsModal({ open: true, required: info?.required ?? 1 });
        return;
      }
      if (!res.ok) {
        setIsStreaming(false);
        setPhase("guest");
        setAiText(
          t(
            "AI 服務暫時無法回應,請稍後再試。",
            "AI service is temporarily unavailable.",
            "AI サービスが一時的に利用できません。",
            "AI 서비스를 일시적으로 사용할 수 없습니다."
          )
        );
        return;
      }

      const numStr = res.headers.get("X-Daily-HexagramNumber");
      const date = res.headers.get("X-Daily-Date") || "";
      const isReread = res.headers.get("X-Daily-Reread") === "1";
      const num = numStr ? parseInt(numStr, 10) : null;
      if (num) setHexNumber(num);
      setDateKey(date);
      setReread(isReread);

      // 進入 reveal 階段:六爻自下而上揭示 (~660ms),完成後才進 ready
      setPhase("revealing");
      setRevealedLines(0);
      // 啟動 reveal 序列
      void runRevealSequence();

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAiText((prev) => prev + decoder.decode(value, { stream: true }));
      }
      if (!isReread) notifyCreditsChanged();
    } catch (e) {
      console.error(e);
      setAiText(
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

  async function runRevealSequence() {
    for (let i = 1; i <= 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 110));
      setRevealedLines(i);
    }
    await new Promise((r) => setTimeout(r, 200));
    setPhase("ready");
  }

  const dateLocaleTag =
    locale === "zh" ? "zh-TW" : locale === "ja" ? "ja-JP" : locale === "ko" ? "ko-KR" : "en-US";
  const dateLabel = dateKey
    ? new Date(dateKey + "T00:00:00+08:00").toLocaleDateString(dateLocaleTag, {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      })
    : "";

  return (
    <main className="bg-stars" style={{ minHeight: "100vh", paddingTop: 80 }}>
      <Header />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 28, fontWeight: 700, margin: 0 }}
          >
            {t("每日一卦", "Daily Hexagram", "毎日の卦", "오늘의 괘")}
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            {t(
              "每天為你抽一卦,給今天的能量一個提醒。",
              "One hexagram a day — a reminder for today's energy.",
              "1 日 1 卦、今日のエネルギーへのリマインダー。",
              "하루 한 괘 — 오늘의 에너지를 일깨웁니다."
            )}
          </p>
          {dateLabel && (
            <div style={{ color: "rgba(212,168,85,0.85)", fontSize: 13, marginTop: 6 }}>
              {dateLabel}
              {reread && (
                <span style={{ color: "rgba(192,192,208,0.5)", fontSize: 11, marginLeft: 8 }}>
                  {t(
                    "(今日已抽過,不再扣點)",
                    "(already drawn today, no charge)",
                    "(本日抽出済み、再課金なし)",
                    "(오늘 이미 뽑음, 추가 차감 없음)"
                  )}
                </span>
              )}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {phase === "guest" && (
            <motion.div
              key="guest"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                background: "rgba(13,13,43,0.6)",
                border: "1px solid rgba(212,168,85,0.2)",
                borderRadius: 14,
                padding: 24,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>☯</div>
              <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
                {t(
                  "登入即可解鎖每日一卦 — 為你保留每天獨一無二的能量訊息。",
                  "Sign in to unlock your Daily Hexagram — a unique energy message saved each day for you.",
                  "ログインで毎日の卦を解錠 — あなただけの今日のエネルギーメッセージ。",
                  "로그인하면 매일의 괘를 해제 — 매일 당신만을 위한 에너지 메시지."
                )}
              </p>
              <button
                onClick={() => setLoginOpen(true)}
                style={{
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
                  "✦ 登入抽今日卦",
                  "✦ Sign in for today's hexagram",
                  "✦ ログインして今日の卦を引く",
                  "✦ 로그인하고 오늘의 괘 뽑기"
                )}
              </button>
              <div style={{ color: "rgba(212,168,85,0.6)", fontSize: 11, marginTop: 12 }}>
                {t(
                  "每天 1 點(同日重開免費)",
                  "1 credit per day (no recharge on re-open)",
                  "1 日 1 ポイント(同日再表示は無料)",
                  "하루 1 포인트(같은 날 재열람 무료)"
                )}
              </div>
            </motion.div>
          )}

          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: "center", padding: "40px 0", color: "#c0c0d0" }}
            >
              {t(
                "正在為你抽今日卦 …",
                "Drawing your hexagram for today …",
                "今日の卦を引いています …",
                "오늘의 괘를 뽑고 있습니다 …"
              )}
            </motion.div>
          )}

          {(phase === "revealing" || phase === "ready") && hex && (
            <motion.div
              key="hex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: "center" }}
            >
              {/* 卦象框 */}
              <div
                style={{
                  margin: "20px auto 16px",
                  width: 220,
                  padding: 28,
                  borderRadius: 16,
                  background: "rgba(13,13,43,0.6)",
                  border: "1px solid rgba(212,168,85,0.4)",
                  boxShadow: "0 8px 32px rgba(212,168,85,0.18)",
                }}
              >
                <DailyHexagramLines
                  lines={hex.lines}
                  revealedCount={phase === "ready" ? 6 : revealedLines}
                />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: phase === "ready" || revealedLines >= 6 ? 1 : 0 }}
                  transition={{ duration: 0.4 }}
                  style={{ marginTop: 18 }}
                >
                  <div
                    style={{
                      fontSize: 48,
                      color: "rgba(212,168,85,0.9)",
                      lineHeight: 1,
                      marginBottom: 10,
                    }}
                  >
                    {hex.character}
                  </div>
                  <div
                    style={{
                      color: "#e8e8f0",
                      fontSize: 20,
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
                  <div style={{ color: "rgba(192,192,208,0.5)", fontSize: 12, marginTop: 2 }}>
                    {t(
                      `第 ${hex.number} 卦`,
                      `Hexagram ${hex.number}`,
                      `第 ${hex.number} 卦`,
                      `제 ${hex.number} 괘`
                    )}
                  </div>
                </motion.div>
              </div>

              {/* 上下卦組成(僅 ready 顯示) */}
              {phase === "ready" && (
                <UpperLowerTrigrams
                  upperCode={hex.upperTrigram}
                  lowerCode={hex.lowerTrigram}
                  t={t}
                />
              )}

              {/* 卦辭原文(古漢語跨語系統一顯示)*/}
              {phase === "ready" && (
                <div
                  style={{
                    background: "rgba(13,13,43,0.5)",
                    border: "1px solid rgba(212,168,85,0.18)",
                    borderRadius: 10,
                    padding: 12,
                    margin: "12px auto 0",
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
              )}

              {/* 今日訊息 */}
              <div
                style={{
                  background: "rgba(13,13,43,0.6)",
                  border: "1px solid rgba(212,168,85,0.2)",
                  borderRadius: 14,
                  padding: 20,
                  margin: "20px auto 20px",
                  maxWidth: 560,
                  textAlign: "left",
                  lineHeight: 1.8,
                  color: "#e8e8f0",
                  fontSize: 15,
                  minHeight: 100,
                }}
              >
                {aiText ||
                  (isStreaming
                    ? t(
                        "占卜師正在寫今日訊息…",
                        "Diviner is writing today's message…",
                        "占い師が今日のメッセージを書いています…",
                        "점술가가 오늘의 메시지를 쓰고 있습니다…"
                      )
                    : "")}
                {isStreaming && <span style={{ color: "#d4a855" }}> ▌</span>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                <Link
                  href={`/iching/hexagrams/${hex.number}`}
                  style={{
                    color: "#d4a855",
                    fontSize: 13,
                    textDecoration: "underline",
                  }}
                >
                  {t(
                    "看這一卦的完整介紹 →",
                    "View this hexagram's full entry →",
                    "この卦の完全解説を見る →",
                    "이 괘의 전체 설명 보기 →"
                  )}
                </Link>
                <Link
                  href="/iching/yes-no"
                  style={{
                    color: "rgba(212,168,85,0.8)",
                    fontSize: 13,
                    textDecoration: "underline",
                  }}
                >
                  {t(
                    "有具體問題?試試 Yes/No 速答 →",
                    "Got a specific question? Try Yes/No →",
                    "具体的な質問?Yes/No へ →",
                    "구체적인 질문이 있나요? Yes/No로 →"
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
                    "想要完整解讀?去主流程 →",
                    "Want a full reading? Go to main flow →",
                    "詳しい解読?メイン画面へ →",
                    "전체 해석? 메인 플로우로 →"
                  )}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <LoginOptionsModal open={loginOpen} onClose={() => setLoginOpen(false)} next="/iching/daily" />
      <InsufficientCreditsModal
        open={creditsModal.open}
        required={creditsModal.required}
        onClose={() => setCreditsModal({ open: false, required: 0 })}
      />
    </main>
  );
}

function DailyHexagramLines({
  lines,
  revealedCount,
}: {
  lines: number[];
  revealedCount: number;
}) {
  const w = 140;
  const h = 12;
  const gap = 13;
  const gapInner = 16;
  // 揭示順序 = 自下而上,所以渲染時要反轉並紀錄 originalIdx
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
        margin: "0 0 12px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 22, color: "#d4a855", lineHeight: 1 }}>
          {upper.symbol}
        </span>
        <span style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}>
          {t(`上 ${upperName}`, `Upper ${upperName}`, `上 ${upperName}`, `상 ${upperName}`)}
        </span>
      </div>
      <span style={{ color: "rgba(212,168,85,0.4)" }}>／</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 22, color: "#d4a855", lineHeight: 1 }}>
          {lower.symbol}
        </span>
        <span style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}>
          {t(`下 ${lowerName}`, `Lower ${lowerName}`, `下 ${lowerName}`, `하 ${lowerName}`)}
        </span>
      </div>
    </div>
  );
}
