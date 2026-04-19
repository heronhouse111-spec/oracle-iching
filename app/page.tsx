"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import HexagramDisplay from "@/components/HexagramDisplay";
import CoinAnimation from "@/components/CoinAnimation";
import ShareCard from "@/components/ShareCard";
import { performDivination, questionCategories, type DivinationResult, type CoinThrow } from "@/lib/divination";
import { findHexagram, getHexagramByNumber, type Hexagram } from "@/data/hexagrams";
import { saveDivination } from "@/lib/saveDivination";
import {
  drawThreeCards,
  getCardById,
  THREE_CARD_POSITIONS,
  SUIT_NAMES_ZH,
  SUIT_NAMES_EN,
  CARD_BACK_IMAGE,
  type DrawnCard,
} from "@/data/tarot";
import {
  savePendingDivination,
  loadPendingDivination,
  clearPendingDivination,
} from "@/lib/pendingDivination";

type Step =
  | "category"
  | "question"
  | "divine-type"
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

export default function Home() {
  const { locale, t } = useLanguage();

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
  const [isPublic, setIsPublic] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  // 占卜模式(auto/manual)+ 上次選擇(localStorage 記住)
  const [divinationMode, setDivinationMode] = useState<DivinationMode | null>(null);
  const [lastModePref, setLastModePref] = useState<DivinationMode | null>(null);

  // 占卜類型(易經 / 塔羅)
  const [divineType, setDivineType] = useState<DivineType | null>(null);

  // 塔羅 state:抽到的三張牌 + 已翻開幾張
  const [drawnCards, setDrawnCards] = useState<DrawnCard[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);

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
  useEffect(() => {
    if (step !== "result") return;
    if (isLoadingAI) return; // 串流中不寫,避免存到半截
    if (!aiReading) return;

    if (divineType === "tarot") {
      if (drawnCards.length !== 3) return;
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
      });
    }
  }, [
    step,
    isLoadingAI,
    aiReading,
    divineType,
    drawnCards,
    hexagram,
    relatingHexagram,
    divinationResult,
    selectedCategory,
    userQuestion,
    locale,
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
      const cards: DrawnCard[] = snap.tarot
        .map((tc) => {
          const card = getCardById(tc.cardId);
          return card ? { card, isReversed: tc.isReversed } : null;
        })
        .filter((x): x is DrawnCard => x !== null);
      if (cards.length === 3) {
        setDrawnCards(cards);
        setRevealedCount(3);
      }
    }

    setStep("result");

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

        const saved =
          snap.divineType === "tarot" && snap.tarot
            ? await saveDivination({
                divineType: "tarot",
                question: snap.userQuestion,
                category: snap.selectedCategory,
                tarotCards: snap.tarot.map((tc, i) => ({
                  cardId: tc.cardId,
                  // 快照裡沒存 position(drawnCards 順序就是 past-present-future)
                  position: THREE_CARD_POSITIONS[i].key as
                    | "past"
                    | "present"
                    | "future",
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

  // 訪客從結果頁直接按「登入」→ snapshot 已經被上面的 effect 寫入 sessionStorage,
  // 這邊只負責發 OAuth,redirectTo 就是當前網域(callback 預設回 "/"),mount 會撿 snapshot 復原。
  const handleLoginForShare = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
    } catch (e) {
      console.error("登入流程啟動失敗:", e);
      setShareMessage(t("登入失敗,請稍候再試", "Login failed, please retry"));
      setTimeout(() => setShareMessage(null), 3000);
    }
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
        t("切換失敗,請稍候再試", "Toggle failed, please try again")
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
      setShareMessage(t("複製失敗", "Copy failed"));
      setTimeout(() => setShareMessage(null), 3000);
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    // 易經需 hexagram + divinationResult;塔羅需三張牌
    if (divineType === "tarot") {
      if (drawnCards.length !== 3) return;
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
      setShareMessage(t("分享圖已下載 ✨", "Share image downloaded ✨"));
    } catch (e) {
      console.error("下載分享圖失敗:", e);
      setShareMessage(
        t("下載失敗,請再試一次", "Download failed, please try again")
      );
    } finally {
      setIsSharing(false);
      setTimeout(() => setShareMessage(null), 4000);
    }
  };

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    setStep("question");
  };

  const handleQuestionSubmit = () => {
    setStep("divine-type");
    setCurrentThrow(0);
    setThrows([]);
    setCurrentCoins(null);
    setDrawnCards([]);
    setRevealedCount(0);
  };

  const handleDivineTypeSelect = (type: DivineType) => {
    setDivineType(type);
    if (type === "iching") {
      setStep("mode-select");
    } else {
      // 塔羅:直接抽三張,進入 reveal 畫面讓使用者翻牌
      setDrawnCards(drawThreeCards());
      setRevealedCount(0);
      setStep("tarot-reveal");
    }
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

    try {
      const category = questionCategories.find((c) => c.id === selectedCategory);
      const relHex = result.relatingLines ? findHexagram(result.relatingLines) : null;

      const response = await fetch("/api/divine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hexagramNumber: hex.number,
          hexagramName: locale === "zh" ? hex.nameZh : hex.nameEn,
          changingLines: result.changingLines,
          relatingHexagramNumber: relHex?.number,
          question: userQuestion,
          category: category ? (locale === "zh" ? category.promptHintZh : category.promptHintEn) : "",
          locale,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("API error");

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

    try {
      const category = questionCategories.find((c) => c.id === selectedCategory);
      const payload = {
        cards: cards.map((d, i) => ({
          cardId: d.card.id,
          position: THREE_CARD_POSITIONS[i].key,
          isReversed: d.isReversed,
        })),
        question: userQuestion,
        category: category ? (locale === "zh" ? category.promptHintZh : category.promptHintEn) : "",
        locale,
      };

      const response = await fetch("/api/tarot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("API error");

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

      // 存進 Supabase(Phase B)— 塔羅版本,讓分享 / 公開連結可用
      if (!controller.signal.aborted) {
        const saved = await saveDivination({
          divineType: "tarot",
          question: userQuestion,
          category: selectedCategory,
          tarotCards: cards.map((d, i) => ({
            cardId: d.card.id,
            position: THREE_CARD_POSITIONS[i].key as "past" | "present" | "future",
            isReversed: d.isReversed,
          })),
          aiReading: fullText,
          locale,
        });
        if (saved?.id) setDivinationId(saved.id);
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

  // 三張塔羅牌全翻開 → 自動進 result 畫面 + 觸發 AI 解讀
  useEffect(() => {
    if (step !== "tarot-reveal") return;
    if (revealedCount < 3) return;
    if (drawnCards.length !== 3) return;
    const timer = setTimeout(() => {
      setStep("result");
      fetchTarotReading(drawnCards);
    }, 1200); // 讓最後一張翻牌動畫跑完再切
    return () => clearTimeout(timer);
    // fetchTarotReading 故意不放 deps — 新的 render 才產 new ref,會造成重複觸發
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, revealedCount, drawnCards]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    // 易經必須有 hexagram;塔羅必須有三張牌
    if (divineType === "tarot") {
      if (drawnCards.length !== 3) return;
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
    if (divineType === "tarot") {
      const lines = drawnCards.map((d, i) => {
        const pos = THREE_CARD_POSITIONS[i];
        const cardName = locale === "zh" ? d.card.nameZh : d.card.nameEn;
        const meaning = d.isReversed
          ? (locale === "zh" ? d.card.reversedMeaningZh : d.card.reversedMeaningEn)
          : (locale === "zh" ? d.card.uprightMeaningZh : d.card.uprightMeaningEn);
        if (locale === "zh") {
          return `【${pos.labelZh}】${cardName}(${d.isReversed ? "逆位" : "正位"}):${meaning}`;
        }
        return `[${pos.labelEn}] ${cardName} (${d.isReversed ? "Reversed" : "Upright"}): ${meaning}`;
      }).join("\n");
      readingContext = locale === "zh"
        ? `問題:${userQuestion}\n\n三張牌:\n${lines}\n\n老師解盤:${aiReading}`
        : `Question: ${userQuestion}\n\nThree cards:\n${lines}\n\nReading: ${aiReading}`;
    } else {
      readingContext = locale === "zh"
        ? `本卦：第${hexagram!.number}卦 ${hexagram!.nameZh}\n卦辭：${hexagram!.judgmentZh}\n象辭：${hexagram!.imageZh}\n問題：${userQuestion}\n老師解盤：${aiReading}`
        : `Hexagram ${hexagram!.number}: ${hexagram!.nameEn}\nJudgment: ${hexagram!.judgmentEn}\nImage: ${hexagram!.imageEn}\nQuestion: ${userQuestion}\nReading: ${aiReading}`;
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
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("API error");

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
      setChatMessages([...newMessages, { role: "assistant", content: t("抱歉，暫時無法回覆。", "Sorry, unable to reply at the moment.") }]);
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
    setDrawnCards([]);
    setRevealedCount(0);
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />

      <main style={{ paddingTop: 80, paddingBottom: 48, paddingLeft: 16, paddingRight: 16, maxWidth: 640, margin: "0 auto" }}>
        <AnimatePresence mode="wait">

          {/* ===== STEP 1: Category ===== */}
          {step === "category" && (
            <motion.div key="cat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 32 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
                  <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    style={{ fontSize: 56, display: "inline-block", lineHeight: 1 }}>☯</motion.div>
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    style={{ fontSize: 52, display: "inline-block", lineHeight: 1 }}>🎴</motion.div>
                </div>
                <h1 className="text-gold-gradient" style={{ fontSize: 32, fontFamily: "'Noto Serif TC', serif", fontWeight: 700, marginTop: 16, letterSpacing: 2 }}>
                  {t("Oracle 神諭", "Oracle")}
                </h1>
                <p style={{ color: "rgba(192,192,208,0.75)", fontSize: 14, maxWidth: 400, margin: "10px auto 0", lineHeight: 1.6 }}>
                  {t(
                    "東方易經 · 西方塔羅 · AI 即時解盤",
                    "Eastern I Ching · Western Tarot · Real-time AI readings"
                  )}
                </p>
              </div>

              <p style={{ textAlign: "center", color: "#c0c0d0", fontSize: 14, marginBottom: 12 }}>
                {t("請選擇問事類別", "Choose your question category")}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {questionCategories.map((cat) => (
                  <motion.button key={cat.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => handleCategorySelect(cat.id)}
                    className="mystic-card"
                    style={{ padding: 16, textAlign: "center", cursor: "pointer", border: "1px solid rgba(212,168,85,0.2)", background: "rgba(13,13,43,0.8)" }}>
                    <span style={{ fontSize: 28, display: "block", marginBottom: 8 }}>{cat.icon}</span>
                    <span style={{ color: "#d4a855", fontWeight: 500, fontSize: 14 }}>
                      {locale === "zh" ? cat.nameZh : cat.nameEn}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ===== STEP 2: Question ===== */}
          {step === "question" && (
            <motion.div key="q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 24 }}>
                <span style={{ fontSize: 40 }}>{questionCategories.find((c) => c.id === selectedCategory)?.icon}</span>
                <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif", marginTop: 8 }}>
                  {t("請輸入你的問題", "Enter your question")}
                </h2>
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 4 }}>
                  {t("心誠則靈，專注你想問的事", "Focus your mind on what you seek to know")}
                </p>
              </div>

              <div className="mystic-card" style={{ padding: 24 }}>
                <textarea
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  placeholder={t("例如：我近期的感情運勢如何？", "e.g., What does my love life look like?")}
                  style={{
                    width: "100%", height: 128, background: "rgba(10,10,26,0.5)",
                    border: "1px solid rgba(212,168,85,0.2)", borderRadius: 12,
                    padding: 16, color: "white", resize: "none", fontSize: 14,
                    outline: "none", fontFamily: "'Noto Sans TC', sans-serif",
                  }}
                />
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={() => setStep("category")}
                    style={{
                      padding: "10px 24px", borderRadius: 9999, border: "1px solid rgba(212,168,85,0.3)",
                      color: "#d4a855", fontSize: 14, background: "none", cursor: "pointer",
                    }}>
                    {t("返回", "Back")}
                  </button>
                  <button onClick={handleQuestionSubmit} disabled={!userQuestion.trim()}
                    className="btn-gold" style={{ flex: 1, fontSize: 16 }}>
                    {t("開始占卜", "Begin Divination")}
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
                    {t("詳閱服務條款與免責聲明", "Read full terms & disclaimer")}
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
                  {t("選擇占卜工具", "Choose Your Oracle")}
                </h2>
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 13, marginTop: 6 }}>
                  {t("兩種系統皆以你提出的問題為核心給出指引", "Both systems will center on the question you asked")}
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
                        {t("易經占卜", "I Ching")}
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
                        {t("塔羅占卜", "Tarot")}
                      </div>
                      <div style={{ color: "rgba(192,192,208,0.7)", fontSize: 13, lineHeight: 1.5 }}>
                        {t(
                          "抽三張牌(過去・現在・未來),以七十八張塔羅為你解讀",
                          "Draw three cards (past · present · future) from the 78-card tarot deck"
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
                  {t("返回修改問題", "Back to edit question")}
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 2.5: Mode Select (自動 / 手動) ===== */}
          {step === "mode-select" && (
            <motion.div key="mode" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 24 }}>
                <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif" }}>
                  {t("選擇占卜方式", "Choose Divination Mode")}
                </h2>
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 13, marginTop: 6 }}>
                  {t("兩種方式都能得到相同品質的卦象", "Both modes produce the same quality reading")}
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
                      {t("上次選擇", "Last used")}
                    </span>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 32 }}>⚡</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#d4a855", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                        {t("自動占卜", "Auto")}
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
                      {t("上次選擇", "Last used")}
                    </span>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 32 }}>🪙</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#d4a855", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                        {t("手動占卜", "Manual")}
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
                  {t("返回選擇工具", "Back to choose oracle")}
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 3: Coin Throwing ===== */}
          {step === "divination" && (
            <motion.div key="div" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 16 }}>
                <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif" }}>
                  {t("擲銅錢", "Throw the Coins")}
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
                        ? t("占卜完成,正在為您解讀...", "Divination complete, reading...")
                        : t("自動占卜進行中...", "Auto divination in progress...")}
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
                    {isFlipping ? t("擲銅錢中...", "Throwing...") : t("擲銅錢", "Throw Coins")}
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {/* ===== STEP 3T: Tarot Reveal (抽牌 + 翻牌) ===== */}
          {step === "tarot-reveal" && drawnCards.length === 3 && (
            <motion.div key="tarot" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: "center", paddingTop: 32, marginBottom: 16 }}>
                <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif" }}>
                  {t("翻牌揭示", "Reveal Your Cards")}
                </h2>
                <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 14, marginTop: 4 }}>
                  {revealedCount === 0
                    ? t("依序點擊牌卡翻開(過去 → 現在 → 未來)", "Tap each card in order (past → present → future)")
                    : revealedCount < 3
                    ? t(`已翻開 ${revealedCount} / 3 張`, `Revealed ${revealedCount} of 3`)
                    : t("三張牌已揭示,老師正在為你解讀...", "All three cards revealed. Reading now...")}
                </p>
              </div>

              {/* 三張牌 */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginTop: 16,
              }}>
                {drawnCards.map((drawn, idx) => {
                  const isRevealed = idx < revealedCount;
                  const isNext = idx === revealedCount;
                  const pos = THREE_CARD_POSITIONS[idx];
                  const suitNames = locale === "zh" ? SUIT_NAMES_ZH : SUIT_NAMES_EN;
                  const cardName = locale === "zh" ? drawn.card.nameZh : drawn.card.nameEn;
                  const orientationLabel = drawn.isReversed
                    ? t("逆位", "Reversed")
                    : t("正位", "Upright");

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
                        {locale === "zh" ? pos.labelZh : pos.labelEn}
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
                            {suitNames[drawn.card.suit]} · {orientationLabel}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ textAlign: "center", marginTop: 24 }}>
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
                  {t("返回選擇工具", "Back to choose oracle")}
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 4a: Result (易經) ===== */}
          {step === "result" && divineType !== "tarot" && hexagram && (
            <motion.div key="res" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {/* Hexagram card */}
              <div className="mystic-card" style={{ padding: 32, textAlign: "center", marginTop: 16 }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.4 }}>
                  <span style={{ fontSize: 64, display: "block", marginBottom: 8 }}>{hexagram.character}</span>
                </motion.div>

                <h2 className="text-gold-gradient" style={{ fontSize: 24, fontFamily: "'Noto Serif TC', serif" }}>
                  {t(`第${hexagram.number}卦 ${hexagram.nameZh}`, `Hexagram ${hexagram.number}: ${hexagram.nameEn}`)}
                </h2>

                <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 24 }}>
                  <div>
                    <HexagramDisplay lines={divinationResult?.primaryLines || []} changingLines={divinationResult?.changingLines} size="md" />
                    <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 12 }}>{t("本卦", "Primary")}</p>
                  </div>
                  {relatingHexagram && divinationResult?.relatingLines && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", color: "rgba(212,168,85,0.4)", fontSize: 24 }}>→</div>
                      <div>
                        <HexagramDisplay lines={divinationResult.relatingLines} size="md" />
                        <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 12 }}>
                          {t(`之卦 ${relatingHexagram.nameZh}`, `Relating: ${relatingHexagram.nameEn}`)}
                        </p>
                      </div>
                    </>
                  )}
                </div>

              </div>

              {/* 卦辭 Judgment Section */}
              <div className="mystic-card" style={{ padding: 24, marginTop: 16 }}>
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                  {t("卦辭", "Judgment")}
                </h3>
                <p style={{ color: "#e8e8f0", fontSize: 15, fontWeight: 700, fontFamily: "'Noto Serif TC', serif", lineHeight: 1.8, marginBottom: 8 }}>
                  {locale === "zh" ? hexagram.judgmentZh : hexagram.judgmentEn}
                </p>
                {locale === "zh" && hexagram.judgmentVernacularZh && (
                  <p style={{ color: "rgba(192,192,208,0.8)", fontSize: 14, lineHeight: 1.8 }}>
                    {hexagram.judgmentVernacularZh}
                  </p>
                )}
              </div>

              {/* 象辭 Image Section */}
              <div className="mystic-card" style={{ padding: 24, marginTop: 16 }}>
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                  {t("象辭", "Image")}
                </h3>
                <p style={{ color: "#e8e8f0", fontSize: 15, fontWeight: 700, fontFamily: "'Noto Serif TC', serif", lineHeight: 1.8, marginBottom: 8 }}>
                  {locale === "zh" ? hexagram.imageZh : hexagram.imageEn}
                </p>
                {locale === "zh" && hexagram.imageVernacularZh && (
                  <p style={{ color: "rgba(192,192,208,0.8)", fontSize: 14, lineHeight: 1.8 }}>
                    {hexagram.imageVernacularZh}
                  </p>
                )}
              </div>

              {/* AI Analysis - clearly marked */}
              <div className="mystic-card" style={{ padding: 24, marginTop: 16, borderLeft: "3px solid #d4a855" }}>
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                  ✦ {t("老師解盤", "Master's Reading")}
                </h3>

                {isLoadingAI && !aiReading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "24px 0" }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      style={{ fontSize: 24 }}>☯</motion.div>
                    <span style={{ color: "rgba(192,192,208,0.6)", fontSize: 14 }}>
                      {t("正在為您分析...", "Analyzing for you...")}
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
                      "※ For reference only. Not investment, medical, legal, or major life decision advice."
                    )}
                  </p>
                )}
              </div>

              {/* Share card download + public link */}
              {!isLoadingAI && aiReading && (
                <div className="mystic-card" style={{ padding: 20, marginTop: 16 }}>
                  <h3 style={{ fontSize: 15, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                    📤 {t("分享這次占卜", "Share this divination")}
                  </h3>

                  {/* v1: 下載分享圖 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <p style={{ flex: "1 1 200px", color: "rgba(192,192,208,0.7)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                      {isActive
                        ? t("📥 下載無浮水印分享圖（付費會員專屬）", "📥 Clean share image (premium member perk)")
                        : t("📥 下載分享圖（免費版含浮水印，升級即可移除）", "📥 Download share image (free version has watermark)")}
                    </p>
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className="btn-gold"
                      style={{ fontSize: 14, padding: "10px 20px", flexShrink: 0 }}
                    >
                      {isSharing
                        ? t("產生中…", "Generating…")
                        : t("下載分享圖", "Download")}
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
                          {t("登入", "Sign in")}
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
                            ? t("開啟中…", "Enabling…")
                            : t("🔓 開啟分享連結", "🔓 Enable share link")}
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
                              ? t("已複製 ✓", "Copied ✓")
                              : t("複製", "Copy")}
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
                              ? t("關閉中…", "Disabling…")
                              : t("🔒 關閉公開", "🔒 Make private")}
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

              {/* Chat with Master */}
              <div className="mystic-card" style={{ padding: 16, marginTop: 16, overflow: "hidden" }}>
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12, paddingLeft: 4 }}>
                  {t("繼續請教老師", "Ask the Master")}
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
                              {t("老師", "Master")}
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
                                  "※ For reference only. Not investment, medical, legal, or major life decision advice."
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
                    placeholder={t("想問老師什麼呢...", "Ask the master...")}
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
                    {t("送出", "Send")}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ marginTop: 16 }}>
                <button onClick={handleReset} className="btn-gold" style={{ width: "100%", fontSize: 16 }}>
                  {t("重新占卜", "New Divination")}
                </button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 4b: Result (塔羅) ===== */}
          {step === "result" && divineType === "tarot" && drawnCards.length === 3 && (
            <motion.div key="res-tarot" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {/* 三張牌展示 */}
              <div className="mystic-card" style={{ padding: 20, marginTop: 16 }}>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 40, display: "block" }}>🎴</span>
                  <h2 className="text-gold-gradient" style={{ fontSize: 22, fontFamily: "'Noto Serif TC', serif", marginTop: 4 }}>
                    {t("三牌占卜", "Three-Card Spread")}
                  </h2>
                  <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, marginTop: 4 }}>
                    {t("過去 · 現在 · 未來", "Past · Present · Future")}
                  </p>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                }}>
                  {drawnCards.map((drawn, idx) => {
                    const pos = THREE_CARD_POSITIONS[idx];
                    const suitNames = locale === "zh" ? SUIT_NAMES_ZH : SUIT_NAMES_EN;
                    const cardName = locale === "zh" ? drawn.card.nameZh : drawn.card.nameEn;
                    const orientationLabel = drawn.isReversed
                      ? t("逆位", "Reversed")
                      : t("正位", "Upright");
                    return (
                      <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                          color: "#d4a855",
                          fontSize: 13,
                          fontFamily: "'Noto Serif TC', serif",
                          marginBottom: 6,
                        }}>
                          {locale === "zh" ? pos.labelZh : pos.labelEn}
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
                            {suitNames[drawn.card.suit]} · {orientationLabel}
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
                  {t("牌義速覽", "Card Meanings")}
                </h3>
                {drawnCards.map((drawn, idx) => {
                  const pos = THREE_CARD_POSITIONS[idx];
                  const cardName = locale === "zh" ? drawn.card.nameZh : drawn.card.nameEn;
                  const meaning = drawn.isReversed
                    ? (locale === "zh" ? drawn.card.reversedMeaningZh : drawn.card.reversedMeaningEn)
                    : (locale === "zh" ? drawn.card.uprightMeaningZh : drawn.card.uprightMeaningEn);
                  const orientationLabel = drawn.isReversed
                    ? t("逆位", "Reversed")
                    : t("正位", "Upright");
                  return (
                    <div key={idx} style={{
                      marginBottom: idx < 2 ? 14 : 0,
                      paddingBottom: idx < 2 ? 14 : 0,
                      borderBottom: idx < 2 ? "1px dashed rgba(212,168,85,0.15)" : "none",
                    }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ color: "#d4a855", fontSize: 13, fontWeight: 600 }}>
                          {locale === "zh" ? pos.labelZh : pos.labelEn}
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
                  ✦ {t("老師解盤", "Master's Reading")}
                </h3>

                {isLoadingAI && !aiReading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "24px 0" }}>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      style={{ fontSize: 24 }}>🎴</motion.div>
                    <span style={{ color: "rgba(192,192,208,0.6)", fontSize: 14 }}>
                      {t("正在為您分析...", "Analyzing for you...")}
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
                      "※ For reference only. Not investment, medical, legal, or major life decision advice."
                    )}
                  </p>
                )}
              </div>

              {/* Share card download + public link(塔羅版) */}
              {!isLoadingAI && aiReading && (
                <div className="mystic-card" style={{ padding: 20, marginTop: 16 }}>
                  <h3 style={{ fontSize: 15, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12 }}>
                    📤 {t("分享這次占卜", "Share this divination")}
                  </h3>

                  {/* v1: 下載分享圖 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <p style={{ flex: "1 1 200px", color: "rgba(192,192,208,0.7)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                      {isActive
                        ? t("📥 下載無浮水印分享圖(付費會員專屬)", "📥 Clean share image (premium member perk)")
                        : t("📥 下載分享圖(免費版含浮水印,升級即可移除)", "📥 Download share image (free version has watermark)")}
                    </p>
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className="btn-gold"
                      style={{ fontSize: 14, padding: "10px 20px", flexShrink: 0 }}
                    >
                      {isSharing
                        ? t("產生中…", "Generating…")
                        : t("下載分享圖", "Download")}
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
                          {t("登入", "Sign in")}
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
                            ? t("開啟中…", "Enabling…")
                            : t("🔓 開啟分享連結", "🔓 Enable share link")}
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
                              ? t("已複製 ✓", "Copied ✓")
                              : t("複製", "Copy")}
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
                              ? t("關閉中…", "Disabling…")
                              : t("🔒 關閉公開", "🔒 Make private")}
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

              {/* Chat with Master(塔羅版) */}
              <div className="mystic-card" style={{ padding: 16, marginTop: 16, overflow: "hidden" }}>
                <h3 style={{ fontSize: 16, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 12, paddingLeft: 4 }}>
                  {t("繼續請教老師", "Ask the Master")}
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
                              {t("老師", "Master")}
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
                                  "※ For reference only. Not investment, medical, legal, or major life decision advice."
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
                    placeholder={t("想問老師什麼呢...", "Ask the master...")}
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
                    {t("送出", "Send")}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ marginTop: 16 }}>
                <button onClick={handleReset} className="btn-gold" style={{ width: "100%", fontSize: 16 }}>
                  {t("重新占卜", "New Divination")}
                </button>
              </div>
            </motion.div>
          )}
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
                locale={locale}
                showWatermark={!isActive}
              />
            </div>
          );
        })()}

      {/* Hidden off-screen ShareCard (塔羅版) */}
      {step === "result" &&
        divineType === "tarot" &&
        drawnCards.length === 3 &&
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
                divineType="tarot"
                drawnCards={drawnCards}
                question={userQuestion}
                categoryIcon={cat?.icon ?? "🔮"}
                categoryNameZh={cat?.nameZh ?? "綜合"}
                categoryNameEn={cat?.nameEn ?? "General"}
                aiReading={aiReading}
                locale={locale}
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
