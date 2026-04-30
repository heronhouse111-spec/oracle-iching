"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import HexagramDisplay from "@/components/HexagramDisplay";
import CoinAnimation from "@/components/CoinAnimation";
import ShareCard from "@/components/ShareCard";
import { performDivination, questionCategories, type DivinationResult, type CoinThrow } from "@/lib/divination";
import { findHexagram, getHexagramByNumber, type Hexagram } from "@/data/hexagrams";
import { saveDivination, appendFollowUp } from "@/lib/saveDivination";
import {
  drawThreeCards,
  getCardById,
  THREE_CARD_POSITIONS,
  SUIT_NAMES_ZH,
  SUIT_NAMES_EN,
  SUIT_NAMES_JA,
  SUIT_NAMES_KO,
  CARD_BACK_IMAGE,
  type DrawnCard,
} from "@/data/tarot";
import {
  SPREADS,
  DEFAULT_SPREAD_ID,
  drawSpread,
  getSpread,
  spreadImageSlot,
  type Spread,
} from "@/data/spreads";
import {
  savePendingDivination,
  loadPendingDivination,
  clearPendingDivination,
  type PendingChatMessage,
} from "@/lib/pendingDivination";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import PersonaDepthPicker, { type ReadingDepth } from "@/components/PersonaDepthPicker";
import QuestionInspirations from "@/components/QuestionInspirations";
import { useUiImages } from "@/hooks/useUiImages";
import {
  DEFAULT_PERSONA_ID,
  getPersonasForSystem,
  getDefaultPersonaIdForSystem,
} from "@/lib/personas";

// Line 目前尚未在 Supabase 後台啟用(需 Pro plan + Custom OIDC),用 env 開關
const LINE_LOGIN_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_LINE_LOGIN_ENABLED === "true";

type Step =
  | "category"
  | "question"
  | "divine-type"
  | "tarot-spread-select"
  | "mode-select"
  | "divination"
  | "tarot-reveal"
  | "result";
type DivinationMode = "manual" | "auto";
type DivineType = "iching" | "tarot";

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

/**
 * 大圖 hero 卡片用的圖片區塊。
 * 沒上傳就回 null — 由外層卡片決定要怎麼呈現「無圖」狀態(目前是讓卡片少一個影像區塊,
 * 文字往上頂)。這樣可以避免「emoji 占位 → 圖片載入後 swap」的閃爍。
 */
function HeroImage({
  url,
  aspectRatio = "16/10",
}: {
  url: string | undefined;
  aspectRatio?: string;
}) {
  if (!url) return null;
  return (
    <div
      style={{
        width: "100%",
        aspectRatio,
        background:
          "linear-gradient(135deg, rgba(212,168,85,0.10), rgba(13,13,43,0.45))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

/**
 * 免費工具區塊用的小卡片 — 圖(可選)+ 標題 + 副說明 + CTA 文字。
 * 用元件包起來避免兩欄(易經 / 塔羅)各 3 張卡片的 JSX 重複 ~150 行。
 */
function FreeToolCard({
  href,
  imageUrl,
  title,
  desc,
  cta,
}: {
  href: string;
  imageUrl: string | undefined;
  title: string;
  desc: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(212,168,85,0.18)",
        background: "rgba(13,13,43,0.65)",
        display: "block",
      }}
    >
      <HeroImage url={imageUrl} />
      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ color: "#d4a855", fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>
          {title}
        </div>
        <div style={{ color: "rgba(192,192,208,0.65)", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
          {desc}
        </div>
        <div style={{ color: "#d4a855", fontSize: 12, fontWeight: 600, marginTop: 10 }}>
          {cta} →
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { locale, t } = useLanguage();
  const uiImages = useUiImages();

  const [step, setStep] = useState<Step>("category");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [userQuestion, setUserQuestion] = useState("");
  const [currentThrow, setCurrentThrow] = useState(0);
  const [throws, setThrows] = useState<CoinThrow[]>([]);
  const [currentCoins, setCurrentCoins] = useState<[number, number, number] | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [divinationResult, setDivinationResult] = useState<DivinationResult | null>(null);
  const [hexagram, setHexagram] = useState<Hexagram | null>(null);
  const [relatingHexagram, setRelatingHexagram] = useState<Hexagram | null>(null);
  const [aiReading, setAiReading] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 點數不足 modal(402 時觸發)
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // Share state(訂閱判定 + 下載狀態)
  const [isActive, setIsActive] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const shareCardRef = useRef<HTMLDivElement | null>(null);

  // v2 公開分享 state
  const [divinationId, setDivinationId] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  // 未登入訪客限 2 次占卜 — 第 3 次 handleQuestionSubmit 時彈出 modal
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  // 通用登入 modal(handleLoginForShare 等多處觸發)
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  // 占卜模式(auto/manual)+ 上次選擇(localStorage 記住)
  const [divinationMode, setDivinationMode] = useState<DivinationMode | null>(null);
  const [lastModePref, setLastModePref] = useState<DivinationMode | null>(null);

  // 占卜類型(易經 / 塔羅)
  const [divineType, setDivineType] = useState<DivineType | null>(null);

  // ── 占卜師人格 + 解讀深度 ────────────────────────────
  // localStorage 記住上次選擇 — 預設 lunar-sister + quick(免費版)。
  // 訂閱戶才能用 premium persona / deep,API route 會再驗一次,前端 picker 也會擋。
  const [personaId, setPersonaId] = useState<string>(DEFAULT_PERSONA_ID);
  const [readingDepth, setReadingDepth] = useState<ReadingDepth>("quick");

  // 塔羅 state:已選的牌陣 + 抽到的牌組 + 已翻開幾張
  // 預設沒選 — 進塔羅 step 才挑;`?spread=<id>` 也會在 mount effect 寫進來
  const [selectedSpreadId, setSelectedSpreadId] = useState<string | null>(null);
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);

  // ── 衍伸問題繼續占卜(follow-up chain) ───────────────────
  // 使用者在結果頁按「相關衍伸問題繼續占卜」→ 填新問題 → 重選易經/塔羅 → 再占一次,
  // 結束後把結果塞進 followUps[] 串起來,AI 解盤時知道「先前卦象 + 對話 + 新卦象」。
  //
  // rootSnapshot:第一次按衍伸按鈕時,把當下的 root reading 整包凍存,
  //   讓衍伸占卜結束時能把「主結果」state 回填,畫面看起來永遠是「根占卜 + 延伸鏈 + 聊天」。
  // followUps:已完成的衍伸鏈(最新的在陣列尾端)。
  const [rootSnapshot, setRootSnapshot] = useState<{
    divineType: DivineType;
    question: string;
    category: string;
    aiReading: string;
    hexagram: Hexagram | null;
    relatingHexagram: Hexagram | null;
    divinationResult: DivinationResult | null;
    drawnCards: DrawnCard[];
    /** root 塔羅占卜用的牌陣 id;易經為 null */
    spreadId: string | null;
  } | null>(null);
  const [followUps, setFollowUps] = useState<Array<{
    id: string;
    question: string;
    createdAt: string;
    divineType: DivineType;
    aiReading: string;
    // iching
    hexagram?: Hexagram | null;
    relatingHexagram?: Hexagram | null;
    primaryLines?: number[] | null;
    changingLines?: number[] | null;
    // tarot
    drawnCards?: DrawnCard[] | null;
    spreadId?: string | null;
  }>>([]);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState("");

  // 衍伸占卜完成後自動捲到新加的那筆 (第 N 次 → index N-1)。
  // 流程:success block 設 pendingScrollIdx → useEffect 等 AI/follow-up mode 都結束、
  // rootSnapshot refill、DOM 穩定後再捲。避免跟 state refill 互相競速。
  const [pendingScrollIdx, setPendingScrollIdx] = useState<number | null>(null);

  useEffect(() => {
    if (pendingScrollIdx === null) return;
    if (isLoadingAI) return;   // 還在串流
    if (isFollowUpMode) return; // 還沒 refill 完 root

    const targetIdx = pendingScrollIdx;
    let cancelled = false;
    let attempts = 0;

    // 重試機制:每幀確認目標元素已經 layout 好(有高度),才算絕對 Y 去捲
    // 用 window.scrollTo(top) 而非 scrollIntoView —— 後者動畫開始時就鎖死目標位置,
    // 元素被後來的 layout shift 推下去時動畫不會修正;scrollTo 可以每次重算
    const tryScroll = () => {
      if (cancelled) return;
      attempts++;
      const el = document.querySelector<HTMLElement>(
        `[data-followup-index="${targetIdx}"]`
      );
      if (!el) {
        if (attempts < 30) requestAnimationFrame(tryScroll);
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.height < 10 && attempts < 30) {
        requestAnimationFrame(tryScroll);
        return;
      }
      const targetY = rect.top + window.scrollY - 72; // 72 ≈ fixed header 64 + 呼吸
      window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
      setPendingScrollIdx(null);
    };

    // 400ms 初始緩衝 —— 等 root refill 的 aiReading 文字 block 都排版好
    const timer = window.setTimeout(() => {
      if (!cancelled) tryScroll();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pendingScrollIdx, isLoadingAI, isFollowUpMode]);

  // mount 時讀 localStorage 拿上次選的 mode,給 mode-select 畫面做「上次選了 X」提示
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("oracle-iching:mode");
      if (saved === "manual" || saved === "auto") {
        setLastModePref(saved);
      }
    } catch {
      // storage disabled / SSR — no-op
    }
  }, []);

  // 占卜師人格 / Deep mode — 從 localStorage 復原
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const p = window.localStorage.getItem("tarogram:persona");
      if (p) setPersonaId(p);
      const d = window.localStorage.getItem("tarogram:depth");
      if (d === "deep" || d === "quick") setReadingDepth(d);
    } catch {
      // ignore
    }
  }, []);

  // ── /?spread=<id> deep-link ───────────────────────────
  // 牌陣詳細頁的 CTA 是 `/?spread=${spread.id}`,讓使用者帶著意圖進主流程;
  // mount 時讀 query param,把 selectedSpreadId 直接寫進 state(divineType 也定為塔羅),
  // 之後 question → divine-type 走完就直接抽該牌陣,不再彈牌陣選單。
  // 為避免反覆觸發,讀完一次就把 query param 清掉。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sp = params.get("spread");
    if (!sp) return;
    if (!SPREADS.some((s) => s.id === sp)) return;
    setSelectedSpreadId(sp);
    setDivineType("tarot");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("spread");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    } catch {
      // ignore
    }
  }, []);

  // ── /?type= & /?category= deep-link ───────────────────
  // /categories 頁挑完分類後跳回 /?type=iching|tarot&category=<id>。
  // 這個 effect 把 state 寫好、step 直接跳到 "question",讓使用者從首頁無縫接到輸入問題那步。
  // 跟上面 /?spread= effect 分兩個 useEffect 是因為兩條深度連結各自獨立、可同時存在(雖少見)。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tp = params.get("type");
    const cat = params.get("category");
    if (!cat) return;
    if (!questionCategories.some((c) => c.id === cat)) return;
    setSelectedCategory(cat);
    if (tp === "iching" || tp === "tarot") setDivineType(tp);
    setStep("question");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("type");
      url.searchParams.delete("category");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    } catch {
      // ignore
    }
  }, []);

  // 切換占卜系統(易經 / 塔羅)時,若目前 persona 不在新系統的清單裡,自動切到該系統預設
  // 解決「先選塔羅人格、再切去易經,picker 找不到 active card」的情況
  useEffect(() => {
    const targetSystem: "iching" | "tarot" = divineType === "iching" ? "iching" : "tarot";
    const validIds = getPersonasForSystem(targetSystem).map((p) => p.id);
    if (!validIds.includes(personaId)) {
      setPersonaId(getDefaultPersonaIdForSystem(targetSystem));
    }
    // personaId 不放進 deps —— 否則 picker 每次改 persona 都會被這個 effect 又拉回去
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divineType]);

  /** Picker 改變時統一寫 localStorage + state */
  const handlePersonaDepthChange = useCallback(
    (p: string, d: ReadingDepth) => {
      setPersonaId(p);
      setReadingDepth(d);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("tarogram:persona", p);
          window.localStorage.setItem("tarogram:depth", d);
        }
      } catch {
        // ignore
      }
    },
    []
  );

  // Mount 時確認登入狀態(給訪客 2 次占卜 gate 使用),順便把本機 localStorage
  // 占卜紀錄一次性搬進 Supabase — 訪客登入後所有過去的占卜會自動跟雲端同步。
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        setIsSignedIn(Boolean(user));
        if (!user) return;

        // 已登入 → 把本機還留著的歷史紀錄一次性搬到 Supabase
        let stored: string | null = null;
        try {
          stored = localStorage.getItem("divination_history");
        } catch {
          return;
        }
        if (!stored) return;
        let records: unknown;
        try {
          records = JSON.parse(stored);
        } catch {
          return;
        }
        if (!Array.isArray(records) || records.length === 0) return;

        // 只留合法欄位,攤平成 divinations 欄位。舊紀錄可能沒 divine_type → 預設 iching。
        type LocalRecord = {
          id?: string;
          question?: string;
          category?: string;
          ai_reading?: string;
          locale?: string;
          divine_type?: "iching" | "tarot";
          hexagram_number?: number | null;
          primary_lines?: number[] | null;
          changing_lines?: number[] | null;
          relating_hexagram_number?: number | null;
          tarot_cards?: unknown;
          created_at?: string;
        };
        const toInsert = (records as LocalRecord[])
          .filter((r) => r && typeof r.id === "string" && typeof r.question === "string")
          .map((r) => {
            const divineType = r.divine_type ?? "iching";
            return {
              id: r.id,
              user_id: user.id,
              question: r.question,
              category: r.category ?? "general",
              ai_reading: r.ai_reading ?? null,
              locale: r.locale ?? "zh",
              divine_type: divineType,
              hexagram_number:
                divineType === "iching" ? r.hexagram_number ?? null : null,
              primary_lines:
                divineType === "iching" ? r.primary_lines ?? null : null,
              changing_lines:
                divineType === "iching" ? r.changing_lines ?? null : null,
              relating_hexagram_number:
                divineType === "iching"
                  ? r.relating_hexagram_number ?? null
                  : null,
              tarot_cards: divineType === "tarot" ? r.tarot_cards ?? null : null,
              created_at: r.created_at ?? new Date().toISOString(),
            };
          });
        if (toInsert.length === 0) return;

        const { error } = await supabase
          .from("divinations")
          .upsert(toInsert, { onConflict: "id", ignoreDuplicates: true });

        if (!error) {
          // 搬家成功 → 清本機,後面紀錄都會直接進 Supabase
          try {
            localStorage.removeItem("divination_history");
          } catch {
            /* localStorage 壞掉就不處理 */
          }
        } else {
          console.error("本機占卜紀錄搬家失敗:", error);
        }
      } catch (e) {
        console.error("登入狀態/搬家流程錯誤:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 拿登入者訂閱狀態 — 只要走進結果頁就跑一次
  useEffect(() => {
    if (step !== "result") return;
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        setIsSignedIn(Boolean(user));
        if (!user) return;
        const { data } = await supabase
          .from("user_subscription_summary")
          .select("is_active")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) setIsActive(Boolean(data?.is_active));
      } catch (e) {
        console.error("訂閱狀態查詢失敗:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  // ── 訪客登入前的結果快照(sessionStorage) ─────────────
  // 訪客占卜完按「登入」→ OAuth 把整頁清光,回來 mount 時讀這份 snapshot 把
  // 結果頁整包復原,並在使用者已登入時補存 Supabase 讓分享連結可用。
  //
  // skipSnapshotSaveRef:mount 復原時會 setStep("result"),緊接著這個 effect 會
  // 被觸發 → 把剛復原的 state 再寫回 sessionStorage → 下次進首頁又撈到舊 snapshot,
  // 使用者永遠跳不回占卜選單。用這個 ref 吞掉復原後的第一次寫入。
  const skipSnapshotSaveRef = useRef(false);

  useEffect(() => {
    if (skipSnapshotSaveRef.current) {
      skipSnapshotSaveRef.current = false;
      return;
    }
    // 已登入的人紀錄直接進 Supabase,不需要 snapshot;而且如果繼續寫,
    // 後面導回 "/" 又會被 mount effect 撿到,變成永遠顯示上一筆占卜。
    if (isSignedIn) return;
    if (step !== "result") return;
    if (isLoadingAI) return; // 串流中不寫,避免存到半截
    if (isChatLoading) return; // chat 串流中也不寫,等串流結束 isChatLoading 變 false 時再寫完整版
    if (!aiReading) return;

    // 把訪客跟老師的對話一併寫進 snapshot — 登入後要一起復原,
    // 不然使用者會覺得剛剛那段對話「登入後就消失了」。
    const chatForSnap: PendingChatMessage[] = chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (divineType === "tarot") {
      const spread = getSpread(selectedSpreadId ?? DEFAULT_SPREAD_ID);
      if (drawnCards.length !== spread.cardCount) return;
      savePendingDivination({
        v: 1,
        timestamp: Date.now(),
        divineType: "tarot",
        selectedCategory,
        userQuestion,
        aiReading,
        locale,
        iching: null,
        tarot: drawnCards.map((d) => ({
          cardId: d.card.id,
          isReversed: d.isReversed,
        })),
        tarotSpreadId: spread.id,
        chatMessages: chatForSnap,
      });
    } else if (divineType === "iching") {
      if (!hexagram || !divinationResult) return;
      savePendingDivination({
        v: 1,
        timestamp: Date.now(),
        divineType: "iching",
        selectedCategory,
        userQuestion,
        aiReading,
        locale,
        iching: {
          hexagramNumber: hexagram.number,
          primaryLines: divinationResult.primaryLines,
          changingLines: divinationResult.changingLines,
          relatingLines: divinationResult.relatingLines,
          relatingHexagramNumber: relatingHexagram?.number ?? null,
        },
        tarot: null,
        chatMessages: chatForSnap,
      });
    }
  }, [
    step,
    isLoadingAI,
    isChatLoading,
    aiReading,
    divineType,
    drawnCards,
    hexagram,
    relatingHexagram,
    divinationResult,
    selectedCategory,
    selectedSpreadId,
    userQuestion,
    locale,
    isSignedIn,
    chatMessages,
  ]);

  // mount 時:若有暫存占卜就復原;若現在已登入,順便補存 Supabase 拿 id
  useEffect(() => {
    const snap = loadPendingDivination();
    if (!snap) return;
    // 先清掉 key,避免 re-render / HMR 重複觸發
    clearPendingDivination();

    setSelectedCategory(snap.selectedCategory);
    setUserQuestion(snap.userQuestion);
    setAiReading(snap.aiReading);
    setDivineType(snap.divineType);

    // 訪客登入前跟老師的對話一併還原(沒有就當空白)
    if (snap.chatMessages && snap.chatMessages.length > 0) {
      setChatMessages(
        snap.chatMessages.map((m) => ({ role: m.role, content: m.content }))
      );
    }

    if (snap.divineType === "iching" && snap.iching) {
      const hex = getHexagramByNumber(snap.iching.hexagramNumber) ?? null;
      const relHex =
        snap.iching.relatingHexagramNumber !== null
          ? getHexagramByNumber(snap.iching.relatingHexagramNumber) ?? null
          : null;
      setHexagram(hex);
      setRelatingHexagram(relHex);
      setDivinationResult({
        // throws 在結果頁不再渲染,給空陣列即可
        throws: [],
        primaryLines: snap.iching.primaryLines,
        changingLines: snap.iching.changingLines,
        relatingLines: snap.iching.relatingLines,
      });
    } else if (snap.divineType === "tarot" && snap.tarot) {
      const spreadId = snap.tarotSpreadId ?? DEFAULT_SPREAD_ID;
      const spread = getSpread(spreadId);
      setSelectedSpreadId(spread.id);
      const cards: DrawnCard[] = snap.tarot
        .map((tc) => {
          const card = getCardById(tc.cardId);
          return card ? { card, isReversed: tc.isReversed } : null;
        })
        .filter((x): x is DrawnCard => x !== null);
      if (cards.length === spread.cardCount) {
        setDrawnCards(cards);
        setRevealedCount(spread.cardCount);
      }
    }

    setStep("result");
    // 緊接著 save-snapshot effect 會被 step="result" 觸發;但我們剛從 snapshot
    // 復原,沒必要再寫回去(且若登入狀態還沒載完,isSignedIn 仍是 false 會穿透防護)。
    skipSnapshotSaveRef.current = true;

    // 若使用者現在已登入,補存 Supabase 以便開分享連結
    if (!isSupabaseConfigured) return;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return; // 還沒登入就算了,使用者可以再按一次「登入」

        const snapSpread = getSpread(snap.tarotSpreadId ?? DEFAULT_SPREAD_ID);
        const saved =
          snap.divineType === "tarot" && snap.tarot
            ? await saveDivination({
                divineType: "tarot",
                question: snap.userQuestion,
                category: snap.selectedCategory,
                spreadId: snapSpread.id,
                tarotCards: snap.tarot.map((tc, i) => ({
                  cardId: tc.cardId,
                  // 快照裡沒存 position 列表 — 用順序對應 spread.positions[i].key
                  position: snapSpread.positions[i]?.key ?? snapSpread.positions[0].key,
                  isReversed: tc.isReversed,
                })),
                aiReading: snap.aiReading,
                locale: snap.locale,
              })
            : snap.divineType === "iching" && snap.iching
            ? await saveDivination({
                divineType: "iching",
                question: snap.userQuestion,
                category: snap.selectedCategory,
                hexagramNumber: snap.iching.hexagramNumber,
                primaryLines: snap.iching.primaryLines,
                changingLines: snap.iching.changingLines,
                relatingHexagramNumber: snap.iching.relatingHexagramNumber,
                aiReading: snap.aiReading,
                locale: snap.locale,
              })
            : null;
        if (saved?.id) setDivinationId(saved.id);
      } catch (e) {
        console.error("登入後補存占卜失敗:", e);
      }
    })();
    // 只在 mount 跑一次;其餘 dependencies 無關(snapshot 是過去的 state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resume from history: /?resume=<divinationId> ─────────────────
  // /history 按「繼續對話/衍伸 →」帶使用者回首頁並帶 resume=<id> 參數,
  // 這個 effect 負責:撈出該筆占卜(含 follow_ups + chat_messages),整頁 hydrate
  // 成結果頁,再捲到聊天框讓訂閱者可以從過去任一筆繼續對話或衍伸占卜。
  //
  // 跟 pending-divination snapshot(訪客登入前佔卜)不一樣:這個走 Supabase 撈,
  // 訪客不會有;而且必須是 owner 才能 hydrate(RLS 也會擋,但多一層 TS 防護)。
  // 若同時有 pending snapshot(登入剛回來)則那個 effect 優先,這邊跳過。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("resume");
    if (!resumeId) return;
    if (!isSupabaseConfigured) return;
    // 有 pending snapshot(訪客登入流程)→ 讓上面那個 effect 處理,不跟它打架
    try {
      if (window.sessionStorage.getItem("oracle:pending-divination")) return;
    } catch {
      // sessionStorage 被擋也沒關係,繼續跑
    }

    let cancelled = false;

    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) return; // 未登入就不 resume(history 按鈕也只會對訂閱者顯示)

        const { data: row, error } = await supabase
          .from("divinations")
          .select(
            "id, question, category, divine_type, hexagram_number, primary_lines, changing_lines, relating_hexagram_number, tarot_cards, tarot_spread_id, ai_reading, follow_ups, chat_messages, user_id"
          )
          .eq("id", resumeId)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error("resume: fetch failed", error);
          return;
        }
        if (!row) return;
        // 保險絲:RLS 會擋別人的 row,但多一層 TS 檢查
        if (row.user_id !== user.id) return;

        const dt: DivineType = row.divine_type === "tarot" ? "tarot" : "iching";

        setDivineType(dt);
        setSelectedCategory(row.category ?? "");
        setUserQuestion(row.question ?? "");
        setAiReading(row.ai_reading ?? "");
        setDivinationId(row.id);
        setIsSignedIn(true);

        if (dt === "iching" && typeof row.hexagram_number === "number") {
          const hex = getHexagramByNumber(row.hexagram_number) ?? null;
          const primaryLines: number[] = Array.isArray(row.primary_lines)
            ? (row.primary_lines as number[])
            : [];
          const changingLines: number[] = Array.isArray(row.changing_lines)
            ? (row.changing_lines as number[])
            : [];
          // relatingLines 從 primary + changing 反算(DB 只存了 relating_hexagram_number)
          const relatingLines =
            changingLines.length > 0
              ? primaryLines.map((line, i) =>
                  changingLines.includes(i) ? (line === 1 ? 0 : 1) : line
                )
              : null;
          const relHex =
            typeof row.relating_hexagram_number === "number"
              ? getHexagramByNumber(row.relating_hexagram_number) ?? null
              : relatingLines
              ? findHexagram(relatingLines) ?? null
              : null;
          setHexagram(hex);
          setRelatingHexagram(relHex);
          setDivinationResult({
            throws: [],
            primaryLines,
            changingLines,
            relatingLines,
          });
        } else if (dt === "tarot" && Array.isArray(row.tarot_cards)) {
          type RawTarotCard = { cardId: string; isReversed: boolean };
          const spreadId =
            typeof row.tarot_spread_id === "string" && row.tarot_spread_id
              ? row.tarot_spread_id
              : DEFAULT_SPREAD_ID;
          const spread = getSpread(spreadId);
          setSelectedSpreadId(spread.id);
          const cards: DrawnCard[] = (row.tarot_cards as RawTarotCard[])
            .map((tc) => {
              const card = getCardById(tc.cardId);
              return card ? { card, isReversed: tc.isReversed } : null;
            })
            .filter((x): x is DrawnCard => x !== null);
          if (cards.length === spread.cardCount) {
            setDrawnCards(cards);
            setRevealedCount(spread.cardCount);
          }
        }

        // follow_ups: DB 存 hexagramNumber / tarotCards,前端 state 要 Hexagram / DrawnCard
        type RawFollowUp = {
          id: string;
          question: string;
          createdAt: string;
          divineType: "iching" | "tarot";
          aiReading: string;
          hexagramNumber?: number | null;
          primaryLines?: number[] | null;
          changingLines?: number[] | null;
          relatingHexagramNumber?: number | null;
          tarotCards?: { cardId: string; isReversed: boolean }[] | null;
          /** Phase 12 後 tarot follow-up 才開始寫,舊資料無 → default 'three-card' */
          spreadId?: string | null;
        };
        const rawFollowUps: RawFollowUp[] = Array.isArray(row.follow_ups)
          ? (row.follow_ups as RawFollowUp[])
          : [];
        const hydratedFollowUps = rawFollowUps
          .map((f) => {
            if (f.divineType === "iching" && typeof f.hexagramNumber === "number") {
              const hx = getHexagramByNumber(f.hexagramNumber) ?? null;
              const relHx =
                typeof f.relatingHexagramNumber === "number"
                  ? getHexagramByNumber(f.relatingHexagramNumber) ?? null
                  : null;
              return {
                id: f.id,
                question: f.question,
                createdAt: f.createdAt,
                divineType: "iching" as const,
                aiReading: f.aiReading,
                hexagram: hx,
                relatingHexagram: relHx,
                primaryLines: f.primaryLines ?? null,
                changingLines: f.changingLines ?? null,
              };
            }
            if (f.divineType === "tarot" && Array.isArray(f.tarotCards)) {
              const cards: DrawnCard[] = f.tarotCards
                .map((tc) => {
                  const card = getCardById(tc.cardId);
                  return card ? { card, isReversed: tc.isReversed } : null;
                })
                .filter((x): x is DrawnCard => x !== null);
              return {
                id: f.id,
                question: f.question,
                createdAt: f.createdAt,
                divineType: "tarot" as const,
                aiReading: f.aiReading,
                drawnCards: cards,
                spreadId: f.spreadId ?? DEFAULT_SPREAD_ID,
              };
            }
            return null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        setFollowUps(hydratedFollowUps);

        // chat_messages hydrate(擋掉格式不合的,避免 render 爆掉)
        type RawChatMsg = { role?: string; content?: string };
        const rawChat: RawChatMsg[] = Array.isArray(row.chat_messages)
          ? (row.chat_messages as RawChatMsg[])
          : [];
        const hydratedChat = rawChat
          .filter(
            (m): m is { role: "user" | "assistant"; content: string } =>
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .map((m) => ({ role: m.role, content: m.content }));
        setChatMessages(hydratedChat);

        setStep("result");
        // 結果頁的 save-snapshot effect 會觸發,但我們剛從 DB hydrate,
        // 不需要再寫 sessionStorage(訪客流程才需要)。用這個 ref 吞掉第一次寫入。
        skipSnapshotSaveRef.current = true;

        // URL 清掉 resume 參數,refresh 不再重複撈
        const url = new URL(window.location.href);
        url.searchParams.delete("resume");
        window.history.replaceState({}, "", url.pathname + (url.search || ""));

        // 稍等 DOM 排版完再捲到聊天框 — 類似 pendingScrollIdx 的做法
        window.setTimeout(() => {
          if (cancelled) return;
          const el = document.querySelector<HTMLElement>("[data-chat-box]");
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const targetY = rect.top + window.scrollY - 72;
          window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
        }, 500);
      } catch (e) {
        console.error("resume: unexpected error", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // 只在 mount 跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 訪客從結果頁直接按「登入」→ snapshot 已經被上面的 effect 寫入 sessionStorage,
  // 登入 modal 打開 → 使用者選 provider → OAuth / magic link → callback 回首頁 → mount effect 撿 snapshot 復原。
  const handleLoginForShare = () => {
    if (!isSupabaseConfigured) return;
    setLoginModalOpen(true);
  };

  const handleTogglePublic = async () => {
    if (!divinationId || !isSignedIn || isTogglingPublic) return;
    setIsTogglingPublic(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const next = !isPublic;
      const { error } = await supabase
        .from("divinations")
        .update({ is_public: next })
        .eq("id", divinationId);
      if (error) throw error;
      setIsPublic(next);
    } catch (e) {
      console.error("公開狀態切換失敗:", e);
      setShareMessage(
        t(
          "切換失敗,請稍候再試",
          "Toggle failed, please try again",
          "切り替えに失敗しました。後ほど再度お試しください",
          "전환 실패. 잠시 후 다시 시도해 주세요"
        )
      );
      setTimeout(() => setShareMessage(null), 3000);
    } finally {
      setIsTogglingPublic(false);
    }
  };

  const handleCopyLink = async () => {
    if (!divinationId) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/r/${divinationId}`
        : `/r/${divinationId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (e) {
      console.error("複製失敗:", e);
      setShareMessage(t("複製失敗", "Copy failed", "コピー失敗", "복사 실패"));
      setTimeout(() => setShareMessage(null), 3000);
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    // 易經需 hexagram + divinationResult;塔羅需 spread.cardCount 張牌
    if (divineType === "tarot") {
      const spread = getSpread(selectedSpreadId ?? DEFAULT_SPREAD_ID);
      if (drawnCards.length !== spread.cardCount) return;
    } else {
      if (!hexagram || !divinationResult) return;
    }
    setIsSharing(true);
    setShareMessage(null);
    try {
      const { toPng } = await import("html-to-image");
      // 等一個 animation frame 確保 ShareCard 已經 mount 進 DOM
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const node = shareCardRef.current;
      if (!node) throw new Error("ShareCard not mounted");
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        width: 1080,
        height: 1350,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      const ts = new Date().toISOString().slice(0, 10);
      const filePrefix =
        divineType === "tarot"
          ? `oracle-tarot-${ts}`
          : `oracle-iching-${hexagram?.number ?? "x"}-${ts}`;
      link.download = `${filePrefix}.png`;
      link.click();
      setShareMessage(
        t(
          "分享圖已下載 ✨",
          "Share image downloaded ✨",
          "共有画像をダウンロードしました ✨",
          "공유 이미지가 다운로드되었습니다 ✨"
        )
      );
    } catch (e) {
      console.error("下載分享圖失敗:", e);
      setShareMessage(
        t(
          "下載失敗,請再試一次",
          "Download failed, please try again",
          "ダウンロードに失敗しました。再度お試しください",
          "다운로드 실패. 다시 시도해 주세요"
        )
      );
    } finally {
      setIsSharing(false);
      setTimeout(() => setShareMessage(null), 4000);
    }
  };

  // ── 衍伸占卜:把目前的 root reading 整包凍存,清空 transient state,進入選擇占卜工具畫面
  // 前置條件:必須已登入且 divinationId 存在(未登入的按鈕會走 handleLoginForShare)。
  const handleStartFollowUp = () => {
    if (!isSignedIn || !divinationId) return;
    const q = followUpQuestion.trim();
    if (!q) return;
    if (isLoadingAI || isChatLoading) return;

    // 第一次發起衍伸時才凍存 root;後續衍伸時 rootSnapshot 已經在了,不要蓋掉
    if (!rootSnapshot) {
      if (!divineType) return; // 防禦
      setRootSnapshot({
        divineType,
        question: userQuestion,
        category: selectedCategory,
        aiReading,
        hexagram,
        relatingHexagram,
        divinationResult,
        drawnCards: [...drawnCards],
        spreadId: divineType === "tarot" ? selectedSpreadId ?? DEFAULT_SPREAD_ID : null,
      });
    }

    // 切換到「這一輪衍伸」的 transient state:新問題會成為下次 fetchAIReading/
    // fetchTarotReading 用的 userQuestion,清空易經/塔羅的占卜暫存。
    setUserQuestion(q);
    setAiReading("");
    setHexagram(null);
    setRelatingHexagram(null);
    setDivinationResult(null);
    setDrawnCards([]);
    setRevealedCount(0);
    setThrows([]);
    setCurrentThrow(0);
    setCurrentCoins(null);
    setDivineType(null);
    // 注意:chatMessages 故意保留 — 衍伸占卜 AI 要看到先前對話

    setIsFollowUpMode(true);
    setShowFollowUpForm(false);
    setFollowUpQuestion("");
    setStep("divine-type");
  };

  const handleCancelFollowUpForm = () => {
    setShowFollowUpForm(false);
    setFollowUpQuestion("");
  };

  // 組 previousContext:給衍伸占卜 AI 的「先前情境」— root + 已完成的所有衍伸
  // 讓 AI 知道「我們之前是看什麼卦、抽什麼牌、聊過什麼」,新占卜才能做連貫銜接。
  const buildPreviousContext = useCallback((): string => {
    if (!rootSnapshot) return "";

    const describeIching = (
      label: string,
      hex: Hexagram | null,
      relHex: Hexagram | null,
      changing: number[] | null | undefined,
      reading: string
    ) => {
      if (!hex) return "";
      const name = t(hex.nameZh, hex.nameEn, hex.nameJa, hex.nameKo);
      // 卦辭原文跨語系統一給 AI 古漢語(原典),不替換成現代訳 — AI 自己知道怎麼處理
      const judgment = hex.judgmentZh;
      const rel = relHex
        ? `${t("之卦", "Relating", "之卦", "지괘")}: ${relHex.number} ${t(relHex.nameZh, relHex.nameEn, relHex.nameJa, relHex.nameKo)}`
        : "";
      const cl = changing && changing.length > 0
        ? `${t("變爻", "Changing lines", "変爻", "변효")}: ${changing.map((l) => l + 1).join(t("、", ", ", "、", ", "))}`
        : t("無變爻", "No changing lines", "変爻なし", "변효 없음");
      return `【${label}】${t("易經", "I Ching", "易経", "주역")} | ${t("第", "#", "第", "제")}${hex.number} ${name} | ${judgment} | ${cl}${rel ? " | " + rel : ""}\n${t("當時老師的解盤", "Prior reading", "当時の解読", "당시의 해석")}: ${reading}`;
    };

    const describeTarot = (
      label: string,
      cards: DrawnCard[],
      reading: string,
      spreadId: string | null | undefined
    ) => {
      if (!cards || cards.length === 0) return "";
      const spread = getSpread(spreadId ?? DEFAULT_SPREAD_ID);
      if (cards.length !== spread.cardCount) return "";
      const parts = cards.map((d, i) => {
        const pos = spread.positions[i];
        const nm = t(d.card.nameZh, d.card.nameEn, d.card.nameJa, d.card.nameKo);
        const ori = d.isReversed
          ? t("逆位", "Reversed", "逆位置", "역방향")
          : t("正位", "Upright", "正位置", "정방향");
        const lbl = t(pos.labelZh, pos.labelEn, pos.labelJa, pos.labelKo);
        return `${lbl}=${nm}(${ori})`;
      }).join(" / ");
      const spreadLabel = t(spread.nameZh, spread.nameEn, spread.nameJa, spread.nameKo);
      return `【${label}】${t("塔羅", "Tarot", "タロット", "타로")} ${spreadLabel} | ${parts}\n${t("當時老師的解盤", "Prior reading", "当時の解読", "당시의 해석")}: ${reading}`;
    };

    const rootLabel = t("原始占卜", "Original reading", "元の占い", "원래 점");
    const rootQ = `${t("原始問題", "Original question", "元の質問", "원래 질문")}: ${rootSnapshot.question}`;
    const rootBlock = rootSnapshot.divineType === "iching"
      ? describeIching(
          rootLabel,
          rootSnapshot.hexagram,
          rootSnapshot.relatingHexagram,
          rootSnapshot.divinationResult?.changingLines,
          rootSnapshot.aiReading
        )
      : describeTarot(rootLabel, rootSnapshot.drawnCards, rootSnapshot.aiReading, rootSnapshot.spreadId);

    const followBlocks = followUps.map((f, i) => {
      const label = t(
        `延伸第${i + 1}回合`,
        `Follow-up #${i + 1}`,
        `フォローアップ #${i + 1}`,
        `후속 #${i + 1}`
      );
      const q = `${t("當時問題", "Question", "当時の質問", "당시의 질문")}: ${f.question}`;
      const body = f.divineType === "iching"
        ? describeIching(label, f.hexagram ?? null, f.relatingHexagram ?? null, f.changingLines, f.aiReading)
        : describeTarot(label, f.drawnCards ?? [], f.aiReading, f.spreadId);
      return `${q}\n${body}`;
    });

    return [rootQ, rootBlock, ...followBlocks].filter(Boolean).join("\n\n");
  }, [rootSnapshot, followUps, t]);

  const handleQuestionSubmit = () => {
    // 訪客限 2 次占卜 — 第 3 次觸發登入 gate。
    // localStorage 壞掉就放行,不要因為讀不到 storage 把使用者卡住。
    if (isSupabaseConfigured && !isSignedIn) {
      try {
        const stored = localStorage.getItem("divination_history");
        if (stored) {
          const arr = JSON.parse(stored);
          if (Array.isArray(arr) && arr.length >= 2) {
            setGuestGateOpen(true);
            return;
          }
        }
      } catch {
        /* localStorage 讀取失敗就當作還沒占過,放行 */
      }
    }
    setCurrentThrow(0);
    setThrows([]);
    setCurrentCoins(null);
    setRevealedCount(0);

    if (divineType === "iching") {
      setDrawnCards([]);
      setStep("mode-select");
    } else if (divineType === "tarot") {
      // 已從 ?spread=<id> 預選好就直接抽該牌陣;否則進牌陣選單
      if (selectedSpreadId) {
        const spread = getSpread(selectedSpreadId);
        setDrawnCards(drawSpread(spread));
        setStep("tarot-reveal");
      } else {
        setDrawnCards([]);
        setStep("tarot-spread-select");
      }
    } else {
      setDrawnCards([]);
      setStep("divine-type");
    }
  };

  const handleDivineTypeSelect = (type: DivineType) => {
    setDivineType(type);
    if (type === "iching") {
      setStep("mode-select");
    } else if (selectedSpreadId) {
      // 已預選 spread(?spread= deep link 或衍伸佔卜回頭再來一次)→ 直接抽
      const spread = getSpread(selectedSpreadId);
      setDrawnCards(drawSpread(spread));
      setRevealedCount(0);
      setStep("tarot-reveal");
    } else {
      // 還沒選 spread → 進牌陣選單
      setStep("tarot-spread-select");
    }
  };

  /** 從 tarot-spread-select 步驟挑一個牌陣 → 立刻洗牌進翻牌畫面 */
  const handleSelectSpread = (spreadId: string) => {
    const spread = getSpread(spreadId);
    setSelectedSpreadId(spread.id);
    setDrawnCards(drawSpread(spread));
    setRevealedCount(0);
    setStep("tarot-reveal");
  };

  const handleRevealCard = (idx: number) => {
    // 只能依序翻開(0 → 1 → 2),防止點錯順序
    if (idx !== revealedCount) return;
    setRevealedCount((n) => n + 1);
  };

  const handleModeSelect = (mode: DivinationMode) => {
    setDivinationMode(mode);
    setLastModePref(mode);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("oracle-iching:mode", mode);
      }
    } catch {
      // storage disabled — ignore
    }
    setStep("divination");
  };

  const handleThrowCoins = useCallback((fast = false) => {
    if (isFlipping) return;
    setIsFlipping(true);
    setCurrentCoins(null);

    const result = performDivination();
    const thisThrow = result.throws[currentThrow];

    // fast = 自動模式,每爻 ~500ms;手動模式保留 1400ms 的儀式感
    const flipDelay = fast ? 500 : 1400;
    const finishDelay = fast ? 700 : 1500;

    setTimeout(() => {
      setCurrentCoins(thisThrow.coins);
      setIsFlipping(false);

      const newThrows = [...throws, thisThrow];
      setThrows(newThrows);

      if (currentThrow >= 5) {
        const fullResult: DivinationResult = {
          throws: newThrows,
          primaryLines: newThrows.map((t) => t.lineValue),
          changingLines: newThrows.map((t, i) => (t.isChanging ? i : -1)).filter((i) => i !== -1),
          relatingLines: null,
        };
        if (fullResult.changingLines.length > 0) {
          fullResult.relatingLines = fullResult.primaryLines.map((line, i) =>
            fullResult.changingLines.includes(i) ? (line === 1 ? 0 : 1) : line
          );
        }

        setDivinationResult(fullResult);
        const foundHex = findHexagram(fullResult.primaryLines);
        setHexagram(foundHex || null);
        if (fullResult.relatingLines) {
          setRelatingHexagram(findHexagram(fullResult.relatingLines) || null);
        }

        setTimeout(() => {
          setStep("result");
          fetchAIReading(fullResult, foundHex || null);
        }, finishDelay);
      } else {
        setCurrentThrow(currentThrow + 1);
      }
    }, flipDelay);
  }, [currentThrow, isFlipping, throws]);

  // 自動模式 cascade:step=divination && mode=auto 時連續 trigger 下一爻,每爻之間 ~250ms 間隔
  useEffect(() => {
    if (step !== "divination") return;
    if (divinationMode !== "auto") return;
    if (isFlipping) return;
    if (throws.length >= 6) return;
    if (currentThrow > 5) return;
    // 第一爻前稍微多等一下讓 UI 進場,後續爻之間短間隔
    const pause = throws.length === 0 ? 400 : 250;
    const timer = setTimeout(() => handleThrowCoins(true), pause);
    return () => clearTimeout(timer);
  }, [step, divinationMode, isFlipping, currentThrow, throws.length, handleThrowCoins]);

  const fetchAIReading = async (result: DivinationResult, hex: Hexagram | null) => {
    if (!hex) return;

    // Abort any previous in-flight request to prevent interleaved text
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingAI(true);
    setAiReading("");

    // 衍伸占卜:附上「先前情境」+「先前對話」讓 AI 做連貫銜接(不是重頭敘述一卦)
    const followUpCtx = isFollowUpMode ? buildPreviousContext() : null;
    const followUpChat = isFollowUpMode ? chatMessages : null;

    try {
      const category = questionCategories.find((c) => c.id === selectedCategory);
      const relHex = result.relatingLines ? findHexagram(result.relatingLines) : null;

      const response = await fetch("/api/divine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hexagramNumber: hex.number,
          hexagramName: t(hex.nameZh, hex.nameEn, hex.nameJa, hex.nameKo),
          changingLines: result.changingLines,
          relatingHexagramNumber: relHex?.number,
          question: userQuestion,
          category: category
            ? t(category.promptHintZh, category.promptHintEn, category.promptHintJa, category.promptHintKo)
            : "",
          locale,
          previousContext: followUpCtx,
          chatHistory: followUpChat,
          personaId,
          depth: readingDepth,
        }),
        signal: controller.signal,
      });

      // 402 點數不足 → 彈升級 modal,中止後續 streaming
      const creditsErr = await parseInsufficientCredits(response);
      if (creditsErr) {
        setCreditsModal({ open: true, required: creditsErr.required });
        setAiReading("");
        return;
      }

      if (!response.ok) throw new Error("API error");

      // 扣點已經發生 —— 通知 Badge 更新
      notifyCreditsChanged();

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setAiReading(fullText);
        }
      }

      if (!controller.signal.aborted) {
        if (isFollowUpMode && divinationId) {
          // 衍伸占卜:不新開 divination row,改把這筆塞進根 divination 的 follow_ups 陣列
          await appendFollowUp(divinationId, {
            divineType: "iching",
            question: userQuestion,
            hexagramNumber: hex.number,
            primaryLines: result.primaryLines,
            changingLines: result.changingLines,
            relatingHexagramNumber: relHex?.number ?? null,
            aiReading: fullText,
          });

          // UI state:把這筆衍伸結果 append 進 followUps[],然後把主 state 回填 root
          // 先算出新 index(= 目前長度,因為還沒 append),等下用來設 scroll target
          const newIdx = followUps.length;
          setFollowUps((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              question: userQuestion,
              createdAt: new Date().toISOString(),
              divineType: "iching",
              aiReading: fullText,
              hexagram: hex,
              relatingHexagram: relHex ?? null,
              primaryLines: result.primaryLines,
              changingLines: result.changingLines,
            },
          ]);

          // 回填 root:讓結果頁永遠呈現「根占卜 + 延伸鏈 + 聊天」的樣子
          if (rootSnapshot) {
            setDivineType(rootSnapshot.divineType);
            setUserQuestion(rootSnapshot.question);
            setSelectedCategory(rootSnapshot.category);
            setAiReading(rootSnapshot.aiReading);
            setHexagram(rootSnapshot.hexagram);
            setRelatingHexagram(rootSnapshot.relatingHexagram);
            setDivinationResult(rootSnapshot.divinationResult);
            setDrawnCards(rootSnapshot.drawnCards);
            setSelectedSpreadId(rootSnapshot.spreadId);
          }
          setIsFollowUpMode(false);
          setPendingScrollIdx(newIdx); // 觸發自動捲到這筆新加的衍伸
        } else {
          const saved = await saveDivination({
            divineType: "iching",
            question: userQuestion,
            category: selectedCategory,
            hexagramNumber: hex.number,
            primaryLines: result.primaryLines,
            changingLines: result.changingLines,
            relatingHexagramNumber: relHex?.number ?? null,
            aiReading: fullText,
            locale,
          });
          if (saved?.id) setDivinationId(saved.id);
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setAiReading(
        t("抱歉，AI 解讀暫時無法使用。請確認 API 金鑰已設定。",
          "Sorry, AI reading is temporarily unavailable. Please check your API key.")
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingAI(false);
      }
    }
  };

  // 塔羅版 AI 解讀 — 打 /api/tarot,streaming 跟 fetchAIReading 同一套邏輯
  // Phase A 先不存 Supabase(等 Phase B)
  const fetchTarotReading = async (cards: DrawnCard[]) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingAI(true);
    setAiReading("");

    // 衍伸占卜(同一套機制)
    const followUpCtx = isFollowUpMode ? buildPreviousContext() : null;
    const followUpChat = isFollowUpMode ? chatMessages : null;

    try {
      const category = questionCategories.find((c) => c.id === selectedCategory);
      const spread = getSpread(selectedSpreadId ?? DEFAULT_SPREAD_ID);
      const payload = {
        cards: cards.map((d, i) => ({
          cardId: d.card.id,
          position: spread.positions[i].key,
          isReversed: d.isReversed,
        })),
        question: userQuestion,
        category: category
          ? t(category.promptHintZh, category.promptHintEn, category.promptHintJa, category.promptHintKo)
          : "",
        locale,
        previousContext: followUpCtx,
        chatHistory: followUpChat,
        spreadId: spread.id,
        personaId,
        depth: readingDepth,
      };

      const response = await fetch("/api/tarot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // 402 點數不足 → 彈升級 modal,中止後續 streaming
      const creditsErr = await parseInsufficientCredits(response);
      if (creditsErr) {
        setCreditsModal({ open: true, required: creditsErr.required });
        setAiReading("");
        return;
      }

      if (!response.ok) throw new Error("API error");

      // 扣點已經發生 —— 通知 Badge 更新
      notifyCreditsChanged();

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setAiReading(fullText);
        }
      }

      if (!controller.signal.aborted) {
        if (isFollowUpMode && divinationId) {
          await appendFollowUp(divinationId, {
            divineType: "tarot",
            question: userQuestion,
            spreadId: spread.id,
            tarotCards: cards.map((d, i) => ({
              cardId: d.card.id,
              position: spread.positions[i].key,
              isReversed: d.isReversed,
            })),
            aiReading: fullText,
          });

          const newIdx = followUps.length; // 新 index = 還沒 append 時的長度
          setFollowUps((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              question: userQuestion,
              createdAt: new Date().toISOString(),
              divineType: "tarot",
              aiReading: fullText,
              drawnCards: cards,
              spreadId: spread.id,
            },
          ]);

          // 回填 root(包含 root 牌陣 id,讓結果頁顯示原始牌陣的位置標籤)
          if (rootSnapshot) {
            setDivineType(rootSnapshot.divineType);
            setUserQuestion(rootSnapshot.question);
            setSelectedCategory(rootSnapshot.category);
            setAiReading(rootSnapshot.aiReading);
            setHexagram(rootSnapshot.hexagram);
            setRelatingHexagram(rootSnapshot.relatingHexagram);
            setDivinationResult(rootSnapshot.divinationResult);
            setDrawnCards(rootSnapshot.drawnCards);
            setSelectedSpreadId(rootSnapshot.spreadId);
          }
          setIsFollowUpMode(false);
          setPendingScrollIdx(newIdx); // 觸發自動捲到這筆新加的衍伸
        } else {
          // 存進 Supabase(Phase B)— 塔羅版本,讓分享 / 公開連結可用
          const saved = await saveDivination({
            divineType: "tarot",
            question: userQuestion,
            category: selectedCategory,
            spreadId: spread.id,
            tarotCards: cards.map((d, i) => ({
              cardId: d.card.id,
              position: spread.positions[i].key,
              isReversed: d.isReversed,
            })),
            aiReading: fullText,
            locale,
          });
          if (saved?.id) setDivinationId(saved.id);
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setAiReading(
        t("抱歉,AI 解讀暫時無法使用。請確認 API 金鑰已設定。",
          "Sorry, AI reading is temporarily unavailable. Please check your API key.")
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingAI(false);
      }
    }
  };

  // 全部塔羅牌翻開 → 自動進 result 畫面 + 觸發 AI 解讀
  // (cardCount 隨選定的牌陣 3 / 5 / 10 / 12)
  useEffect(() => {
    if (step !== "tarot-reveal") return;
    const spread = getSpread(selectedSpreadId ?? DEFAULT_SPREAD_ID);
    if (revealedCount < spread.cardCount) return;
    if (drawnCards.length !== spread.cardCount) return;
    const timer = setTimeout(() => {
      setStep("result");
      fetchTarotReading(drawnCards);
    }, 1200); // 讓最後一張翻牌動畫跑完再切
    return () => clearTimeout(timer);
    // fetchTarotReading 故意不放 deps — 新的 render 才產 new ref,會造成重複觸發
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, revealedCount, drawnCards, selectedSpreadId]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    // 易經必須有 hexagram;塔羅必須有 spread.cardCount 張牌
    const chatSpread = divineType === "tarot" ? getSpread(selectedSpreadId ?? DEFAULT_SPREAD_ID) : null;
    if (divineType === "tarot") {
      if (!chatSpread || drawnCards.length !== chatSpread.cardCount) return;
    } else {
      if (!hexagram) return;
    }

    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user" as const, content: userMsg }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    // Build reading context for the AI — 易經 / 塔羅 不同組合
    let readingContext: string;
    if (divineType === "tarot" && chatSpread) {
      const lines = drawnCards.map((d, i) => {
        const pos = chatSpread.positions[i];
        const cardName = t(d.card.nameZh, d.card.nameEn, d.card.nameJa, d.card.nameKo);
        const meaning = d.isReversed
          ? t(d.card.reversedMeaningZh, d.card.reversedMeaningEn, d.card.reversedMeaningJa, d.card.reversedMeaningKo)
          : t(d.card.uprightMeaningZh, d.card.uprightMeaningEn, d.card.uprightMeaningJa, d.card.uprightMeaningKo);
        const lbl = t(pos.labelZh, pos.labelEn, pos.labelJa, pos.labelKo);
        const ori = d.isReversed
          ? t("逆位", "Reversed", "逆位置", "역방향")
          : t("正位", "Upright", "正位置", "정방향");
        return `${t("【", "[", "【", "[")}${lbl}${t("】", "]", "】", "]")} ${cardName} (${ori}): ${meaning}`;
      }).join("\n");
      const spreadLabel = t(chatSpread.nameZh, chatSpread.nameEn, chatSpread.nameJa, chatSpread.nameKo);
      const cardCountLabel = t(
        `${chatSpread.cardCount} 張`,
        `${chatSpread.cardCount} cards`,
        `${chatSpread.cardCount}枚`,
        `${chatSpread.cardCount}장`
      );
      const qLabel = t("問題", "Question", "質問", "질문");
      const readingLabel = t("老師解盤", "Reading", "解読", "해석");
      readingContext = `${qLabel}: ${userQuestion}\n\n${spreadLabel}(${cardCountLabel}):\n${lines}\n\n${readingLabel}: ${aiReading}`;
    } else {
      const hexName = t(hexagram!.nameZh, hexagram!.nameEn, hexagram!.nameJa, hexagram!.nameKo);
      const judgmentModern = t(hexagram!.judgmentVernacularZh, hexagram!.judgmentEn, hexagram!.judgmentJa, hexagram!.judgmentKo);
      const imageModern = t(hexagram!.imageVernacularZh, hexagram!.imageEn, hexagram!.imageJa, hexagram!.imageKo);
      const numLabel = t(`第${hexagram!.number}卦`, `Hexagram ${hexagram!.number}`, `第${hexagram!.number}卦`, `제 ${hexagram!.number}괘`);
      const judgmentLabel = t("卦辭", "Judgment", "卦辞", "괘사");
      const imageLabel = t("象辭", "Image", "象辞", "상사");
      const qLabel = t("問題", "Question", "質問", "질문");
      const readingLabel = t("老師解盤", "Reading", "解読", "해석");
      const benLabel = t("本卦", "Hexagram", "本卦", "본괘");
      readingContext = `${benLabel}:${numLabel} ${hexName}\n${judgmentLabel}:${hexagram!.judgmentZh} (${judgmentModern})\n${imageLabel}:${hexagram!.imageZh} (${imageModern})\n${qLabel}:${userQuestion}\n${readingLabel}:${aiReading}`;
    }

    // 若這個 session 已經做過衍伸占卜,把衍伸鏈也接到 readingContext,
    // 這樣聊天 AI 會知道「根占卜 + 延伸占卜 X 次」的完整脈絡。
    if (followUps.length > 0) {
      const followBlocks = followUps.map((f, i) => {
        const label = t(
          `延伸第${i + 1}回合`,
          `Follow-up #${i + 1}`,
          `フォローアップ #${i + 1}`,
          `후속 #${i + 1}`
        );
        if (f.divineType === "iching" && f.hexagram) {
          const nm = t(f.hexagram.nameZh, f.hexagram.nameEn, f.hexagram.nameJa, f.hexagram.nameKo);
          const numLabel = t(`第${f.hexagram.number}卦`, `Hexagram ${f.hexagram.number}`, `第${f.hexagram.number}卦`, `제 ${f.hexagram.number}괘`);
          return `【${label}】${t("易經", "I Ching", "易経", "주역")} | ${numLabel} ${nm}\n${t("當時問題", "Question", "当時の質問", "당시의 질문")}: ${f.question}\n${t("當時老師解盤", "Reading", "当時の解読", "당시의 해석")}: ${f.aiReading}`;
        }
        if (f.divineType === "tarot" && f.drawnCards && f.drawnCards.length > 0) {
          const fSpread = getSpread(f.spreadId ?? DEFAULT_SPREAD_ID);
          if (f.drawnCards.length !== fSpread.cardCount) return "";
          const parts = f.drawnCards.map((d, idx) => {
            const pos = fSpread.positions[idx];
            const nm = t(d.card.nameZh, d.card.nameEn, d.card.nameJa, d.card.nameKo);
            const ori = d.isReversed
              ? t("逆位", "Reversed", "逆位置", "역방향")
              : t("正位", "Upright", "正位置", "정방향");
            const lbl = t(pos.labelZh, pos.labelEn, pos.labelJa, pos.labelKo);
            return `${lbl}=${nm}(${ori})`;
          }).join(" / ");
          const spreadLabel = t(fSpread.nameZh, fSpread.nameEn, fSpread.nameJa, fSpread.nameKo);
          return `【${label}】${t("塔羅", "Tarot", "タロット", "타로")} ${spreadLabel} | ${parts}\n${t("當時問題", "Question", "当時の質問", "당시의 질문")}: ${f.question}\n${t("當時老師解盤", "Reading", "当時の解読", "당시의 해석")}: ${f.aiReading}`;
        }
        return "";
      }).filter(Boolean).join("\n\n");
      readingContext = `${readingContext}\n\n${t("── 之後的延伸占卜 ──", "── Subsequent follow-ups ──", "── その後のフォローアップ占い ──", "── 이후 후속 점 ──")}\n${followBlocks}`;
    }

    if (chatAbortRef.current) chatAbortRef.current.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          readingContext,
          divineType: divineType ?? "iching",
          locale,
          divinationId, // 帶上讓後端 append chat_messages 到這筆 divination
          personaId,
        }),
        signal: controller.signal,
      });

      // 402 點數不足 → 把剛塞進去的使用者訊息拿掉,彈 modal
      const creditsErr = await parseInsufficientCredits(response);
      if (creditsErr) {
        // newMessages 已經 append 了這輪使用者訊息 —— 回退 + 把字還回輸入框
        setChatMessages((prev) => prev.slice(0, -1));
        setChatInput(userMsg);
        setCreditsModal({ open: true, required: creditsErr.required });
        return;
      }

      if (!response.ok) throw new Error("API error");

      // 扣點已經發生 —— 通知 Badge 更新
      notifyCreditsChanged();

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullReply = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) break;
          const chunk = decoder.decode(value, { stream: true });
          fullReply += chunk;
          setChatMessages([...newMessages, { role: "assistant", content: fullReply }]);
        }
      }

      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setChatMessages([
        ...newMessages,
        {
          role: "assistant",
          content: t(
            "抱歉，暫時無法回覆。",
            "Sorry, unable to reply at the moment.",
            "申し訳ありません、しばらくお返事できません。",
            "죄송합니다. 지금은 답변할 수 없습니다."
          ),
        },
      ]);
    } finally {
      if (!controller.signal.aborted) setIsChatLoading(false);
    }
  };

  const handleReset = () => {
    setStep("category");
    setSelectedCategory("");
    setUserQuestion("");
    setCurrentThrow(0);
    setThrows([]);
    setCurrentCoins(null);
    setIsFlipping(false);
    setDivinationResult(null);
    setHexagram(null);
    setRelatingHexagram(null);
    setAiReading("");
    setIsLoadingAI(false);
    setChatMessages([]);
    setChatInput("");
    setIsChatLoading(false);
    setIsSharing(false);
    setShareMessage(null);
    setDivinationId(null);
    setIsPublic(false);
    setIsTogglingPublic(false);
    setCopyStatus("idle");
    // divinationMode 清掉讓下次重選(lastModePref 留著做「上次選了 X」提示)
    setDivinationMode(null);
    // 塔羅 state 也一併清掉
    setDivineType(null);
    setSelectedSpreadId(null);
    setDrawnCards([]);
    setRevealedCount(0);
    // 衍伸占卜 state
    setRootSnapshot(null);
    setFollowUps([]);
    setIsFollowUpMode(false);
    setShowFollowUpForm(false);
    setFollowUpQuestion("");
  };

  // ── 衍伸占卜鏈渲染 ─────────────────────────────────────
  // 結果頁上「根占卜」和「聊天框」中間插進來:把所有已完成的衍伸占卜
  // 以時間順序列出,每一筆含當時的問題、卦象/牌、AI 的延伸解說。
  const renderFollowUpChain = () => {
    if (followUps.length === 0) return null;
    return (
      <div className="mystic-card" style={{ padding: 16, marginTop: 16 }}>
        <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
          🌿 {t(
            "延伸占卜",
            "Follow-up Readings",
            "フォローアップ占い",
            "후속 점"
          )}
          <span style={{ color: "rgba(192,192,208,0.5)", fontSize: 12, marginLeft: 8, fontWeight: 400 }}>
            ({followUps.length})
          </span>
        </h3>
        {followUps.map((f, i) => {
          const isIching = f.divineType === "iching";
          const hexName = f.hexagram
            ? t(f.hexagram.nameZh, f.hexagram.nameEn, f.hexagram.nameJa, f.hexagram.nameKo)
            : "";
          const isLast = i === followUps.length - 1;
          return (
            <div
              key={f.id}
              data-followup-index={i}
              style={{
                marginBottom: isLast ? 0 : 14,
                paddingBottom: isLast ? 0 : 14,
                borderBottom: isLast ? "none" : "1px dashed rgba(212,168,85,0.18)",
                scrollMarginTop: 80, // 留給 fixed header 的空間,避免捲過去時被擋住
              }}
            >
              <div style={{ color: "#d4a855", fontSize: 12, marginBottom: 4, fontFamily: "'Noto Serif TC', serif" }}>
                {t(
                  `延伸第 ${i + 1} 回合`,
                  `Follow-up #${i + 1}`,
                  `フォローアップ #${i + 1}`,
                  `후속 #${i + 1}`
                )}
                <span style={{ color: "rgba(192,192,208,0.5)", marginLeft: 8 }}>
                  {isIching
                    ? `· ☯ ${t("易經", "I Ching", "易経", "주역")} · ${hexName}`
                    : (() => {
                        const sp = getSpread(f.spreadId ?? DEFAULT_SPREAD_ID);
                        return `· 🎴 ${t(sp.nameZh, sp.nameEn, sp.nameJa, sp.nameKo)}`;
                      })()}
                </span>
              </div>
              <div style={{ color: "#e8e0d0", fontSize: 14, marginBottom: 6, lineHeight: 1.55 }}>
                <span style={{ color: "rgba(192,192,208,0.6)", marginRight: 6 }}>Q:</span>
                {f.question}
              </div>
              {isIching && f.hexagram && f.primaryLines && (
                <div style={{ marginTop: 6, marginBottom: 8, display: "flex", justifyContent: "center" }}>
                  <HexagramDisplay
                    lines={f.primaryLines}
                    changingLines={f.changingLines ?? []}
                    size="sm"
                    animate={false}
                  />
                </div>
              )}
              {!isIching && f.drawnCards && f.drawnCards.length > 0 && (() => {
                const fSpread = getSpread(f.spreadId ?? DEFAULT_SPREAD_ID);
                if (f.drawnCards!.length !== fSpread.cardCount) return null;
                // 3 張正常排版,5/10/12 張用 5 欄壓小,避免延伸鏈被一張一張撐滿
                const cols = fSpread.cardCount <= 3 ? 3 : 5;
                return (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: 6,
                  marginTop: 6,
                  marginBottom: 8,
                }}>
                  {f.drawnCards!.map((d, idx) => {
                    const pos = fSpread.positions[idx] ?? fSpread.positions[0];
                    const cardName = t(d.card.nameZh, d.card.nameEn, d.card.nameJa, d.card.nameKo);
                    return (
                      <div key={idx} style={{ textAlign: "center" }}>
                        <div style={{
                          color: "#d4a855",
                          fontSize: 10,
                          marginBottom: 3,
                          fontFamily: "'Noto Serif TC', serif",
                        }}>
                          {t(pos.labelZh, pos.labelEn, pos.labelJa, pos.labelKo)}
                        </div>
                        <div style={{
                          width: "100%",
                          aspectRatio: "2 / 3.5",
                          borderRadius: 6,
                          overflow: "hidden",
                          border: "1px solid rgba(212,168,85,0.3)",
                          background: "rgba(13,13,43,0.9)",
                        }}>
                          <img
                            src={d.card.imagePath}
                            alt={cardName}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                              transform: d.isReversed ? "rotate(180deg)" : "none",
                            }}
                          />
                        </div>
                        <div style={{
                          color: "#e8e8f0",
                          fontSize: 10,
                          marginTop: 3,
                          lineHeight: 1.2,
                        }}>
                          {cardName}
                        </div>
                      </div>
                    );
                  })}
                </div>
                );
              })()}
              <div style={{
                background: "rgba(10,10,26,0.55)",
                border: "1px solid rgba(212,168,85,0.15)",
                borderRadius: 10,
                padding: "10px 12px",
                color: "rgba(192,192,208,0.9)",
                fontSize: 13,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}>
                <div style={{ color: "#d4a855", fontSize: 11, marginBottom: 4 }}>
                  {t(
                    "老師延伸解說",
                    "Master's continuation",
                    "占い師の続き解説",
                    "선생님의 후속 해설"
                  )}
                </div>
                {f.aiReading}
                {/* 免責聲明 */}
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 6,
                    borderTop: "1px dashed rgba(212,168,85,0.15)",
                    color: "rgba(192,192,208,0.45)",
                    fontSize: 10,
                    lineHeight: 1.6,
                    fontStyle: "italic",
                  }}
                >
                  {t(
                    "※ 僅供參考,不構成投資、醫療、法律或重大決策之建議。",
                    "※ For reference only. Not investment, medical, legal, or major life decision advice.",
                    "※ 参考のみ。投資・医療・法律・人生の重要な決断のアドバイスではありません。",
                    "※ 참고용입니다. 투자·의료·법률·인생의 중대한 결정의 조언이 아닙니다."
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 「衍伸問題繼續占卜」按鈕 + inline 問題輸入框。放在聊天框上方/內部的延伸入口。
  const renderFollowUpCTA = () => {
    // AI 還在串流 root 解盤 → 先不要顯示按鈕,避免使用者按到半截
    if (isLoadingAI) return null;
    // 正在做衍伸占卜時(從 divine-type 跑到 result 的過程)— 結果頁此刻暫時沒在顯示,
    // 但保險起見,isFollowUpMode 時也不給再按(會被 handleStartFollowUp 擋但 UI 也別露)
    if (isFollowUpMode) return null;

    const locked = !isSignedIn || !divinationId;

    if (locked) {
      return (
        <div style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 10,
          border: "1px dashed rgba(212,168,85,0.3)",
          background: "rgba(10,10,26,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}>
          <span style={{ color: "rgba(192,192,208,0.7)", fontSize: 12, lineHeight: 1.6, flex: "1 1 200px" }}>
            🔒 {t(
              "相關衍伸問題繼續占卜(登入會員可延續對話+再抽一卦)",
              "Follow up with a deeper question (sign in to continue)"
            )}
          </span>
          <button
            onClick={handleLoginForShare}
            className="btn-gold"
            style={{ fontSize: 13, padding: "8px 18px", flexShrink: 0 }}
          >
            {t("登入後解鎖", "Sign in to unlock", "ログインして解除", "로그인하여 잠금 해제")}
          </button>
        </div>
      );
    }

    if (showFollowUpForm) {
      return (
        <div style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 10,
          border: "1px solid rgba(212,168,85,0.3)",
          background: "rgba(10,10,26,0.5)",
        }}>
          <div style={{ color: "#d4a855", fontSize: 13, marginBottom: 8, fontFamily: "'Noto Serif TC', serif" }}>
            ✦ {t(
              "提出延伸問題,再抽一卦",
              "Ask a deeper question, draw again",
              "深い質問でもう一度占う",
              "더 깊은 질문으로 다시 점치기"
            )}
          </div>
          <textarea
            value={followUpQuestion}
            onChange={(e) => setFollowUpQuestion(e.target.value)}
            placeholder={t(
              "例如:那如果我真的轉職,下半年會順利嗎?",
              "e.g., If I actually make that move, will the second half go well?"
            )}
            style={{
              width: "100%",
              minHeight: 72,
              background: "rgba(13,13,43,0.7)",
              border: "1px solid rgba(212,168,85,0.2)",
              borderRadius: 10,
              padding: 10,
              color: "white",
              resize: "vertical",
              fontSize: 13,
              outline: "none",
              fontFamily: "'Noto Sans TC', sans-serif",
              lineHeight: 1.6,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={handleCancelFollowUpForm}
              style={{
                padding: "8px 16px",
                borderRadius: 9999,
                border: "1px solid rgba(192,192,208,0.2)",
                background: "transparent",
                color: "rgba(192,192,208,0.7)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {t("取消", "Cancel", "キャンセル", "취소")}
            </button>
            <button
              onClick={handleStartFollowUp}
              disabled={!followUpQuestion.trim()}
              className="btn-gold"
              style={{ flex: 1, fontSize: 14, padding: "8px 16px" }}
            >
              {t(
                "進入占卜工具 →",
                "Choose oracle →",
                "占いツールを選ぶ →",
                "점 도구 선택 →"
              )}
            </button>
          </div>
          <p style={{ marginTop: 8, color: "rgba(192,192,208,0.5)", fontSize: 11, lineHeight: 1.5, margin: "8px 0 0" }}>
            {t(
              "老師會記得剛剛的占卜與我們的對話,用這次新抽到的卦/牌給你約 300 字的延伸解說。",
              "The master will remember this reading and our chat, then give ~150 words of continuation based on your new draw."
            )}
          </p>
        </div>
      );
    }

    return (
      <button
        onClick={() => setShowFollowUpForm(true)}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "10px 16px",
          borderRadius: 10,
          border: "1px solid rgba(212,168,85,0.4)",
          background: "rgba(212,168,85,0.08)",
          color: "#d4a855",
          fontSize: 13,
          fontFamily: "'Noto Sans TC', sans-serif",
          cursor: "pointer",
          lineHeight: 1.5,
        }}
      >
        ✦ {t(
          "相關衍伸問題繼續占卜",
          "Follow up with another reading",
          "関連する深い質問で続けて占う",
          "관련된 후속 질문으로 점 계속하기"
        )}
      </button>
    );
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />

      <InsufficientCreditsModal
        open={creditsModal.open}
        required={creditsModal.required}
        onClose={() => setCreditsModal({ open: false, required: 0 })}
      />

      {/* ---- 訪客 2 次上限 gate:沿用 LoginOptionsModal,加訪客專屬標題與說明 ---- */}
      <LoginOptionsModal
        open={guestGateOpen}
        onClose={() => setGuestGateOpen(false)}
        lineEnabled={LINE_LOGIN_ENABLED}
        title={t(
          "登入以解鎖完整體驗",
          "Sign in to unlock the full experience",
          "ログインして全機能をアンロック",
          "로그인하여 전체 기능 해제"
        )}
        subtitle={t(
          "訪客每人限占卜 2 次。登入即贈 30 點,先前的占卜結果會自動保留進您的占卜紀錄。",
          "Guests are limited to 2 divinations. Sign in for 30 bonus credits — your previous readings will be carried over into your history."
        )}
      />

      {/* ---- 通用登入 modal(handleLoginForShare 觸發) ---- */}
      <LoginOptionsModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        lineEnabled={LINE_LOGIN_ENABLED}
      />

      <main style={{ paddingTop: 80, paddingBottom: 48, paddingLeft: 16, paddingRight: 16, maxWidth: 640, margin: "0 auto" }}>
        <AnimatePresence mode="wait">

          {/* ===== STEP 1: Category ===== */}
          {step === "category" && (
            <motion.div key="cat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {/* ===== HERO ===== */}
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 28 }}>
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  style={{ display: "inline-block", position: "relative" }}
                >
                  <motion.div
                    aria-hidden
                    animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.95, 1.05, 0.95] }}
                    transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      position: "absolute",
                      inset: -24,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle, rgba(212,168,85,0.55) 0%, rgba(212,168,85,0) 70%)",
                      filter: "blur(18px)",
                      pointerEvents: "none",
                    }}
                  />
                  <Image
                    src="/logo-256.png"
                    alt={t("易問", "Tarogram", "易問", "타로그램")}
                    width={140}
                    height={140}
                    priority
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: "50%",
                      display: "block",
                      position: "relative",
                      boxShadow: "0 0 36px rgba(212,168,85,0.45)",
                    }}
                  />
                </motion.div>
                <h1
                  className="text-gold-gradient"
                  style={{
                    fontFamily: "'Noto Serif TC', serif",
                    fontSize: 26,
                    marginTop: 20,
                    lineHeight: 1.4,
                    letterSpacing: 1,
                  }}
                >
                  {t(
                    "一個問題,兩種千年智慧",
                    "One Question · Two Ancient Wisdoms",
                    "一つの問い、二つの古の知恵",
                    "하나의 질문, 두 천년의 지혜"
                  )}
                </h1>
                <p
                  style={{
                    color: "rgba(192,192,208,0.8)",
                    fontSize: 14,
                    maxWidth: 420,
                    margin: "12px auto 0",
                    lineHeight: 1.7,
                  }}
                >
                  {t(
                    "AI 同時為你解讀「易經卦象」與「塔羅牌陣」 — 東方哲思 × 西方象徵,看見更立體的答案。",
                    "AI reads both an I Ching hexagram and a Tarot spread for the same question — Eastern philosophy meets Western symbolism for a richer answer.",
                    "AIが「易経の卦」と「タロットの配置」を同時に読み解く — 東洋の哲学 × 西洋の象徴で、より立体的な答えを。",
                    "AI가 '주역의 괘'와 '타로 배열'을 동시에 해석합니다 — 동양 철학 × 서양 상징으로 더 입체적인 답을."
                  )}
                </p>
              </div>

              {/* ===== 直接入口 CTA — 點下去跳到 /categories?type=...,
                    分類選完再帶 ?type & ?category 回首頁進到 question step。
                    舊版本是同一頁 scroll-into-view + 分類 grid,易誤點且資訊密度過高。 ===== */}
              <p
                style={{
                  textAlign: "center",
                  color: "rgba(212,168,85,0.85)",
                  fontSize: 13,
                  marginBottom: 10,
                  letterSpacing: 0.5,
                }}
              >
                {t(
                  "選擇占卜方式,接著挑問事類別",
                  "Pick a method, then a topic",
                  "占いの方法を選び、次にテーマを",
                  "방식을 고르고, 이어서 주제를"
                )}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
                <Link
                  href="/categories?type=iching"
                  style={{
                    display: "block",
                    padding: 0,
                    textAlign: "left",
                    textDecoration: "none",
                    borderRadius: 14,
                    overflow: "hidden",
                    border: "1px solid rgba(212,168,85,0.25)",
                    background: "rgba(13,13,43,0.8)",
                    fontFamily: "inherit",
                  }}
                >
                  <HeroImage url={uiImages["cta.iching"]} aspectRatio="4/3" />
                  <div style={{ padding: "12px 14px 14px" }}>
                    <div style={{ color: "#d4a855", fontWeight: 700, fontSize: 16 }}>
                      {t("易經占卜", "I Ching", "易経占い", "주역 점")}
                    </div>
                    <div style={{ color: "rgba(192,192,208,0.7)", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                      {t(
                        "擲銅錢成卦",
                        "Cast hexagram coins",
                        "コインを投げて卦を作る",
                        "동전을 던져 괘 만들기"
                      )}
                    </div>
                  </div>
                </Link>
                <Link
                  href="/categories?type=tarot"
                  style={{
                    display: "block",
                    padding: 0,
                    textAlign: "left",
                    textDecoration: "none",
                    borderRadius: 14,
                    overflow: "hidden",
                    border: "1px solid rgba(212,168,85,0.25)",
                    background: "rgba(13,13,43,0.8)",
                    fontFamily: "inherit",
                  }}
                >
                  <HeroImage url={uiImages["cta.tarot"]} aspectRatio="4/3" />
                  <div style={{ padding: "12px 14px 14px" }}>
                    <div style={{ color: "#d4a855", fontWeight: 700, fontSize: 16 }}>
                      {t("塔羅占卜", "Tarot", "タロット占い", "타로 점")}
                    </div>
                    <div style={{ color: "rgba(192,192,208,0.7)", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                      {t(
                        "5 種經典牌陣可選",
                        "5 classic spreads",
                        "5種類のスプレッド",
                        "5가지 대표 스프레드"
                      )}
                    </div>
                  </div>
                </Link>
              </div>

              {/* ===== Trust signal strip ===== */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  padding: "12px 8px",
                  marginBottom: 24,
                  borderTop: "1px solid rgba(212,168,85,0.15)",
                  borderBottom: "1px solid rgba(212,168,85,0.15)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      color: "#d4a855",
                      fontWeight: 700,
                      fontSize: 18,
                      fontFamily: "'Noto Serif TC', serif",
                    }}
                  >
                    64
                  </div>
                  <div style={{ color: "rgba(192,192,208,0.65)", fontSize: 10, marginTop: 2 }}>
                    {t("卦完整解析", "Hexagrams", "卦の完全解析", "괘 완전 해석")}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    borderLeft: "1px solid rgba(212,168,85,0.12)",
                    borderRight: "1px solid rgba(212,168,85,0.12)",
                  }}
                >
                  <div
                    style={{
                      color: "#d4a855",
                      fontWeight: 700,
                      fontSize: 18,
                      fontFamily: "'Noto Serif TC', serif",
                    }}
                  >
                    78
                  </div>
                  <div style={{ color: "rgba(192,192,208,0.65)", fontSize: 10, marginTop: 2 }}>
                    {t("塔羅牌百科", "Tarot cards", "タロット百科", "타로 백과")}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      color: "#d4a855",
                      fontWeight: 700,
                      fontSize: 18,
                      fontFamily: "'Noto Serif TC', serif",
                    }}
                  >
                    5+
                  </div>
                  <div style={{ color: "rgba(192,192,208,0.65)", fontSize: 10, marginTop: 2 }}>
                    {t("經典牌陣", "Classic spreads", "定番スプレッド", "대표 스프레드")}
                  </div>
                </div>
              </div>

              {/* 分類 grid 已搬到 /categories;首頁不再內嵌 — 由上方 CTA 帶過去。 */}

              {/* ===== Free tools ===== */}
              <div style={{ marginTop: 36 }}>
                <div style={{ textAlign: "center", marginBottom: 14 }}>
                  <h3
                    className="text-gold-gradient"
                    style={{
                      fontFamily: "'Noto Serif TC', serif",
                      fontSize: 17,
                      marginBottom: 4,
                    }}
                  >
                    {t("免費先試試看", "Try For Free", "まずは無料でお試し", "무료로 먼저 체험")}
                  </h3>
                  <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12 }}>
                    {t("不用註冊也能使用", "No sign-up required", "登録不要", "가입 없이 이용")}
                  </p>
                </div>
                {/* 兩欄並排:左=易經系列、右=塔羅系列。各 3 張卡片直排,sub-header 標出系列名 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  {/* ── 左:易經系列 ── */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div
                      style={{
                        textAlign: "center",
                        padding: "6px 0 4px",
                        color: "#d4a855",
                        fontFamily: "'Noto Serif TC', serif",
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: 1,
                      }}
                    >
                      ☯ {t("易經系列", "I Ching", "易経シリーズ", "주역 시리즈")}
                    </div>
                    <FreeToolCard
                      href="/iching/yes-no"
                      imageUrl={uiImages["freeTool.iching.yes-no"]}
                      title={t("Yes / No 一卦速答", "Yes / No I Ching", "Yes / No 一卦速答", "Yes / No 주역")}
                      desc={t("從 64 卦抽一卦", "Pull one of the 64", "64卦から1卦", "64괘 중 한 괘")}
                      cta={t("來問問看", "Try it", "試してみる", "물어보기")}
                    />
                    <FreeToolCard
                      href="/iching/daily"
                      imageUrl={uiImages["freeTool.iching.daily"]}
                      title={t("每日一卦", "Daily Hexagram", "毎日の卦", "오늘의 괘")}
                      desc={t("今日能量指引", "Today's energy", "今日のエネルギー", "오늘의 에너지")}
                      cta={t("看今天的", "Today", "今日を見る", "오늘 보기")}
                    />
                    <FreeToolCard
                      href="/iching/methods"
                      imageUrl={uiImages["freeTool.iching.methods"]}
                      title={t("卜卦方式介紹", "Divination Methods", "卜卦の方法", "점치는 법")}
                      desc={t("五種主流卜卦法", "Five mainstream methods", "5つの主要な方法", "다섯 가지 방법")}
                      cta={t("看方式", "Browse", "方法を見る", "방법 보기")}
                    />
                  </div>

                  {/* ── 右:塔羅系列 ── */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div
                      style={{
                        textAlign: "center",
                        padding: "6px 0 4px",
                        color: "#d4a855",
                        fontFamily: "'Noto Serif TC', serif",
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: 1,
                      }}
                    >
                      🎴 {t("塔羅系列", "Tarot", "タロットシリーズ", "타로 시리즈")}
                    </div>
                    <FreeToolCard
                      href="/yes-no"
                      imageUrl={uiImages["freeTool.yes-no"]}
                      title={t("Yes / No 速答", "Yes / No Quick", "Yes / No 即答", "Yes / No 즉답")}
                      desc={t("簡單問題秒回", "Single-card answer", "シンプルな質問に即答", "간단 질문 즉답")}
                      cta={t("來問問看", "Try it", "試してみる", "물어보기")}
                    />
                    <FreeToolCard
                      href="/daily"
                      imageUrl={uiImages["freeTool.daily"]}
                      title={t("每日一卡", "Daily Card", "毎日のカード", "오늘의 카드")}
                      desc={t("今日能量指引", "Today's energy", "今日のエネルギー", "오늘의 에너지")}
                      cta={t("看今天的", "Today", "今日を見る", "오늘 보기")}
                    />
                    <FreeToolCard
                      href="/tarot-spread"
                      imageUrl={uiImages["freeTool.spreads"]}
                      title={t("牌陣介紹", "Spreads Guide", "スプレッドガイド", "스프레드 가이드")}
                      desc={t("認識經典牌陣", "Classic spreads", "定番スプレッド", "대표 스프레드")}
                      cta={t("看牌陣", "Browse", "スプレッドを見る", "스프레드 보기")}
                    />
                  </div>
                </div>
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <Link
                    href="/blog"
                    style={{
                      color: "rgba(212,168,85,0.85)",
                      fontSize: 12,
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    {t(
                      "閱讀更多占卜知識文章 →",
                      "Read more articles →",
                      "占いの記事をもっと読む →",
                      "점술 글 더 읽기 →"
                    )}
                  </Link>
                </div>
              </div>

              {/* ===== Dual system showcase ===== */}
              <div style={{ marginTop: 36, marginBottom: 8 }}>
                <div style={{ textAlign: "center", marginBottom: 14 }}>
                  <h3
                    className="text-gold-gradient"
                    style={{
                      fontFamily: "'Noto Serif TC', serif",
                      fontSize: 17,
                      marginBottom: 4,
                    }}
                  >
                    {t(
                      "為什麼是雙系統?",
                      "Why Both Systems?",
                      "なぜ2つのシステム?",
                      "왜 두 시스템인가?"
                    )}
                  </h3>
                  <p
                    style={{
                      color: "rgba(192,192,208,0.6)",
                      fontSize: 12,
                      lineHeight: 1.6,
                      maxWidth: 360,
                      margin: "0 auto",
                    }}
                  >
                    {t(
                      "易經給你「結構與時機」,塔羅給你「情緒與象徵」 — 兩面相互印證,答案更全面。",
                      "I Ching reveals structure and timing; Tarot reveals emotion and symbol — two angles validate one another.",
                      "易経は「構造と時機」を、タロットは「感情と象徴」を — 二つの視点が答えをより立体的に。",
                      "주역은 '구조와 시기'를, 타로는 '감정과 상징'을 — 두 시각이 서로를 비춰 답이 입체적으로."
                    )}
                  </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* 易經卡 → 64 卦完整介紹 */}
                  <Link
                    href="/iching/hexagrams"
                    style={{
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid rgba(212,168,85,0.18)",
                      background: "rgba(13,13,43,0.65)",
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    {uiImages["dualSystem.iching"] ? (
                      <HeroImage url={uiImages["dualSystem.iching"]} aspectRatio="1" />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background:
                            "linear-gradient(135deg, rgba(212,168,85,0.10), rgba(13,13,43,0.45))",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: 28,
                            color: "#d4a855",
                            lineHeight: 1.55,
                            letterSpacing: 1,
                            textAlign: "center",
                          }}
                        >
                          <div>━━━ ━━━</div>
                          <div>━━━━━━━</div>
                          <div>━━━ ━━━</div>
                          <div>━━━━━━━</div>
                          <div>━━━━━━━</div>
                          <div>━━━ ━━━</div>
                        </div>
                      </div>
                    )}
                    <div style={{ padding: "12px 14px 14px", textAlign: "center" }}>
                      <div
                        style={{
                          color: "#d4a855",
                          fontSize: 15,
                          fontWeight: 700,
                          fontFamily: "'Noto Serif TC', serif",
                        }}
                      >
                        {t("易經", "I Ching", "易経", "주역")}
                      </div>
                      <div style={{ color: "rgba(192,192,208,0.65)", fontSize: 12, marginTop: 4 }}>
                        {t(
                          "結構 · 時機 · 變化",
                          "Structure · Timing · Change",
                          "構造 · 時機 · 変化",
                          "구조 · 시기 · 변화"
                        )}
                      </div>
                      <div
                        style={{
                          color: "rgba(212,168,85,0.7)",
                          fontSize: 11,
                          marginTop: 8,
                          letterSpacing: 0.5,
                        }}
                      >
                        {t("64 卦完整介紹 →", "64 hexagrams →", "64卦完全解説 →", "64괘 전체 →")}
                      </div>
                    </div>
                  </Link>

                  {/* 塔羅卡 → 78 張塔羅牌百科 */}
                  <Link
                    href="/tarot/cards"
                    style={{
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid rgba(212,168,85,0.18)",
                      background: "rgba(13,13,43,0.65)",
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    <HeroImage url={uiImages["dualSystem.tarot"]} aspectRatio="1" />
                    <div style={{ padding: "12px 14px 14px", textAlign: "center" }}>
                      <div
                        style={{
                          color: "#d4a855",
                          fontSize: 15,
                          fontWeight: 700,
                          fontFamily: "'Noto Serif TC', serif",
                        }}
                      >
                        {t("塔羅", "Tarot", "タロット", "타로")}
                      </div>
                      <div style={{ color: "rgba(192,192,208,0.65)", fontSize: 12, marginTop: 4 }}>
                        {t(
                          "情緒 · 象徵 · 故事",
                          "Emotion · Symbol · Story",
                          "感情 · 象徴 · 物語",
                          "감정 · 상징 · 이야기"
                        )}
                      </div>
                      <div
                        style={{
                          color: "rgba(212,168,85,0.7)",
                          fontSize: 11,
                          marginTop: 8,
                          letterSpacing: 0.5,
                        }}
                      >
                        {t("78 張牌意百科 →", "78 cards →", "78枚カード百科 →", "78장 카드 백과 →")}
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 2: Question ===== */}
          {step === "question" && (
            <motion.div key="q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 24 }}>
                <span style={{ fontSize: 40 }}>{questionCategories.find((c) => c.id === selectedCategory)?.icon}</span>
                <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif", marginTop: 8 }}>
                  {t(
                    "請輸入你的問題",
                    "Enter your question",
                    "質問を入力してください",
                    "질문을 입력하세요"
                  )}
                </h2>
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 4 }}>
                  {t(
                    "心誠則靈，專注你想問的事",
                    "Focus your mind on what you seek to know",
                    "心を込めて、知りたいことに集中しましょう",
                    "마음을 모아 알고 싶은 것에 집중하세요"
                  )}
                </p>
              </div>

              <div className="mystic-card" style={{ padding: 24 }}>
                <textarea
                  id="question-textarea"
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  placeholder={t(
                    "例如：我近期的感情運勢如何？",
                    "e.g., What does my love life look like?",
                    "例:最近の恋愛運はどう?",
                    "예: 최근 나의 연애운은?"
                  )}
                  style={{
                    width: "100%", height: 128, background: "rgba(10,10,26,0.5)",
                    border: "1px solid rgba(212,168,85,0.2)", borderRadius: 12,
                    padding: 16, color: "white", resize: "none", fontSize: 16,
                    outline: "none", fontFamily: "'Noto Sans TC', sans-serif",
                  }}
                />

                {/* 占卜師人格 + Quick/Deep 模式選擇 — picker 自己 fetch /api/personas,我們只給系統 */}
                <PersonaDepthPicker
                  isSubscriber={isActive}
                  personaId={personaId}
                  depth={readingDepth}
                  onChange={handlePersonaDepthChange}
                  system={divineType === "iching" ? "iching" : "tarot"}
                  onUpgrade={() => {
                    if (typeof window !== "undefined") {
                      window.location.assign("/account/upgrade");
                    }
                  }}
                />

                {/* 問題靈感 — 點問句自動帶入 textarea(放在占卜師 + 解讀深度之下) */}
                <QuestionInspirations
                  selectedCategoryId={selectedCategory}
                  onPickQuestion={(text, catId) => {
                    setUserQuestion(text);
                    if (catId !== selectedCategory) setSelectedCategory(catId);
                    if (typeof window !== "undefined") {
                      requestAnimationFrame(() => {
                        const ta = document.getElementById(
                          "question-textarea"
                        ) as HTMLTextAreaElement | null;
                        ta?.focus();
                        ta?.scrollIntoView({ behavior: "smooth", block: "center" });
                      });
                    }
                  }}
                />

                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={() => setStep("category")}
                    style={{
                      padding: "10px 24px", borderRadius: 9999, border: "1px solid rgba(212,168,85,0.3)",
                      color: "#d4a855", fontSize: 14, background: "none", cursor: "pointer",
                    }}>
                    {t("返回", "Back", "戻る", "뒤로")}
                  </button>
                  <button onClick={handleQuestionSubmit} disabled={!userQuestion.trim()}
                    className="btn-gold" style={{ flex: 1, fontSize: 16 }}>
                    {t("開始占卜", "Begin Divination", "占いを始める", "점 시작")}
                  </button>
                </div>

                {/* 免責聲明 */}
                <p
                  style={{
                    marginTop: 16,
                    color: "rgba(192,192,208,0.5)",
                    fontSize: 11,
                    lineHeight: 1.7,
                    textAlign: "center",
                  }}
                >
                  {t(
                    "占卜結果僅供娛樂與自我參考,請勿作為投資、醫療、法律或重大人生決策之依據。",
                    "Readings are for entertainment and self-reflection only. Not a basis for investment, medical, legal, or major life decisions."
                  )}
                  <br />
                  <Link
                    href="/terms"
                    style={{
                      color: "rgba(212,168,85,0.7)",
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                  >
                    {t(
                      "詳閱服務條款與免責聲明",
                      "Read full terms & disclaimer",
                      "利用規約と免責事項を読む",
                      "이용약관 및 면책조항 읽기"
                    )}
                  </Link>
                </p>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 2.25: Divine Type Select (易經 / 塔羅) ===== */}
          {step === "divine-type" && (
            <motion.div key="dt" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 24 }}>
                <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif" }}>
                  {t(
                    "選擇占卜工具",
                    "Choose Your Method",
                    "占いツールを選ぶ",
                    "점 도구 선택"
                  )}
                </h2>
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 13, marginTop: 6 }}>
                  {t(
                    "兩種系統皆以你提出的問題為核心給出指引",
                    "Both systems will center on the question you asked",
                    "どちらのシステムもあなたの質問を中心に導きを示します",
                    "두 시스템 모두 당신의 질문을 중심으로 답을 줍니다"
                  )}
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                {/* 易經 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDivineTypeSelect("iching")}
                  className="mystic-card"
                  style={{
                    padding: 20,
                    textAlign: "left",
                    cursor: "pointer",
                    border: "1px solid rgba(212,168,85,0.2)",
                    background: "rgba(13,13,43,0.8)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 32 }}>☯</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#d4a855", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                        {t("易經占卜", "I Ching", "易経占い", "주역 점")}
                      </div>
                      <div style={{ color: "rgba(192,192,208,0.7)", fontSize: 13, lineHeight: 1.5 }}>
                        {t(
                          "擲銅錢成卦,由六十四卦卦辭為你指點方向",
                          "Throw coins to form a hexagram; guidance from the 64 hexagrams"
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>

                {/* 塔羅 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDivineTypeSelect("tarot")}
                  className="mystic-card"
                  style={{
                    padding: 20,
                    textAlign: "left",
                    cursor: "pointer",
                    border: "1px solid rgba(212,168,85,0.2)",
                    background: "rgba(13,13,43,0.8)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 32 }}>🎴</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#d4a855", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                        {t("塔羅占卜", "Tarot", "タロット占い", "타로 점")}
                      </div>
                      <div style={{ color: "rgba(192,192,208,0.7)", fontSize: 13, lineHeight: 1.5 }}>
                        {t(
                          "從 5 種經典牌陣中挑一個,以七十八張塔羅為你解讀",
                          "Pick one of 5 classic spreads — read with the 78-card tarot deck"
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              </div>

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button
                  onClick={() => setStep("question")}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 9999,
                    border: "1px solid rgba(212,168,85,0.3)",
                    color: "#d4a855",
                    fontSize: 13,
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  {t(
                    "返回修改問題",
                    "Back to edit question",
                    "質問を編集に戻る",
                    "질문 수정하러 돌아가기"
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 2.6: Tarot Spread Select (依牌陣抽牌) ===== */}
          {step === "tarot-spread-select" && (
            <motion.div key="ssel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 16 }}>
                <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif" }}>
                  {t(
                    "選擇塔羅牌陣",
                    "Choose Your Tarot Spread",
                    "タロット スプレッドを選ぶ",
                    "타로 스프레드 선택"
                  )}
                </h2>
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 13, marginTop: 6, lineHeight: 1.7 }}>
                  {t(
                    "不同問題適合不同牌陣 — 5 / 10 / 12 張需要會員",
                    "Different questions, different spreads — 5/10/12-card spreads need sign-in"
                  )}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {SPREADS.map((s) => {
                  const thumb = uiImages[spreadImageSlot(s.id)];
                  const lockedForGuest = !isSignedIn && s.cardCount > 3;
                  return (
                    <motion.button
                      key={s.id}
                      whileHover={{ scale: lockedForGuest ? 1 : 1.01 }}
                      whileTap={{ scale: lockedForGuest ? 1 : 0.99 }}
                      onClick={() => {
                        if (lockedForGuest) {
                          setLoginModalOpen(true);
                          return;
                        }
                        handleSelectSpread(s.id);
                      }}
                      className="mystic-card"
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: 14,
                        textAlign: "left",
                        cursor: lockedForGuest ? "default" : "pointer",
                        opacity: lockedForGuest ? 0.65 : 1,
                        border: "1px solid rgba(212,168,85,0.2)",
                        background: "rgba(13,13,43,0.8)",
                      }}
                    >
                      {/* 沒上傳就完全不渲染這個區塊,保持版面乾淨 */}
                      {thumb && (
                        <div
                          style={{
                            width: 72,
                            flexShrink: 0,
                            aspectRatio: "1 / 1",
                            borderRadius: 10,
                            overflow: "hidden",
                            border: "1px solid rgba(212,168,85,0.25)",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumb}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
                          <div style={{ color: "#d4a855", fontWeight: 600, fontSize: 15, fontFamily: "'Noto Serif TC', serif" }}>
                            {t(s.nameZh, s.nameEn, s.nameJa, s.nameKo)}
                            {/* 第二語名 — 中文使用者顯示英文,其他語系顯示英文(讓使用者對照) */}
                            <span style={{ color: "rgba(192,192,208,0.5)", fontSize: 11, marginLeft: 6, fontStyle: "italic", fontWeight: 400 }}>
                              {locale === "en" ? s.nameZh : s.nameEn}
                            </span>
                          </div>
                          <span style={{ color: "rgba(212,168,85,0.7)", fontSize: 11, whiteSpace: "nowrap" }}>
                            {t(`${s.cardCount} 張`, `${s.cardCount} cards`, `${s.cardCount}枚`, `${s.cardCount}장`)}
                          </span>
                        </div>
                        <p style={{ color: "rgba(192,192,208,0.75)", fontSize: 12, lineHeight: 1.55, margin: "4px 0 0" }}>
                          {t(s.taglineZh, s.taglineEn, s.taglineJa, s.taglineKo)}
                        </p>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                          <Link
                            href={`/tarot-spread/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              color: "rgba(212,168,85,0.85)",
                              fontSize: 11,
                              textDecoration: "none",
                              borderBottom: "1px dashed rgba(212,168,85,0.4)",
                              paddingBottom: 1,
                            }}
                          >
                            {t(
                              "看詳細介紹 →",
                              "Details →",
                              "詳細を見る →",
                              "자세히 보기 →"
                            )}
                          </Link>
                          {lockedForGuest && (
                            <span style={{ color: "#fde68a", fontSize: 11 }}>
                              🔒 {t(
                                "登入會員可解鎖",
                                "Sign in to unlock",
                                "ログインで解除",
                                "로그인 시 잠금 해제"
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button
                  onClick={() => setStep("divine-type")}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 9999,
                    border: "1px solid rgba(212,168,85,0.3)",
                    color: "#d4a855",
                    fontSize: 13,
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  {t(
                    "返回選擇工具",
                    "Back to choose oracle",
                    "ツール選択に戻る",
                    "도구 선택으로 돌아가기"
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 2.5: Mode Select (自動 / 手動) ===== */}
          {step === "mode-select" && (
            <motion.div key="mode" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 24 }}>
                <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif" }}>
                  {t(
                    "選擇占卜方式",
                    "Choose Divination Mode",
                    "占い方法を選ぶ",
                    "점치는 방식 선택"
                  )}
                </h2>
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 13, marginTop: 6 }}>
                  {t(
                    "兩種方式都能得到相同品質的卦象",
                    "Both modes produce the same quality reading",
                    "どちらの方式も同じ品質の卦象が得られます",
                    "두 방식 모두 같은 품질의 점괘를 얻습니다"
                  )}
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                {/* 自動占卜 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleModeSelect("auto")}
                  className="mystic-card"
                  style={{
                    padding: 20,
                    textAlign: "left",
                    cursor: "pointer",
                    border:
                      lastModePref === "auto"
                        ? "1.5px solid rgba(212,168,85,0.6)"
                        : "1px solid rgba(212,168,85,0.2)",
                    background: "rgba(13,13,43,0.8)",
                    position: "relative",
                  }}
                >
                  {lastModePref === "auto" && (
                    <span
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 12,
                        fontSize: 11,
                        color: "#d4a855",
                        background: "rgba(212,168,85,0.12)",
                        padding: "3px 10px",
                        borderRadius: 9999,
                      }}
                    >
                      {t("上次選擇", "Last used", "前回の選択", "최근 선택")}
                    </span>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 32 }}>⚡</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#d4a855", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                        {t("自動占卜", "Auto", "自動占い", "자동 점")}
                      </div>
                      <div style={{ color: "rgba(192,192,208,0.7)", fontSize: 13, lineHeight: 1.5 }}>
                        {t(
                          "按一下,系統連續擲出六個爻(約 3 秒完成)",
                          "One click — system throws all six lines in sequence (~3 seconds)"
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>

                {/* 手動占卜 */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleModeSelect("manual")}
                  className="mystic-card"
                  style={{
                    padding: 20,
                    textAlign: "left",
                    cursor: "pointer",
                    border:
                      lastModePref === "manual"
                        ? "1.5px solid rgba(212,168,85,0.6)"
                        : "1px solid rgba(212,168,85,0.2)",
                    background: "rgba(13,13,43,0.8)",
                    position: "relative",
                  }}
                >
                  {lastModePref === "manual" && (
                    <span
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 12,
                        fontSize: 11,
                        color: "#d4a855",
                        background: "rgba(212,168,85,0.12)",
                        padding: "3px 10px",
                        borderRadius: 9999,
                      }}
                    >
                      {t("上次選擇", "Last used", "前回の選択", "최근 선택")}
                    </span>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 32 }}>🪙</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#d4a855", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                        {t("手動占卜", "Manual", "手動占い", "수동 점")}
                      </div>
                      <div style={{ color: "rgba(192,192,208,0.7)", fontSize: 13, lineHeight: 1.5 }}>
                        {t(
                          "親手擲六次,感受每一爻的儀式感",
                          "Throw the coins six times yourself, one line at a time"
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              </div>

              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button
                  onClick={() => setStep("divine-type")}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 9999,
                    border: "1px solid rgba(212,168,85,0.3)",
                    color: "#d4a855",
                    fontSize: 13,
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  {t(
                    "返回選擇工具",
                    "Back to choose oracle",
                    "ツール選択に戻る",
                    "도구 선택으로 돌아가기"
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 3: Coin Throwing ===== */}
          {step === "divination" && (
            <motion.div key="div" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 16 }}>
                <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif" }}>
                  {t("擲銅錢", "Throw the Coins", "銅銭を投げる", "동전 던지기")}
                </h2>
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 14, marginTop: 4 }}>
                  {t(`第 ${currentThrow + 1} 爻（共 6 爻）`, `Line ${currentThrow + 1} of 6`)}
                </p>
              </div>

              {/* Progress dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
                {[0,1,2,3,4,5].map((i) => (
                  <div key={i} style={{
                    width: 12, height: 12, borderRadius: "50%",
                    background: i < throws.length ? "#d4a855" : i === currentThrow ? "rgba(212,168,85,0.5)" : "rgba(192,192,208,0.2)",
                    transition: "all 0.3s",
                  }} />
                ))}
              </div>

              <div className="mystic-card" style={{ padding: 32 }}>
                <CoinAnimation coins={currentCoins} isFlipping={isFlipping} />
                {throws.length > 0 && (
                  <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
                    <HexagramDisplay
                      lines={[...throws.map((t) => t.lineValue), ...Array(6 - throws.length).fill(0)]}
                      size="sm" animate={false}
                    />
                  </div>
                )}
              </div>

              <div style={{ textAlign: "center", marginTop: 24 }}>
                {divinationMode === "auto" ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "14px 32px",
                      borderRadius: 9999,
                      background: "rgba(212,168,85,0.12)",
                      border: "1px solid rgba(212,168,85,0.3)",
                      color: "#d4a855",
                      fontSize: 16,
                    }}
                  >
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      style={{ display: "inline-block" }}
                    >
                      ☯
                    </motion.span>
                    <span>
                      {throws.length >= 6
                        ? t(
                            "占卜完成,正在為您解讀...",
                            "Divination complete, reading...",
                            "占い完了。解読中…",
                            "점 완료. 해석 중…"
                          )
                        : t(
                            "自動占卜進行中...",
                            "Auto divination in progress...",
                            "自動占い進行中…",
                            "자동 점 진행 중…"
                          )}
                    </span>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleThrowCoins(false)}
                    disabled={isFlipping || currentThrow >= 6}
                    className="btn-gold"
                    style={{ fontSize: 18, padding: "14px 48px" }}
                  >
                    {isFlipping
                      ? t("擲銅錢中...", "Throwing...", "投擲中…", "던지는 중…")
                      : t("擲銅錢", "Throw Coins", "銅銭を投げる", "동전 던지기")}
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {/* ===== STEP 3T: Tarot Reveal (抽牌 + 翻牌) ===== */}
          {step === "tarot-reveal" && drawnCards.length > 0 && (() => {
            const spread = getSpread(selectedSpreadId ?? DEFAULT_SPREAD_ID);
            if (drawnCards.length !== spread.cardCount) return null;
            // 3 張用 3 欄,5/10/12 張用 5 欄壓密(讓 12 張仍能塞進手機螢幕)
            const cols = spread.cardCount <= 3 ? 3 : 5;
            const positionsHint =
              spread.positions
                .slice(0, 3)
                .map((p) => t(p.labelZh, p.labelEn, p.labelJa, p.labelKo))
                .join(" → ") + (spread.positions.length > 3 ? "…" : "");
            return (
            <motion.div key="tarot" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 16 }}>
                <div style={{ color: "rgba(212,168,85,0.7)", fontSize: 12, marginBottom: 4, letterSpacing: 1 }}>
                  {t(spread.nameZh, spread.nameEn, spread.nameJa, spread.nameKo)} · {spread.cardCount} {t("張", "cards", "枚", "장")}
                </div>
                <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif" }}>
                  {t("翻牌揭示", "Reveal Your Cards", "カードをめくる", "카드 펼치기")}
                </h2>
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 14, marginTop: 4 }}>
                  {revealedCount === 0
                    ? t(
                        `依序點擊牌卡翻開(${positionsHint})`,
                        `Tap each card in order (${positionsHint})`,
                        `順番にカードをタップしてめくる(${positionsHint})`,
                        `순서대로 카드를 탭해 펼치세요 (${positionsHint})`
                      )
                    : revealedCount < spread.cardCount
                    ? t(
                        `已翻開 ${revealedCount} / ${spread.cardCount} 張`,
                        `Revealed ${revealedCount} of ${spread.cardCount}`,
                        `${revealedCount} / ${spread.cardCount} 枚をめくりました`,
                        `${revealedCount} / ${spread.cardCount}장 펼쳤습니다`
                      )
                    : t(
                        `${spread.cardCount} 張牌已揭示,老師正在為你解讀...`,
                        `All ${spread.cardCount} cards revealed. Reading now...`,
                        `${spread.cardCount}枚すべて揭示されました。解読中...`,
                        `${spread.cardCount}장 모두 펼쳤습니다. 해석 중...`
                      )}
                </p>
              </div>

              {/* 牌組 — 依 spread.cardCount 決定欄數 */}
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: cols >= 5 ? 6 : 10,
                marginTop: 16,
              }}>
                {drawnCards.map((drawn, idx) => {
                  const isRevealed = idx < revealedCount;
                  const isNext = idx === revealedCount;
                  const pos = spread.positions[idx];
                  const cardName = t(drawn.card.nameZh, drawn.card.nameEn, drawn.card.nameJa, drawn.card.nameKo);
                  const suitName = t(
                    SUIT_NAMES_ZH[drawn.card.suit],
                    SUIT_NAMES_EN[drawn.card.suit],
                    SUIT_NAMES_JA[drawn.card.suit],
                    SUIT_NAMES_KO[drawn.card.suit]
                  );
                  const orientationLabel = drawn.isReversed
                    ? t("逆位", "Reversed", "逆位置", "역방향")
                    : t("正位", "Upright", "正位置", "정방향");

                  return (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {/* 位置標籤 */}
                      <div style={{
                        color: "#d4a855",
                        fontSize: 13,
                        fontFamily: "'Noto Serif TC', serif",
                        marginBottom: 8,
                        textAlign: "center",
                      }}>
                        {t(pos.labelZh, pos.labelEn, pos.labelJa, pos.labelKo)}
                      </div>

                      {/* 翻牌卡(CSS 3D flip) */}
                      <motion.button
                        onClick={() => handleRevealCard(idx)}
                        disabled={!isNext && !isRevealed}
                        whileHover={isNext ? { scale: 1.04 } : {}}
                        whileTap={isNext ? { scale: 0.96 } : {}}
                        style={{
                          width: "100%",
                          aspectRatio: "2 / 3.5",
                          padding: 0,
                          border: "none",
                          background: "transparent",
                          cursor: isNext ? "pointer" : "default",
                          perspective: 1000,
                        }}
                      >
                        <motion.div
                          animate={{ rotateY: isRevealed ? 180 : 0 }}
                          transition={{ duration: 0.7, ease: "easeInOut" }}
                          style={{
                            width: "100%",
                            height: "100%",
                            position: "relative",
                            transformStyle: "preserve-3d",
                          }}
                        >
                          {/* 牌背 */}
                          <div style={{
                            position: "absolute",
                            inset: 0,
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            borderRadius: 8,
                            overflow: "hidden",
                            border: isNext
                              ? "1.5px solid rgba(212,168,85,0.8)"
                              : "1px solid rgba(212,168,85,0.25)",
                            boxShadow: isNext
                              ? "0 0 18px rgba(212,168,85,0.45)"
                              : "0 2px 8px rgba(0,0,0,0.4)",
                            background: "rgba(13,13,43,0.9)",
                          }}>
                            <img
                              src={CARD_BACK_IMAGE}
                              alt="Card back"
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                          </div>

                          {/* 牌面 */}
                          <div style={{
                            position: "absolute",
                            inset: 0,
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            transform: "rotateY(180deg)",
                            borderRadius: 8,
                            overflow: "hidden",
                            border: "1px solid rgba(212,168,85,0.4)",
                            boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
                            background: "rgba(13,13,43,0.9)",
                          }}>
                            <img
                              src={drawn.card.imagePath}
                              alt={cardName}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                                transform: drawn.isReversed ? "rotate(180deg)" : "none",
                              }}
                            />
                          </div>
                        </motion.div>
                      </motion.button>

                      {/* 翻開後顯示:牌名 + 正逆位 */}
                      {isRevealed && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          style={{ marginTop: 8, textAlign: "center" }}
                        >
                          <div style={{
                            color: "#e8e8f0",
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: "'Noto Serif TC', serif",
                            lineHeight: 1.3,
                          }}>
                            {cardName}
                          </div>
                          <div style={{
                            color: drawn.isReversed ? "#f59e7a" : "#d4a855",
                            fontSize: 10,
                            marginTop: 2,
                          }}>
                            {suitName} · {orientationLabel}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ textAlign: "center", marginTop: 24 }}>
                <button
                  onClick={() => {
                    // 退回上一步:已選 spread → 回牌陣選單;沒選 → 回 divine-type
                    setDrawnCards([]);
                    setRevealedCount(0);
                    setStep("tarot-spread-select");
                  }}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 9999,
                    border: "1px solid rgba(212,168,85,0.3)",
                    color: "#d4a855",
                    fontSize: 13,
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  {t(
                    "返回選擇牌陣",
                    "Back to choose spread",
                    "スプレッド選択に戻る",
                    "스프레드 선택으로 돌아가기"
                  )}
                </button>
              </div>
            </motion.div>
            );
          })()}

          {/* ===== STEP 4a: Result (易經) ===== */}
          {step === "result" && divineType !== "tarot" && hexagram && (
            <motion.div key="res" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {/* Hexagram card */}
              <div className="mystic-card" style={{ padding: 32, textAlign: "center", marginTop: 16 }}>
                <h2 className="text-gold-gradient" style={{ fontSize: 24, fontFamily: "'Noto Serif TC', serif" }}>
                  {t(
                    `第${hexagram.number}卦 ${hexagram.nameZh}`,
                    `Hexagram ${hexagram.number}: ${hexagram.nameEn}`,
                    `第${hexagram.number}卦 ${hexagram.nameJa ?? hexagram.nameZh}`,
                    `제 ${hexagram.number}괘 ${hexagram.nameKo ?? hexagram.nameEn.split(" ")[0]}`
                  )}
                </h2>

                <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 24 }}>
                  <div>
                    <HexagramDisplay lines={divinationResult?.primaryLines || []} changingLines={divinationResult?.changingLines} size="md" />
                    <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 12 }}>{t("本卦", "Primary", "本卦", "본괘")}</p>
                  </div>
                  {relatingHexagram && divinationResult?.relatingLines && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", color: "rgba(212,168,85,0.4)", fontSize: 24 }}>→</div>
                      <div>
                        <HexagramDisplay lines={divinationResult.relatingLines} size="md" />
                        <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 12 }}>
                          {t(
                            `之卦 ${relatingHexagram.nameZh}`,
                            `Relating: ${relatingHexagram.nameEn}`,
                            `之卦 ${relatingHexagram.nameJa ?? relatingHexagram.nameZh}`,
                            `지괘 ${relatingHexagram.nameKo ?? relatingHexagram.nameEn.split(" ")[0]}`
                          )}
                        </p>
                      </div>
                    </>
                  )}
                </div>

              </div>

              {/* 卦辭 Judgment Section — 古漢語跨語系統一顯示原文 + 對應語系現代訳 */}
              <div className="mystic-card" style={{ padding: 24, marginTop: 16 }}>
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                  {t("卦辭", "Judgment", "卦辞", "괘사")}
                </h3>
                <p style={{ color: "#e8e8f0", fontSize: 15, fontWeight: 700, fontFamily: "'Noto Serif TC', serif", lineHeight: 1.8, marginBottom: 8 }}>
                  {hexagram.judgmentZh}
                </p>
                <p style={{ color: "rgba(192,192,208,0.8)", fontSize: 14, lineHeight: 1.8 }}>
                  {t(
                    hexagram.judgmentVernacularZh,
                    hexagram.judgmentEn,
                    hexagram.judgmentJa,
                    hexagram.judgmentKo
                  )}
                </p>
              </div>

              {/* 象辭 Image Section */}
              <div className="mystic-card" style={{ padding: 24, marginTop: 16 }}>
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                  {t("象辭", "Image", "象辞", "상사")}
                </h3>
                <p style={{ color: "#e8e8f0", fontSize: 15, fontWeight: 700, fontFamily: "'Noto Serif TC', serif", lineHeight: 1.8, marginBottom: 8 }}>
                  {hexagram.imageZh}
                </p>
                <p style={{ color: "rgba(192,192,208,0.8)", fontSize: 14, lineHeight: 1.8 }}>
                  {t(
                    hexagram.imageVernacularZh,
                    hexagram.imageEn,
                    hexagram.imageJa,
                    hexagram.imageKo
                  )}
                </p>
              </div>

              {/* AI Analysis - clearly marked */}
              <div className="mystic-card" style={{ padding: 24, marginTop: 16, borderLeft: "3px solid #d4a855" }}>
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                  ✦ {t("老師解盤", "Master's Reading", "占い師の解読", "선생님의 해석")}
                </h3>

                {isLoadingAI && !aiReading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "24px 0" }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      style={{ fontSize: 24 }}>☯</motion.div>
                    <span style={{ color: "rgba(192,192,208,0.6)", fontSize: 14 }}>
                      {t(
                        "正在為您分析...",
                        "Analyzing for you...",
                        "解読中…",
                        "해석 중…"
                      )}
                    </span>
                  </div>
                ) : (
                  <div style={{ color: "rgba(192,192,208,0.9)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                    {aiReading}
                    {isLoadingAI && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        style={{ display: "inline-block", width: 6, height: 16, background: "#d4a855", marginLeft: 2, verticalAlign: "middle" }}
                      />
                    )}
                  </div>
                )}

                {/* 免責聲明 小字 */}
                {!isLoadingAI && aiReading && (
                  <p
                    style={{
                      marginTop: 14,
                      paddingTop: 10,
                      borderTop: "1px dashed rgba(212,168,85,0.15)",
                      color: "rgba(192,192,208,0.5)",
                      fontSize: 11,
                      lineHeight: 1.7,
                      fontStyle: "italic",
                    }}
                  >
                    {t(
                      "※ 僅供參考,不構成投資、醫療、法律或重大決策之建議。",
                      "※ For reference only. Not investment, medical, legal, or major life decision advice.",
                      "※ 参考のみ。投資・医療・法律・人生の重要な決断のアドバイスではありません。",
                      "※ 참고용입니다. 투자·의료·법률·인생의 중대한 결정의 조언이 아닙니다."
                    )}
                  </p>
                )}
              </div>

              {/* Share card download + public link */}
              {!isLoadingAI && aiReading && (
                <div className="mystic-card" style={{ padding: 20, marginTop: 16 }}>
                  <h3 style={{ fontSize: 15, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                    📤 {t(
                      "分享這次占卜",
                      "Share this divination",
                      "この占いをシェア",
                      "이 점 공유하기"
                    )}
                  </h3>

                  {/* v1: 下載分享圖 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <p style={{ flex: "1 1 200px", color: "rgba(192,192,208,0.7)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                      {isActive
                        ? t(
                            "📥 下載無浮水印分享圖（付費會員專屬）",
                            "📥 Clean share image (premium member perk)",
                            "📥 透かしなしの共有画像をダウンロード(有料会員限定)",
                            "📥 워터마크 없는 공유 이미지 다운로드(유료 회원 전용)"
                          )
                        : t(
                            "📥 下載分享圖（免費版含浮水印，升級即可移除）",
                            "📥 Download share image (free version has watermark)",
                            "📥 共有画像をダウンロード(無料版は透かし入り、アップグレードで除去可)",
                            "📥 공유 이미지 다운로드(무료 버전은 워터마크, 업그레이드 시 제거)"
                          )}
                    </p>
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className="btn-gold"
                      style={{ fontSize: 14, padding: "10px 20px", flexShrink: 0 }}
                    >
                      {isSharing
                        ? t("產生中…", "Generating…", "生成中…", "생성 중…")
                        : t("下載分享圖", "Download", "ダウンロード", "다운로드")}
                    </button>
                  </div>

                  {/* v2: 公開分享連結 */}
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: "1px dashed rgba(212,168,85,0.2)",
                    }}
                  >
                    {!divinationId || !isSignedIn ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <p style={{ flex: "1 1 200px", color: "rgba(192,192,208,0.7)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                          🔗 {t(
                            "登入會員即可產生公開分享連結（這筆占卜會幫你保留）",
                            "Sign in to generate a public share link (this reading will be kept)"
                          )}
                        </p>
                        <button
                          onClick={handleLoginForShare}
                          className="btn-gold"
                          style={{ fontSize: 13, padding: "8px 18px", flexShrink: 0 }}
                        >
                          {t("登入", "Sign in", "ログイン", "로그인")}
                        </button>
                      </div>
                    ) : !isPublic ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <p style={{ flex: "1 1 200px", color: "rgba(192,192,208,0.7)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                          🔗 {t(
                            "產生公開分享連結（匿名公開，不露出你的帳號資訊）",
                            "Generate public share link (anonymous, no account info revealed)"
                          )}
                        </p>
                        <button
                          onClick={handleTogglePublic}
                          disabled={isTogglingPublic}
                          style={{
                            padding: "10px 20px",
                            borderRadius: 9999,
                            border: "1px solid rgba(212,168,85,0.4)",
                            background: "rgba(212,168,85,0.08)",
                            color: "#d4a855",
                            fontSize: 14,
                            cursor: isTogglingPublic ? "default" : "pointer",
                            flexShrink: 0,
                            fontFamily: "'Noto Sans TC', sans-serif",
                          }}
                        >
                          {isTogglingPublic
                            ? t("開啟中…", "Enabling…", "有効化中…", "활성화 중…")
                            : t(
                                "🔓 開啟分享連結",
                                "🔓 Enable share link",
                                "🔓 共有リンクを有効化",
                                "🔓 공유 링크 활성화"
                              )}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 12px",
                            background: "rgba(10,10,26,0.6)",
                            border: "1px solid rgba(212,168,85,0.25)",
                            borderRadius: 10,
                            marginBottom: 10,
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              color: "#fde68a",
                              fontSize: 13,
                              fontFamily: "monospace",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {typeof window !== "undefined"
                              ? `${window.location.origin}/r/${divinationId}`
                              : `/r/${divinationId}`}
                          </span>
                          <button
                            onClick={handleCopyLink}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "none",
                              background:
                                copyStatus === "copied"
                                  ? "rgba(74,222,128,0.3)"
                                  : "rgba(212,168,85,0.25)",
                              color: copyStatus === "copied" ? "#86efac" : "#fde68a",
                              fontSize: 12,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {copyStatus === "copied"
                              ? t("已複製 ✓", "Copied ✓", "コピー済み ✓", "복사됨 ✓")
                              : t("複製", "Copy", "コピー", "복사")}
                          </button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "rgba(192,192,208,0.5)", fontSize: 11 }}>
                            {t(
                              "✨ 貼到 Line / Twitter / FB 會自動展開預覽卡",
                              "✨ Unfurls into a preview card on Line / Twitter / FB"
                            )}
                          </span>
                          <button
                            onClick={handleTogglePublic}
                            disabled={isTogglingPublic}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 9999,
                              border: "1px solid rgba(192,192,208,0.2)",
                              background: "transparent",
                              color: "rgba(192,192,208,0.6)",
                              fontSize: 11,
                              cursor: isTogglingPublic ? "default" : "pointer",
                              flexShrink: 0,
                            }}
                          >
                            {isTogglingPublic
                              ? t("關閉中…", "Disabling…", "無効化中…", "비활성화 중…")
                              : t(
                                  "🔒 關閉公開",
                                  "🔒 Make private",
                                  "🔒 非公開にする",
                                  "🔒 비공개로 전환"
                                )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {shareMessage && (
                    <div style={{ marginTop: 10, fontSize: 13, color: "#fde68a" }}>
                      {shareMessage}
                    </div>
                  )}
                </div>
              )}

              {/* 已完成的衍伸占卜鏈 */}
              {renderFollowUpChain()}

              {/* Chat with Master */}
              <div
                data-chat-box
                className="mystic-card"
                style={{ padding: 16, marginTop: 16, overflow: "hidden", scrollMarginTop: 80 }}
              >
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12, paddingLeft: 4 }}>
                  {t("繼續請教老師", "Ask the Master", "占い師に質問する", "선생님께 물어보기")}
                </h3>

                {/* Chat messages */}
                {chatMessages.length > 0 && (
                  <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
                    {chatMessages.map((msg, i) => (
                      <div key={i} style={{
                        display: "flex",
                        justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                        marginBottom: 10,
                      }}>
                        <div style={{
                          maxWidth: "85%",
                          padding: "8px 12px",
                          borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          background: msg.role === "user" ? "rgba(212,168,85,0.2)" : "rgba(30,30,60,0.8)",
                          border: msg.role === "user" ? "1px solid rgba(212,168,85,0.3)" : "1px solid rgba(192,192,208,0.15)",
                          color: msg.role === "user" ? "#e8e0d0" : "rgba(192,192,208,0.9)",
                          fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap",
                        }}>
                          {msg.role === "assistant" && (
                            <span style={{ color: "#d4a855", fontSize: 12, display: "block", marginBottom: 2 }}>
                              {t("老師", "Master", "占い師", "선생님")}
                            </span>
                          )}
                          {msg.content}
                          {isChatLoading && i === chatMessages.length - 1 && msg.role === "assistant" && (
                            <motion.span
                              animate={{ opacity: [1, 0] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              style={{ display: "inline-block", width: 6, height: 14, background: "#d4a855", marginLeft: 2, verticalAlign: "middle" }}
                            />
                          )}
                          {msg.role === "assistant" &&
                            !(isChatLoading && i === chatMessages.length - 1) && (
                              <div
                                style={{
                                  marginTop: 8,
                                  paddingTop: 6,
                                  borderTop: "1px dashed rgba(212,168,85,0.15)",
                                  color: "rgba(192,192,208,0.45)",
                                  fontSize: 10,
                                  lineHeight: 1.6,
                                  fontStyle: "italic",
                                }}
                              >
                                {t(
                                  "※ 僅供參考,不構成投資、醫療、法律或重大決策之建議。",
                                  "※ For reference only. Not investment, medical, legal, or major life decision advice.",
                                  "※ 参考のみ。投資・医療・法律・人生の重要な決断のアドバイスではありません。",
                                  "※ 참고용입니다. 투자·의료·법률·인생의 중대한 결정의 조언이 아닙니다."
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}

                {/* Input area - mobile optimized */}
                <div style={{ display: "flex", gap: 6, width: "100%", boxSizing: "border-box" }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) sendChatMessage(); }}
                    placeholder={t(
                      "想問老師什麼呢...",
                      "Ask the master...",
                      "占い師に聞きたいこと…",
                      "선생님께 물어볼 것…"
                    )}
                    disabled={isChatLoading || isLoadingAI}
                    style={{
                      flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10,
                      background: "rgba(10,10,26,0.5)", border: "1px solid rgba(212,168,85,0.2)",
                      color: "white", fontSize: 14, outline: "none",
                      fontFamily: "'Noto Sans TC', sans-serif",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || isChatLoading || isLoadingAI}
                    style={{
                      flexShrink: 0, padding: "10px 14px", borderRadius: 10,
                      background: chatInput.trim() && !isChatLoading ? "linear-gradient(135deg, #d4a855, #b8860b)" : "rgba(212,168,85,0.2)",
                      border: "none", color: chatInput.trim() && !isChatLoading ? "#1a1a2e" : "rgba(192,192,208,0.4)",
                      fontSize: 14, fontWeight: 600, cursor: chatInput.trim() && !isChatLoading ? "pointer" : "default",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("送出", "Send", "送信", "보내기")}
                  </button>
                </div>

                {/* 衍伸問題繼續占卜 CTA(在聊天框內,與聊天功能並列) */}
                {renderFollowUpCTA()}
              </div>

              {/* Actions */}
              <div style={{ marginTop: 16 }}>
                <button onClick={handleReset} className="btn-gold" style={{ width: "100%", fontSize: 16 }}>
                  {t("重新占卜", "New Divination", "新しい占い", "새로운 점")}
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 4b: Result (塔羅) ===== */}
          {step === "result" && divineType === "tarot" && drawnCards.length > 0 && (() => {
            const spread = getSpread(selectedSpreadId ?? DEFAULT_SPREAD_ID);
            if (drawnCards.length !== spread.cardCount) return null;
            const cols = spread.cardCount <= 3 ? 3 : 5;
            const positionsHint = spread.positions
              .slice(0, 3)
              .map((p) => t(p.labelZh, p.labelEn, p.labelJa, p.labelKo))
              .join(" · ") + (spread.positions.length > 3 ? "…" : "");
            return (
            <motion.div key="res-tarot" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {/* 牌組展示 */}
              <div className="mystic-card" style={{ padding: 20, marginTop: 16 }}>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif" }}>
                    {t(spread.nameZh, spread.nameEn, spread.nameJa, spread.nameKo)}
                  </h2>
                  <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 4 }}>
                    {positionsHint}
                  </p>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: cols >= 5 ? 6 : 10,
                }}>
                  {drawnCards.map((drawn, idx) => {
                    const pos = spread.positions[idx];
                    const cardName = t(drawn.card.nameZh, drawn.card.nameEn, drawn.card.nameJa, drawn.card.nameKo);
                    const suitName = t(
                      SUIT_NAMES_ZH[drawn.card.suit],
                      SUIT_NAMES_EN[drawn.card.suit],
                      SUIT_NAMES_JA[drawn.card.suit],
                      SUIT_NAMES_KO[drawn.card.suit]
                    );
                    const orientationLabel = drawn.isReversed
                      ? t("逆位", "Reversed", "逆位置", "역방향")
                      : t("正位", "Upright", "正位置", "정방향");
                    return (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                          color: "#d4a855",
                          fontSize: 13,
                          fontFamily: "'Noto Serif TC', serif",
                          marginBottom: 6,
                        }}>
                          {t(pos.labelZh, pos.labelEn, pos.labelJa, pos.labelKo)}
                        </div>
                        <div style={{
                          width: "100%",
                          aspectRatio: "2 / 3.5",
                          borderRadius: 8,
                          overflow: "hidden",
                          border: "1px solid rgba(212,168,85,0.4)",
                          boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
                          background: "rgba(13,13,43,0.9)",
                        }}>
                          <img
                            src={drawn.card.imagePath}
                            alt={cardName}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                              transform: drawn.isReversed ? "rotate(180deg)" : "none",
                            }}
                          />
                        </div>
                        <div style={{ marginTop: 6, textAlign: "center" }}>
                          <div style={{
                            color: "#e8e8f0",
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: "'Noto Serif TC', serif",
                            lineHeight: 1.3,
                          }}>
                            {cardName}
                          </div>
                          <div style={{
                            color: drawn.isReversed ? "#f59e7a" : "#d4a855",
                            fontSize: 10,
                            marginTop: 2,
                          }}>
                            {suitName} · {orientationLabel}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 每張牌的牌義 */}
              <div className="mystic-card" style={{ padding: 20, marginTop: 16 }}>
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                  {t("牌義速覽", "Card Meanings", "カード意味", "카드 의미")}
                </h3>
                {drawnCards.map((drawn, idx) => {
                  const pos = spread.positions[idx];
                  const cardName = t(drawn.card.nameZh, drawn.card.nameEn, drawn.card.nameJa, drawn.card.nameKo);
                  const meaning = drawn.isReversed
                    ? t(drawn.card.reversedMeaningZh, drawn.card.reversedMeaningEn, drawn.card.reversedMeaningJa, drawn.card.reversedMeaningKo)
                    : t(drawn.card.uprightMeaningZh, drawn.card.uprightMeaningEn, drawn.card.uprightMeaningJa, drawn.card.uprightMeaningKo);
                  const orientationLabel = drawn.isReversed
                    ? t("逆位", "Reversed", "逆位置", "역방향")
                    : t("正位", "Upright", "正位置", "정방향");
                  const isLast = idx === drawnCards.length - 1;
                  return (
                    <div key={idx} style={{
                      marginBottom: isLast ? 0 : 14,
                      paddingBottom: isLast ? 0 : 14,
                      borderBottom: isLast ? "none" : "1px dashed rgba(212,168,85,0.15)",
                    }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ color: "#d4a855", fontSize: 13, fontWeight: 600 }}>
                          {t(pos.labelZh, pos.labelEn, pos.labelJa, pos.labelKo)}
                        </span>
                        <span style={{ color: "#e8e8f0", fontSize: 14, fontWeight: 600, fontFamily: "'Noto Serif TC', serif" }}>
                          {cardName}
                        </span>
                        <span style={{
                          color: drawn.isReversed ? "#f59e7a" : "rgba(212,168,85,0.7)",
                          fontSize: 11,
                          padding: "1px 8px",
                          borderRadius: 9999,
                          background: drawn.isReversed ? "rgba(245,158,122,0.12)" : "rgba(212,168,85,0.08)",
                        }}>
                          {orientationLabel}
                        </span>
                      </div>
                      <p style={{ color: "rgba(192,192,208,0.85)", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                        {meaning}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* AI 解讀 */}
              <div className="mystic-card" style={{ padding: 24, marginTop: 16, borderLeft: "3px solid #d4a855" }}>
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                  ✦ {t("老師解盤", "Master's Reading", "占い師の解読", "선생님의 해석")}
                </h3>

                {isLoadingAI && !aiReading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "24px 0" }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      style={{ fontSize: 24 }}>🎴</motion.div>
                    <span style={{ color: "rgba(192,192,208,0.6)", fontSize: 14 }}>
                      {t(
                        "正在為您分析...",
                        "Analyzing for you...",
                        "解読中…",
                        "해석 중…"
                      )}
                    </span>
                  </div>
                ) : (
                  <div style={{ color: "rgba(192,192,208,0.9)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                    {aiReading}
                    {isLoadingAI && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        style={{ display: "inline-block", width: 6, height: 16, background: "#d4a855", marginLeft: 2, verticalAlign: "middle" }}
                      />
                    )}
                  </div>
                )}

                {/* 免責聲明 小字 */}
                {!isLoadingAI && aiReading && (
                  <p
                    style={{
                      marginTop: 14,
                      paddingTop: 10,
                      borderTop: "1px dashed rgba(212,168,85,0.15)",
                      color: "rgba(192,192,208,0.5)",
                      fontSize: 11,
                      lineHeight: 1.7,
                      fontStyle: "italic",
                    }}
                  >
                    {t(
                      "※ 僅供參考,不構成投資、醫療、法律或重大決策之建議。",
                      "※ For reference only. Not investment, medical, legal, or major life decision advice.",
                      "※ 参考のみ。投資・医療・法律・人生の重要な決断のアドバイスではありません。",
                      "※ 참고용입니다. 투자·의료·법률·인생의 중대한 결정의 조언이 아닙니다."
                    )}
                  </p>
                )}
              </div>

              {/* Share card download + public link(塔羅版) */}
              {!isLoadingAI && aiReading && (
                <div className="mystic-card" style={{ padding: 20, marginTop: 16 }}>
                  <h3 style={{ fontSize: 15, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                    📤 {t(
                      "分享這次占卜",
                      "Share this divination",
                      "この占いをシェア",
                      "이 점 공유하기"
                    )}
                  </h3>

                  {/* v1: 下載分享圖 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <p style={{ flex: "1 1 200px", color: "rgba(192,192,208,0.7)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                      {isActive
                        ? t(
                            "📥 下載無浮水印分享圖(付費會員專屬)",
                            "📥 Clean share image (premium member perk)",
                            "📥 透かしなしの共有画像をダウンロード(有料会員限定)",
                            "📥 워터마크 없는 공유 이미지 다운로드(유료 회원 전용)"
                          )
                        : t(
                            "📥 下載分享圖(免費版含浮水印,升級即可移除)",
                            "📥 Download share image (free version has watermark)",
                            "📥 共有画像をダウンロード(無料版は透かし入り、アップグレードで除去可)",
                            "📥 공유 이미지 다운로드(무료 버전은 워터마크, 업그레이드 시 제거)"
                          )}
                    </p>
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className="btn-gold"
                      style={{ fontSize: 14, padding: "10px 20px", flexShrink: 0 }}
                    >
                      {isSharing
                        ? t("產生中…", "Generating…", "生成中…", "생성 중…")
                        : t("下載分享圖", "Download", "ダウンロード", "다운로드")}
                    </button>
                  </div>

                  {/* v2: 公開分享連結 */}
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: "1px dashed rgba(212,168,85,0.2)",
                    }}
                  >
                    {!divinationId || !isSignedIn ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <p style={{ flex: "1 1 200px", color: "rgba(192,192,208,0.7)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                          🔗 {t(
                            "登入會員即可產生公開分享連結(這筆占卜會幫你保留)",
                            "Sign in to generate a public share link (this reading will be kept)"
                          )}
                        </p>
                        <button
                          onClick={handleLoginForShare}
                          className="btn-gold"
                          style={{ fontSize: 13, padding: "8px 18px", flexShrink: 0 }}
                        >
                          {t("登入", "Sign in", "ログイン", "로그인")}
                        </button>
                      </div>
                    ) : !isPublic ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <p style={{ flex: "1 1 200px", color: "rgba(192,192,208,0.7)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                          🔗 {t(
                            "產生公開分享連結(匿名公開,不露出你的帳號資訊)",
                            "Generate public share link (anonymous, no account info revealed)"
                          )}
                        </p>
                        <button
                          onClick={handleTogglePublic}
                          disabled={isTogglingPublic}
                          style={{
                            padding: "10px 20px",
                            borderRadius: 9999,
                            border: "1px solid rgba(212,168,85,0.4)",
                            background: "rgba(212,168,85,0.08)",
                            color: "#d4a855",
                            fontSize: 14,
                            cursor: isTogglingPublic ? "default" : "pointer",
                            flexShrink: 0,
                            fontFamily: "'Noto Sans TC', sans-serif",
                          }}
                        >
                          {isTogglingPublic
                            ? t("開啟中…", "Enabling…", "有効化中…", "활성화 중…")
                            : t(
                                "🔓 開啟分享連結",
                                "🔓 Enable share link",
                                "🔓 共有リンクを有効化",
                                "🔓 공유 링크 활성화"
                              )}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 12px",
                            background: "rgba(10,10,26,0.6)",
                            border: "1px solid rgba(212,168,85,0.25)",
                            borderRadius: 10,
                            marginBottom: 10,
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              color: "#fde68a",
                              fontSize: 13,
                              fontFamily: "monospace",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {typeof window !== "undefined"
                              ? `${window.location.origin}/r/${divinationId}`
                              : `/r/${divinationId}`}
                          </span>
                          <button
                            onClick={handleCopyLink}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "none",
                              background:
                                copyStatus === "copied"
                                  ? "rgba(74,222,128,0.3)"
                                  : "rgba(212,168,85,0.25)",
                              color: copyStatus === "copied" ? "#86efac" : "#fde68a",
                              fontSize: 12,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            {copyStatus === "copied"
                              ? t("已複製 ✓", "Copied ✓", "コピー済み ✓", "복사됨 ✓")
                              : t("複製", "Copy", "コピー", "복사")}
                          </button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "rgba(192,192,208,0.5)", fontSize: 11 }}>
                            {t(
                              "✨ 貼到 Line / Twitter / FB 會自動展開預覽卡",
                              "✨ Unfurls into a preview card on Line / Twitter / FB"
                            )}
                          </span>
                          <button
                            onClick={handleTogglePublic}
                            disabled={isTogglingPublic}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 9999,
                              border: "1px solid rgba(192,192,208,0.2)",
                              background: "transparent",
                              color: "rgba(192,192,208,0.6)",
                              fontSize: 11,
                              cursor: isTogglingPublic ? "default" : "pointer",
                              flexShrink: 0,
                            }}
                          >
                            {isTogglingPublic
                              ? t("關閉中…", "Disabling…", "無効化中…", "비활성화 중…")
                              : t(
                                  "🔒 關閉公開",
                                  "🔒 Make private",
                                  "🔒 非公開にする",
                                  "🔒 비공개로 전환"
                                )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {shareMessage && (
                    <div style={{ marginTop: 10, fontSize: 13, color: "#fde68a" }}>
                      {shareMessage}
                    </div>
                  )}
                </div>
              )}

              {/* 已完成的衍伸占卜鏈 */}
              {renderFollowUpChain()}

              {/* Chat with Master(塔羅版) */}
              <div
                data-chat-box
                className="mystic-card"
                style={{ padding: 16, marginTop: 16, overflow: "hidden", scrollMarginTop: 80 }}
              >
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12, paddingLeft: 4 }}>
                  {t("繼續請教老師", "Ask the Master", "占い師に質問する", "선생님께 물어보기")}
                </h3>

                {chatMessages.length > 0 && (
                  <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
                    {chatMessages.map((msg, i) => (
                      <div key={i} style={{
                        display: "flex",
                        justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                        marginBottom: 10,
                      }}>
                        <div style={{
                          maxWidth: "85%",
                          padding: "8px 12px",
                          borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          background: msg.role === "user" ? "rgba(212,168,85,0.2)" : "rgba(30,30,60,0.8)",
                          border: msg.role === "user" ? "1px solid rgba(212,168,85,0.3)" : "1px solid rgba(192,192,208,0.15)",
                          color: msg.role === "user" ? "#e8e0d0" : "rgba(192,192,208,0.9)",
                          fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap",
                        }}>
                          {msg.role === "assistant" && (
                            <span style={{ color: "#d4a855", fontSize: 12, display: "block", marginBottom: 2 }}>
                              {t("老師", "Master", "占い師", "선생님")}
                            </span>
                          )}
                          {msg.content}
                          {isChatLoading && i === chatMessages.length - 1 && msg.role === "assistant" && (
                            <motion.span
                              animate={{ opacity: [1, 0] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              style={{ display: "inline-block", width: 6, height: 14, background: "#d4a855", marginLeft: 2, verticalAlign: "middle" }}
                            />
                          )}
                          {msg.role === "assistant" &&
                            !(isChatLoading && i === chatMessages.length - 1) && (
                              <div
                                style={{
                                  marginTop: 8,
                                  paddingTop: 6,
                                  borderTop: "1px dashed rgba(212,168,85,0.15)",
                                  color: "rgba(192,192,208,0.45)",
                                  fontSize: 10,
                                  lineHeight: 1.6,
                                  fontStyle: "italic",
                                }}
                              >
                                {t(
                                  "※ 僅供參考,不構成投資、醫療、法律或重大決策之建議。",
                                  "※ For reference only. Not investment, medical, legal, or major life decision advice.",
                                  "※ 参考のみ。投資・医療・法律・人生の重要な決断のアドバイスではありません。",
                                  "※ 참고용입니다. 투자·의료·법률·인생의 중대한 결정의 조언이 아닙니다."
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, width: "100%", boxSizing: "border-box" }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) sendChatMessage(); }}
                    placeholder={t(
                      "想問老師什麼呢...",
                      "Ask the master...",
                      "占い師に聞きたいこと…",
                      "선생님께 물어볼 것…"
                    )}
                    disabled={isChatLoading || isLoadingAI}
                    style={{
                      flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: 10,
                      background: "rgba(10,10,26,0.5)", border: "1px solid rgba(212,168,85,0.2)",
                      color: "white", fontSize: 14, outline: "none",
                      fontFamily: "'Noto Sans TC', sans-serif",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || isChatLoading || isLoadingAI}
                    style={{
                      flexShrink: 0, padding: "10px 14px", borderRadius: 10,
                      background: chatInput.trim() && !isChatLoading ? "linear-gradient(135deg, #d4a855, #b8860b)" : "rgba(212,168,85,0.2)",
                      border: "none", color: chatInput.trim() && !isChatLoading ? "#1a1a2e" : "rgba(192,192,208,0.4)",
                      fontSize: 14, fontWeight: 600, cursor: chatInput.trim() && !isChatLoading ? "pointer" : "default",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t("送出", "Send", "送信", "보내기")}
                  </button>
                </div>

                {/* 衍伸問題繼續占卜 CTA(塔羅結果頁) */}
                {renderFollowUpCTA()}
              </div>

              {/* Actions */}
              <div style={{ marginTop: 16 }}>
                <button onClick={handleReset} className="btn-gold" style={{ width: "100%", fontSize: 16 }}>
                  {t("重新占卜", "New Divination", "新しい占い", "새로운 점")}
                </button>
              </div>
            </motion.div>
            );
          })()}
        </AnimatePresence>
      </main>

      {/* Hidden off-screen ShareCard — 只在 result step 渲染 */}
      {step === "result" &&
        divineType !== "tarot" &&
        hexagram &&
        divinationResult &&
        (() => {
          const cat = questionCategories.find((c) => c.id === selectedCategory);
          return (
            <div
              aria-hidden
              style={{
                position: "fixed",
                left: -99999,
                top: 0,
                pointerEvents: "none",
                opacity: 1,
              }}
            >
              <ShareCard
                ref={shareCardRef}
                divineType="iching"
                hexagram={hexagram}
                relatingHexagram={relatingHexagram}
                primaryLines={divinationResult.primaryLines}
                relatingLines={divinationResult.relatingLines}
                changingLines={divinationResult.changingLines}
                question={userQuestion}
                categoryIcon={cat?.icon ?? "🔮"}
                categoryNameZh={cat?.nameZh ?? "綜合"}
                categoryNameEn={cat?.nameEn ?? "General"}
                aiReading={aiReading}
                locale={locale === "zh" ? "zh" : "en"}
                showWatermark={!isActive}
              />
            </div>
          );
        })()}

      {/* Hidden off-screen ShareCard (塔羅版) */}
      {step === "result" &&
        divineType === "tarot" &&
        drawnCards.length > 0 &&
        (() => {
          const cat = questionCategories.find((c) => c.id === selectedCategory);
          const spread = getSpread(selectedSpreadId ?? DEFAULT_SPREAD_ID);
          if (drawnCards.length !== spread.cardCount) return null;
          return (
            <div
              aria-hidden
              style={{
                position: "fixed",
                left: -99999,
                top: 0,
                pointerEvents: "none",
                opacity: 1,
              }}
            >
              <ShareCard
                ref={shareCardRef}
                divineType="tarot"
                drawnCards={drawnCards}
                spreadId={spread.id}
                question={userQuestion}
                categoryIcon={cat?.icon ?? "🔮"}
                categoryNameZh={cat?.nameZh ?? "綜合"}
                categoryNameEn={cat?.nameEn ?? "General"}
                aiReading={aiReading}
                locale={locale === "zh" ? "zh" : "en"}
                showWatermark={!isActive}
              />
            </div>
          );
        })()}

      {/* Background decoration */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: -1 }}>
        <div style={{ position: "absolute", top: "25%", left: "25%", width: 384, height: 384, background: "rgba(88,28,135,0.1)", borderRadius: "50%", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", bottom: "25%", right: "25%", width: 320, height: 320, background: "rgba(49,46,129,0.1)", borderRadius: "50%", filter: "blur(48px)" }} />
      </div>
    </div>
  );
}
