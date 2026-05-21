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
import NewCardToast from "@/components/NewCardToast";
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
  const [collectionToast, setCollectionToast] = useState<{
    show: boolean;
    isNew: boolean;
    cardName: string;
    count: number;
    rewards: number;
  }>({ show: false, isNew: true, cardName: "", count: 0, rewards: 0 });
  // phase 36:訪客 3 天免費期 banner
  const [guestStatus, setGuestStatus] = useState<{
    authenticated: boolean;
    daysRemaining: number;
    usedToday: boolean;
    limit: number;
    allowed: boolean;
  } | null>(null);
  const ranRef = useRef(false);

  const card = cardId ? tarotDeck.find((c) => c.id === cardId) : null;

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void start();
  }, []);

  async function start() {
    // phase 36:訪客也直接 fetchDaily,server 用 fingerprint 限流。banner status 併發拉。
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
      const res = await fetch("/api/daily/guest-status?kind=tarot", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setGuestStatus(data);
    } catch {
      /* banner 不關鍵 */
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
        // phase 36:訪客 3 天免費期用完才會 401
        setIsStreaming(false);
        setPhase("guest");
        void fetchGuestStatus(); // 重抓 banner 反映用盡
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
        setAiText(t(
          "AI 服務暫時無法回應,請稍後再試。",
          "AI service is temporarily unavailable.",
          "AI サービスが一時的に利用できません。",
          "AI 서비스가 일시적으로 응답하지 않습니다."
        ));
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

      // 收藏 toast — 抽到 = 跳(reread 是同日重抽,不算新抽,不顯示)
      // 新卡彈金色 toast,重複卡彈橘色「恭喜獲得」鼓勵繼續收集
      const isNewCard = res.headers.get("X-Collection-IsNew") === "1";
      const collectionCount = parseInt(res.headers.get("X-Collection-Count") ?? "0", 10);
      const rewards = parseInt(res.headers.get("X-Collection-Rewards") ?? "0", 10);
      if (cId && !isReread) {
        const drawnCard = tarotDeck.find((c) => c.id === cId);
        const cardName = drawnCard
          ? t(drawnCard.nameZh, drawnCard.nameEn, drawnCard.nameJa, drawnCard.nameKo)
          : cId;
        setCollectionToast({
          show: true,
          isNew: isNewCard,
          cardName,
          count: collectionCount,
          rewards,
        });
      }

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
      setAiText(t(
        "發生錯誤,請再試一次。",
        "Something went wrong, please retry.",
        "エラーが発生しました。もう一度お試しください。",
        "오류가 발생했습니다. 다시 시도해 주세요."
      ));
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
            {t("每日一卡", "Daily Card", "今日の一枚", "오늘의 카드")}
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            {t(
              "每天為你抽一張牌,給今天的能量一個提醒。",
              "One card a day — a reminder for today's energy."
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
                "每天 1 點(同日重抽免費)",
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
                    "(今日は既に引いています。再課金なし)",
                    "(오늘 이미 뽑았습니다. 추가 요금 없음)"
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
                    `你的訪客 ${guestStatus.limit} 天免費期已用完。登入即可繼續每日一卡,首次登入贈送 30 點 🎁`,
                    `Your ${guestStatus.limit}-day guest free trial is over. Sign in — 30 free credits on first login 🎁`,
                    `ゲスト ${guestStatus.limit} 日間の無料体験が終了。ログインで続行、初回 30 ポイント贈呈 🎁`,
                    `게스트 ${guestStatus.limit}일 무료 체험 종료. 로그인하면 계속 — 첫 로그인 30 포인트 증정 🎁`
                  )
                : guestStatus.usedToday
                  ? t(
                      `✨ 訪客今日已抽過(剩 ${guestStatus.daysRemaining} 天免費期)。登入會員贈 30 點`,
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
                {t(
                  "✦ 登入抽今日卡",
                  "✦ Sign in for today's card",
                  "✦ ログインして今日のカードを引く",
                  "✦ 로그인하여 오늘의 카드 뽑기"
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
                "正在為你抽今日卡 …",
                "Drawing your card for today …",
                "今日のカードを引いています …",
                "오늘의 카드를 뽑고 있습니다 …"
              )}
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
                  ({isReversed
                    ? t("逆位", "Reversed", "逆位置", "역방향")
                    : t("正位", "Upright", "正位置", "정방향")})
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
                {aiText ||
                  (isStreaming
                    ? t(
                        "塔羅師正在寫今日訊息…",
                        "Reader is writing today's message…",
                        "占い師が今日のメッセージを書いています…",
                        "점술사가 오늘의 메시지를 쓰고 있습니다…"
                      )
                    : "")}
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
                  {t(
                    "有具體問題?試試 Yes/No 占卜 →",
                    "Got a specific question? Try Yes/No →",
                    "具体的な質問がある? Yes/No 占いを試す →",
                    "구체적인 질문이 있나요? Yes/No 점을 시도하세요 →"
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
                    "完全な解読が見たい?メインフローへ →",
                    "완전한 해석을 보고 싶나요? 메인 플로우로 →"
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
        next="/daily"
        title={t(
          "登入即可繼續每日一卡",
          "Sign in to keep your daily card",
          "ログインで毎日のカードを継続",
          "로그인하여 매일의 카드 계속"
        )}
        subtitle={t(
          "🎁 首次登入贈送 30 點(夠占 6 次易經 / 塔羅、15 次每日一卡)",
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
        type="tarot"
        isNew={collectionToast.isNew}
        cardName={collectionToast.cardName}
        collectionCount={collectionToast.count}
        total={78}
        rewardCredits={collectionToast.rewards}
        onDismiss={() => setCollectionToast((s) => ({ ...s, show: false }))}
      />
    </main>
  );
}
