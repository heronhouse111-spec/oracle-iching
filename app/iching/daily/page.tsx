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
 * 動畫:仿 /daily 塔羅版的翻牌動畫 — 載入時顯示背牌,fetch 完成後 rotateY 翻到正面。
 *      正面是卦象方塊(六爻 + 卦名 + 編號)。背面用 ICHING_BACK_IMAGE 統一資產,
 *      跟塔羅的 CARD_BACK_IMAGE 對等。先前的「六爻自下而上揭示」已替換掉。
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import NewCardToast from "@/components/NewCardToast";
import { getHexagramByNumber, trigramNames } from "@/data/hexagrams";
import { ICHING_BACK_IMAGE, hexagramImageKey } from "@/lib/ichingImages";
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
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });
  // Card collection toast state — 新卡彈金色,重複卡也彈橘色「恭喜獲得」
  const [collectionToast, setCollectionToast] = useState<{
    show: boolean;
    isNew: boolean;
    cardName: string;
    count: number;
    rewards: number;
  }>({ show: false, isNew: true, cardName: "", count: 0, rewards: 0 });
  // phase 36:訪客 3 天免費期 banner 用
  const [guestStatus, setGuestStatus] = useState<{
    authenticated: boolean;
    daysRemaining: number;
    usedToday: boolean;
    limit: number;
    allowed: boolean;
  } | null>(null);
  const ranRef = useRef(false);
  // admin 上傳的 64 卦插圖 — 客端 lazy fetch,沒上傳的卦會 fallback 到爻線+卦名文字。
  // pattern 跟 app/page.tsx 對齊,直接 dynamic import supabase/client 避免在 SSR bundle。
  const [ichingImages, setIchingImages] = useState<Record<string, string>>({});

  const hex = hexNumber !== null ? getHexagramByNumber(hexNumber) : null;
  const hexImgUrl = hex ? ichingImages[hexagramImageKey(hex.number)] : undefined;

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void start();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase
          .from("app_content")
          .select("value")
          .eq("key", "iching_images")
          .maybeSingle();
        if (cancelled) return;
        if (data?.value && typeof data.value === "object") {
          setIchingImages(data.value as Record<string, string>);
        }
      } catch {
        /* fallback 是爻線顯示,不影響流程 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function start() {
    // phase 36:訪客也直接 fetchDaily,server 端用 fingerprint 限流
    // 同時併發 fetch guest-status 給 banner 顯示用
    setPhase("loading");
    void fetchGuestStatus();
    try {
      await fetchDaily();
    } catch (e) {
      console.error(e);
      setPhase("guest");
    }
  }

  async function fetchGuestStatus() {
    try {
      const res = await fetch("/api/daily/guest-status?kind=iching", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setGuestStatus(data);
    } catch {
      /* banner 顯示不關鍵 */
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
        // phase 36:訪客 3 天免費期用完才會走到這裡(server fingerprint 限流)
        setIsStreaming(false);
        setPhase("guest");
        void fetchGuestStatus(); // 重抓 banner 反映「免費期已結束」
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

      // 收藏 toast — 抽到 = 跳(reread 同日重抽不彈)
      // 新卡彈金色,重複卡彈橘色「恭喜獲得」鼓勵繼續收集
      const isNewCard = res.headers.get("X-Collection-IsNew") === "1";
      const collectionCount = parseInt(res.headers.get("X-Collection-Count") ?? "0", 10);
      const rewards = parseInt(res.headers.get("X-Collection-Rewards") ?? "0", 10);
      if (num && !isReread) {
        const drawnHex = getHexagramByNumber(num);
        const cardName = drawnHex
          ? t(drawnHex.nameZh, drawnHex.nameEn, drawnHex.nameJa, drawnHex.nameKo)
          : `第 ${num} 卦`;
        setCollectionToast({
          show: true,
          isNew: isNewCard,
          cardName,
          count: collectionCount,
          rewards,
        });
      }

      // 翻牌動畫:背 → 正,跟 /daily 一致 0.7s
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
          <div style={{ marginTop: 10 }}>
            <span
              style={{
                display: "inline-block",
                color: "#d4a855",
                fontSize: 12,
                fontWeight: 600,
                background: "rgba(212,168,85,0.12)",
                border: "1px solid rgba(212,168,85,0.3)",
                padding: "4px 12px",
                borderRadius: 9999,
              }}
            >
              {t(
                "每天 1 點(同日重開免費)",
                "1 credit per day (re-open free)",
                "1 日 1 ポイント(同日再表示は無料)",
                "하루 1 포인트(같은 날 재열람 무료)"
              )}
            </span>
          </div>
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

          {/* phase 36:訪客 3 天免費期 banner */}
          {guestStatus && !guestStatus.authenticated && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                lineHeight: 1.55,
                border: !guestStatus.allowed
                  ? "1px solid rgba(248,113,113,0.45)"
                  : "1px solid rgba(110,231,183,0.35)",
                background: !guestStatus.allowed
                  ? "linear-gradient(135deg, rgba(248,113,113,0.10), rgba(0,0,0,0.02))"
                  : "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(0,0,0,0.02))",
                color: !guestStatus.allowed ? "#fca5a5" : "#6ee7b7",
                display: "inline-block",
                maxWidth: 480,
              }}
            >
              {!guestStatus.allowed
                ? t(
                    `你的訪客 ${guestStatus.limit} 天免費期已用完。登入即可繼續每日一卦,首次登入贈送 30 點 🎁`,
                    `Your ${guestStatus.limit}-day guest free trial is over. Sign in — 30 free credits on first login 🎁`,
                    `ゲスト ${guestStatus.limit} 日間の無料体験が終了。ログインで続行、初回 30 ポイント贈呈 🎁`,
                    `게스트 ${guestStatus.limit}일 무료 체험 종료. 로그인하면 계속 — 첫 로그인 30 포인트 증정 🎁`
                  )
                : guestStatus.usedToday
                  ? t(
                      `✨ 訪客今日已抽過(剩 ${guestStatus.daysRemaining} 天免費期)。登入會員贈 30 點 + 點數系統解鎖`,
                      `✨ Today's draw used (${guestStatus.daysRemaining} guest days left). Sign in for 30 free credits.`,
                      `✨ 本日抽出済(残り ${guestStatus.daysRemaining} 日)。ログインで 30 ポイント贈呈。`,
                      `✨ 오늘 이미 뽑음 (남은 ${guestStatus.daysRemaining}일). 로그인 시 30 포인트 증정.`
                    )
                  : t(
                      `✨ 訪客免費期還剩 ${guestStatus.daysRemaining} / ${guestStatus.limit} 天。登入會員贈 30 點 + 卡牌收藏紀錄永久保留`,
                      `✨ ${guestStatus.daysRemaining} of ${guestStatus.limit} guest free days left. Sign in for 30 free credits + permanent collection history.`,
                      `✨ ゲスト無料 残り ${guestStatus.daysRemaining}/${guestStatus.limit} 日。ログインで 30 ポイント + コレクション永久保存。`,
                      `✨ 게스트 무료 ${guestStatus.daysRemaining}/${guestStatus.limit}일 남음. 로그인하면 30 포인트 + 컬렉션 영구 저장.`
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
              {/* 翻牌動畫 — 背 → 正,200×320,跟 /daily 同尺寸 */}
              <div
                style={{
                  margin: "20px auto 16px",
                  perspective: 1200,
                  width: 200,
                  height: 320,
                }}
              >
                <motion.div
                  initial={{ rotateY: 180 }}
                  animate={{ rotateY: phase === "ready" ? 0 : 180 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    transformStyle: "preserve-3d",
                  }}
                >
                  {/* 正面 — 有 admin 卦圖優先用圖,字疊在底部漸層上;沒上傳則 fallback 到爻線+文字 */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid rgba(212,168,85,0.5)",
                      boxShadow: "0 8px 32px rgba(212,168,85,0.25)",
                      background:
                        "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(13,13,43,0.85))",
                    }}
                  >
                    {hexImgUrl ? (
                      <>
                        <Image
                          src={hexImgUrl}
                          alt={t(
                            hex.nameZh,
                            hex.nameEn.split(" ")[0],
                            hex.nameJa,
                            hex.nameKo
                          )}
                          fill
                          sizes="200px"
                          style={{ objectFit: "cover" }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: 0,
                            padding: "32px 16px 14px",
                            background:
                              "linear-gradient(to bottom, rgba(13,13,43,0) 0%, rgba(13,13,43,0.92) 70%)",
                            textAlign: "center",
                          }}
                        >
                          <div
                            style={{
                              color: "#fde68a",
                              fontSize: 22,
                              fontWeight: 700,
                              fontFamily: "'Noto Serif TC', serif",
                              lineHeight: 1.2,
                              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                            }}
                          >
                            {t(
                              hex.nameZh,
                              hex.nameEn.split(" ")[0],
                              hex.nameJa,
                              hex.nameKo
                            )}
                          </div>
                          <div style={{ color: "rgba(229,229,240,0.7)", fontSize: 11, marginTop: 4 }}>
                            {t(
                              `第 ${hex.number} 卦`,
                              `Hexagram ${hex.number}`,
                              `第 ${hex.number} 卦`,
                              `제 ${hex.number} 괘`
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "20px 16px",
                        }}
                      >
                        <DailyHexagramLines lines={hex.lines} revealedCount={6} />
                        <div style={{ marginTop: 16 }}>
                          <div
                            style={{
                              color: "#fde68a",
                              fontSize: 22,
                              fontWeight: 700,
                              fontFamily: "'Noto Serif TC', serif",
                              lineHeight: 1.2,
                            }}
                          >
                            {t(
                              hex.nameZh,
                              hex.nameEn.split(" ")[0],
                              hex.nameJa,
                              hex.nameKo
                            )}
                          </div>
                          <div style={{ color: "rgba(192,192,208,0.55)", fontSize: 11, marginTop: 4 }}>
                            {t(
                              `第 ${hex.number} 卦`,
                              `Hexagram ${hex.number}`,
                              `第 ${hex.number} 卦`,
                              `제 ${hex.number} 괘`
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 背面 — 易經背牌圖 */}
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
                      src={ICHING_BACK_IMAGE}
                      alt="hexagram card back"
                      width={400}
                      height={640}
                      priority
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
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

      <LoginOptionsModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        next="/iching/daily"
        title={t(
          "登入即可繼續每日一卦",
          "Sign in to keep your daily hexagram",
          "ログインで毎日の卦を継続",
          "로그인하여 매일의 괘 계속"
        )}
        subtitle={t(
          "🎁 首次登入贈送 30 點(夠占 6 次易經 / 塔羅、15 次每日一卦)",
          "🎁 Sign up bonus: 30 free credits (≈ 6 readings or 15 daily draws)",
          "🎁 初回ログインで 30 ポイント贈呈(易経・タロット 6 回分相当)",
          "🎁 첫 로그인 시 30 포인트 증정 (점 6회 분량)"
        )}
      />
      <InsufficientCreditsModal
        open={creditsModal.open}
        required={creditsModal.required}
        onClose={() => setCreditsModal({ open: false, required: 0 })}
      />
      <NewCardToast
        show={collectionToast.show}
        type="iching"
        isNew={collectionToast.isNew}
        cardName={collectionToast.cardName}
        collectionCount={collectionToast.count}
        total={64}
        rewardCredits={collectionToast.rewards}
        onDismiss={() => setCollectionToast((s) => ({ ...s, show: false }))}
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
