"use client";

/**
 * /iching/yes-no — 易經一卦速答
 *
 * 流程跟 /yes-no(塔羅版)完全一致:
 *   ask  → 輸入問題
 *   drawing → 立刻抽一卦,翻牌動畫(背 → 正)
 *   result → 顯示卦象 + verdict (yes/no/depends) + AI 一段解釋
 *
 * 差別:不擲銅錢、不算變爻 — 直接從 64 卦中抽一個。
 * 動畫:跟 /iching/daily 同樣的 0.7s rotateY 翻牌,背面用 ICHING_BACK_IMAGE,
 *      跟塔羅版的 CardBacks.jpg 對等。
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import { hexagrams, getHexagramByNumber, trigramNames } from "@/data/hexagrams";
import { ICHING_BACK_IMAGE, hexagramImageKey } from "@/lib/ichingImages";

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";
// phase 35.7:訪客限流改 server DB,banner status 直接 fetch /api/yesno/guest-status
const GUEST_YESNO_FREE_DAYS = 10;
type GuestStatus = {
  authenticated: boolean;
  allowed: boolean;
  reason: "ok" | "used_today" | "limit_reached";
  daysRemaining: number;
  usedToday: boolean;
  limit: number;
};

type Step = "ask" | "drawing" | "result";
type Verdict = "yes" | "no" | "depends";

export default function IChingYesNoPage() {
  const { locale, t } = useLanguage();
  const [step, setStep] = useState<Step>("ask");
  const [question, setQuestion] = useState("");
  const [hexNumber, setHexNumber] = useState<number | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [aiText, setAiText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });
  const abortRef = useRef<AbortController | null>(null);

  // 認證 + 訪客限流狀態 — 一次 fetch /api/yesno/guest-status 拿全部
  // 為什麼合併:authed 狀態必須跟 guest status 同步揭曉,避免「authed=null + status=loaded」
  // 這種半生不熟的中間狀態讓 banner 顯示錯
  const [guestStatus, setGuestStatus] = useState<GuestStatus | null>(null);

  const refetchStatus = async () => {
    try {
      const res = await fetch("/api/yesno/guest-status", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as GuestStatus;
      setGuestStatus(data);
    } catch {
      /* ignore — UI 退回未載入態(banner 不顯示,按鈕仍可點) */
    }
  };

  useEffect(() => {
    void refetchStatus();
  }, []);

  // admin 上傳的 64 卦插圖 — 客端 lazy fetch,沒上傳的卦會 fallback 到爻線+卦名文字。
  // 跟 /iching/daily 跟 app/page.tsx 同一套 pattern。
  const [ichingImages, setIchingImages] = useState<Record<string, string>>({});
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

  const authed = guestStatus ? guestStatus.authenticated : null;

  const hex = hexNumber !== null ? getHexagramByNumber(hexNumber) : null;
  const hexImgUrl = hex ? ichingImages[hexagramImageKey(hex.number)] : undefined;

  const handleDraw = async () => {
    if (!question.trim()) return;

    // phase 35.7:狀態還在 loading 直接 return — 按鈕本來就 disabled,這層是 defensive。
    // 訪客限流由 server 端在 /api/iching/yesno 內判斷, 401 → 彈登入。
    // 這裡的 client-side preflight 純粹改善 UX(避免提交無謂請求),不是商業邏輯。
    if (!guestStatus) return;
    if (!guestStatus.authenticated && !guestStatus.allowed) {
      setLoginOpen(true);
      return;
    }

    setStep("drawing");

    // 立刻抽一卦(no 擲銅錢過程)
    const drawnNum = Math.floor(Math.random() * hexagrams.length) + 1;
    setHexNumber(drawnNum);

    // 翻牌動畫 — 背 → 正,跟 /iching/daily / /daily 同樣 700ms
    await new Promise((r) => setTimeout(r, 700));

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
        // phase 35.7:訪客被 server-side DB 限流擋下也是 401
        setIsLoading(false);
        setStep("ask");
        // 同步重抓最新 status — banner 立即反映「用盡」或「今日已用」
        void refetchStatus();
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
      // phase 35.7:server DB 已記錄,重抓 status 讓 banner 反映新剩餘天數
      void refetchStatus();
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
    setHexNumber(null);
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
                "每次占卜 2 點",
                "2 credits per reading",
                "1回につき 2 ポイント",
                "1회 점에 2포인트"
              )}
            </span>
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

              {/* 訪客 10 天免費期提示(phase 35.7)— status 從 /api/yesno/guest-status 來。
                  authenticated=false 才顯示,authenticated=true(會員)隱藏。 */}
              {guestStatus && !guestStatus.authenticated && (() => {
                const isExhausted = guestStatus.reason === "limit_reached";
                const isUsedToday = guestStatus.reason === "used_today";
                const isAvailable = guestStatus.allowed;
                const accent = isExhausted ? "#fca5a5" : isUsedToday ? "#d4a855" : "#6ee7b7";
                const bgFrom = isExhausted
                  ? "rgba(248,113,113,0.10)"
                  : isUsedToday
                    ? "rgba(212,168,85,0.10)"
                    : "rgba(16,185,129,0.08)";
                const borderColor = isExhausted
                  ? "rgba(248,113,113,0.45)"
                  : isUsedToday
                    ? "rgba(212,168,85,0.45)"
                    : "rgba(110,231,183,0.35)";

                return (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "10px 14px",
                      borderRadius: 10,
                      fontSize: 12,
                      lineHeight: 1.55,
                      border: `1px solid ${borderColor}`,
                      background: `linear-gradient(135deg, ${bgFrom}, rgba(0,0,0,0.02))`,
                      color: accent,
                    }}
                  >
                    {isExhausted
                      ? t(
                          `你的訪客 ${GUEST_YESNO_FREE_DAYS} 天免費期已用完。登入即可繼續占卜,首次登入贈送 30 點 🎁`,
                          `Your ${GUEST_YESNO_FREE_DAYS}-day guest free trial is over. Sign in to continue — 30 free credits on first login 🎁`,
                          `ゲスト ${GUEST_YESNO_FREE_DAYS} 日間の無料体験が終了しました。ログインで続行 — 初回 30 ポイント贈呈 🎁`,
                          `게스트 ${GUEST_YESNO_FREE_DAYS}일 무료 체험이 끝났습니다. 로그인하면 계속 점치기 — 첫 로그인 30 포인트 증정 🎁`
                        )
                      : isUsedToday
                        ? t(
                            `你今日已用過免費 Yes/No(訪客剩 ${guestStatus.daysRemaining} 天免費期)。明天再來,或登入贈 30 點 🎁`,
                            `Today's free Yes/No used (${guestStatus.daysRemaining} guest days left). Come back tomorrow, or sign in for 30 free credits 🎁`,
                            `本日の無料 Yes/No を使用済(残り ${guestStatus.daysRemaining} 日)。明日また、またはログインで 30 ポイント贈呈 🎁`,
                            `오늘 무료 Yes/No 사용 완료 (남은 무료 ${guestStatus.daysRemaining}일). 내일 다시 오거나 로그인하면 30 포인트 증정 🎁`
                          )
                        : isAvailable
                          ? t(
                              `✨ 訪客免費期還剩 ${guestStatus.daysRemaining} / ${GUEST_YESNO_FREE_DAYS} 天,每日 1 次。登入會員贈 30 點 + 解鎖每日簽到`,
                              `✨ ${guestStatus.daysRemaining} of ${GUEST_YESNO_FREE_DAYS} guest free days left, 1 reading per day. Sign in for 30 free credits + daily check-in`,
                              `✨ ゲスト無料期間 残り ${guestStatus.daysRemaining} / ${GUEST_YESNO_FREE_DAYS} 日、1 日 1 回。ログインで 30 ポイント贈呈 + デイリーチェックイン解放`,
                              `✨ 게스트 무료 ${guestStatus.daysRemaining} / ${GUEST_YESNO_FREE_DAYS}일 남음, 하루 1회. 로그인하면 30 포인트 증정 + 매일 출석체크 해제`
                            )
                          : null}
                  </div>
                );
              })()}

              <button
                onClick={handleDraw}
                disabled={!question.trim() || guestStatus === null}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  background: question.trim() && guestStatus !== null
                    ? "linear-gradient(135deg, #d4a855, #f0d78c)"
                    : "rgba(212,168,85,0.2)",
                  color: question.trim() && guestStatus !== null ? "#0a0a1a" : "rgba(192,192,208,0.4)",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: question.trim() && guestStatus !== null ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                  boxShadow: question.trim() && guestStatus !== null ? "0 8px 24px rgba(212,168,85,0.25)" : "none",
                }}
              >
                {guestStatus === null
                  ? t("載入中…", "Loading…", "読み込み中…", "로딩 중…")
                  : t("✦ 抽一卦", "✦ Draw One Hexagram", "✦ 一卦を引く", "✦ 한 괘 뽑기")}
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
              {/* 翻牌動畫 — 背 → 正,200×320,跟 /daily / /iching/daily 同尺寸與 timing */}
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
                  animate={{ rotateY: step === "result" ? 0 : 180 }}
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={hexImgUrl}
                          alt={t(
                            hex.nameZh,
                            hex.nameEn.split(" ")[0],
                            hex.nameJa,
                            hex.nameKo
                          )}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
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
                        <HexagramLines lines={hex.lines} revealedCount={6} />
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

      <LoginOptionsModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        title={t(
          "登入即可繼續占卜",
          "Sign in to keep going",
          "ログインで占いを続ける",
          "로그인하여 점치기 계속"
        )}
        subtitle={t(
          "🎁 首次登入贈送 30 點(夠占 6 次易經 / 塔羅、15 次每日一卡)",
          "🎁 Sign up bonus: 30 free credits (≈ 6 readings or 15 daily cards)",
          "🎁 初回ログインで 30 ポイント贈呈(易経・タロット 6 回分相当)",
          "🎁 첫 로그인 시 30 포인트 증정 (점 6회 분량)"
        )}
      />
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
