"use client";

/**
 * /daily — 每日一卡(Daily Card)
 *
 * 流程:
 *   - 必須登入(訪客 → 登入 modal)
 *   - 自動拉今天的牌(server-side deterministic by user.id + date)
 *   - 同日重抽不再扣點(server 用 X-Daily-Reread header 告知)
 *   - AI 給「今日訊息」短文(streaming)
 *
 * 為何不允許重抽:每日一卡的儀式感來自「今天就是這張牌」。
 *   想重抽請走主流程或 Yes/No。
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
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

type Phase = "idle" | "loading" | "revealing" | "ready" | "guest";

export default function DailyPage() {
  const { locale, t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("idle");
  const [cardId, setCardId] = useState<string | null>(null);
  const [isReversed, setIsReversed] = useState(false);
  const [reread, setReread] = useState(false); // server 告知今天已扣過
  const [aiText, setAiText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [dateKey, setDateKey] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });
  const ranRef = useRef(false);

  const card = cardId ? tarotDeck.find((c) => c.id === cardId) : null;

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
      const { data: { user } } = await sb.auth.getUser();
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
      const res = await fetch("/api/daily", {
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
        setAiText(t("AI 服務暫時無法回應,請稍後再試。", "AI service is temporarily unavailable."));
        return;
      }

      // 從 header 拿這次的牌
      const cId = res.headers.get("X-Daily-CardId");
      const rev = res.headers.get("X-Daily-Reversed") === "1";
      const date = res.headers.get("X-Daily-Date") || "";
      const isReread = res.headers.get("X-Daily-Reread") === "1";
      if (cId) setCardId(cId);
      setIsReversed(rev);
      setDateKey(date);
      setReread(isReread);

      // 翻牌動畫,給 0.7s 讓 user 看到 reveal
      setPhase("revealing");
      setTimeout(() => setPhase("ready"), 700);

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
      setAiText(t("發生錯誤,請再試一次。", "Something went wrong, please retry."));
    } finally {
      setIsStreaming(false);
    }
  }

  // 顯示日期 — 走當下 locale 的 toLocaleDateString
  const dateLocaleTag =
    locale === "zh" ? "zh-TW" : locale === "ja" ? "ja-JP" : locale === "ko" ? "ko-KR" : "en-US";
  const dateLabel = dateKey
    ? new Date(dateKey + "T00:00:00+08:00").toLocaleDateString(dateLocaleTag, {
        year: "numeric", month: "long", day: "numeric", weekday: "long",
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
            {t("每日一卡", "Daily Card")}
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            {t(
              "每天為你抽一張牌,給今天的能量一個提醒。",
              "One card a day — a reminder for today's energy."
            )}
          </p>
          {dateLabel && (
            <div style={{ color: "rgba(212,168,85,0.85)", fontSize: 13, marginTop: 6 }}>
              {dateLabel}
              {reread && (
                <span style={{ color: "rgba(192,192,208,0.5)", fontSize: 11, marginLeft: 8 }}>
                  {t("(今日已抽過,不再扣點)", "(already drawn today, no charge)")}
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
              <div style={{ fontSize: 40, marginBottom: 8 }}>🌙</div>
              <p style={{ color: "#e8e8f0", fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>
                {t(
                  "登入即可解鎖每日一卡 — 為你保留每天獨一無二的能量訊息。",
                  "Sign in to unlock your Daily Card — a unique energy message saved each day for you."
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
                {t("✦ 登入抽今日卡", "✦ Sign in for today's card")}
              </button>
              <div style={{ color: "rgba(212,168,85,0.6)", fontSize: 11, marginTop: 12 }}>
                {t("每天 1 點(同日重抽免費)", "1 credit per day (no recharge on re-open)")}
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
              {t("正在為你抽今日卡 …", "Drawing your card for today …")}
            </motion.div>
          )}

          {(phase === "revealing" || phase === "ready") && card && (
            <motion.div
              key="card"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: "center" }}
            >
              <motion.div
                style={{
                  margin: "20px auto 16px",
                  perspective: 1200,
                  width: 200,
                  height: 320,
                }}
              >
                <motion.div
                  initial={{ rotateY: 180 }}
                  animate={{
                    rotateY: phase === "ready" ? 0 : 180,
                    rotate: phase === "ready" && isReversed ? 180 : 0,
                  }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  style={{
                    width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d",
                  }}
                >
                  <div
                    style={{
                      position: "absolute", inset: 0, backfaceVisibility: "hidden",
                      borderRadius: 14, overflow: "hidden",
                      border: "1px solid rgba(212,168,85,0.5)",
                      boxShadow: "0 8px 32px rgba(212,168,85,0.25)",
                    }}
                  >
                    <Image src={card.imagePath} alt={t(card.nameZh, card.nameEn)} width={400} height={640}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div
                    style={{
                      position: "absolute", inset: 0, backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                      borderRadius: 14, overflow: "hidden",
                      border: "1px solid rgba(212,168,85,0.5)",
                      boxShadow: "0 8px 32px rgba(212,168,85,0.25)",
                    }}
                  >
                    <Image src={CARD_BACK_IMAGE} alt="card back" width={400} height={640}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                </motion.div>
              </motion.div>

              <div
                style={{
                  color: "#c0c0d0", fontSize: 16, marginBottom: 4,
                  fontFamily: "'Noto Serif TC', serif",
                }}
              >
                {t(card.nameZh, card.nameEn)}
                <span style={{ color: "rgba(192,192,208,0.6)", fontSize: 13, marginLeft: 6 }}>
                  ({isReversed ? t("逆位", "Reversed") : t("正位", "Upright")})
                </span>
              </div>

              <div
                style={{
                  background: "rgba(13,13,43,0.6)",
                  border: "1px solid rgba(212,168,85,0.2)",
                  borderRadius: 14, padding: 20, margin: "20px auto 20px",
                  maxWidth: 560, textAlign: "left", lineHeight: 1.8,
                  color: "#e8e8f0", fontSize: 15, minHeight: 100,
                }}
              >
                {aiText || (isStreaming ? t("塔羅師正在寫今日訊息…", "Reader is writing today's message…") : "")}
                {isStreaming && <span style={{ color: "#d4a855" }}> ▌</span>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                <Link
                  href="/yes-no"
                  style={{
                    color: "#d4a855",
                    fontSize: 13,
                    textDecoration: "underline",
                  }}
                >
                  {t("有具體問題?試試 Yes/No 占卜 →", "Got a specific question? Try Yes/No →")}
                </Link>
                <Link
                  href="/"
                  style={{
                    color: "rgba(212,168,85,0.7)",
                    fontSize: 13,
                    textDecoration: "underline",
                  }}
                >
                  {t("想要完整解讀?去主流程 →", "Want a full reading? Go to main flow →")}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <LoginOptionsModal open={loginOpen} onClose={() => setLoginOpen(false)} next="/daily" />
      <InsufficientCreditsModal
        open={creditsModal.open}
        required={creditsModal.required}
        onClose={() => setCreditsModal({ open: false, required: 0 })}
      />
    </main>
  );
}
