"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import HexagramDisplay from "@/components/HexagramDisplay";
import CoinAnimation from "@/components/CoinAnimation";
import ShareCard from "@/components/ShareCard";
import { performDivination, questionCategories, type DivinationResult, type CoinThrow } from "@/lib/divination";
import { findHexagram, type Hexagram } from "@/data/hexagrams";
import { saveDivination } from "@/lib/saveDivination";

type Step = "category" | "question" | "divination" | "result";

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
        if (!user || cancelled) return;
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

  const handleShare = async () => {
    if (!hexagram || !divinationResult || isSharing) return;
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
      link.download = `oracle-iching-${hexagram.number}-${ts}.png`;
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
    setStep("divination");
    setCurrentThrow(0);
    setThrows([]);
    setCurrentCoins(null);
  };

  const handleThrowCoins = useCallback(() => {
    if (isFlipping) return;
    setIsFlipping(true);
    setCurrentCoins(null);

    const result = performDivination();
    const thisThrow = result.throws[currentThrow];

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
        }, 1500);
      } else {
        setCurrentThrow(currentThrow + 1);
      }
    }, 1400);
  }, [currentThrow, isFlipping, throws]);

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
        await saveDivination({
          question: userQuestion,
          category: selectedCategory,
          hexagramNumber: hex.number,
          primaryLines: result.primaryLines,
          changingLines: result.changingLines,
          relatingHexagramNumber: relHex?.number ?? null,
          aiReading: fullText,
          locale,
        });
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

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading || !hexagram) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user" as const, content: userMsg }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    // Build hexagram context for the AI
    const hexContext = locale === "zh"
      ? `本卦：第${hexagram.number}卦 ${hexagram.nameZh}\n卦辭：${hexagram.judgmentZh}\n象辭：${hexagram.imageZh}\n問題：${userQuestion}\n老師解盤：${aiReading}`
      : `Hexagram ${hexagram.number}: ${hexagram.nameEn}\nJudgment: ${hexagram.judgmentEn}\nImage: ${hexagram.imageEn}\nQuestion: ${userQuestion}\nReading: ${aiReading}`;

    if (chatAbortRef.current) chatAbortRef.current.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          hexagramContext: hexContext,
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
                <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  style={{ fontSize: 64, display: "inline-block" }}>☯</motion.div>
                <h1 className="text-gold-gradient" style={{ fontSize: 30, fontFamily: "'Noto Serif TC', serif", fontWeight: 700, marginTop: 16 }}>
                  {t("易經占卜", "Oracle I Ching")}
                </h1>
                <p style={{ color: "rgba(192,192,208,0.7)", fontSize: 14, maxWidth: 360, margin: "8px auto 0" }}>
                  {t("以古老的易經智慧，結合人工智慧為你解讀天機", "Ancient I Ching wisdom meets AI for personalized divination")}
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
                    {t("開始搖卦", "Begin Divination")}
                  </button>
                </div>
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
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={handleThrowCoins} disabled={isFlipping || currentThrow >= 6}
                  className="btn-gold" style={{ fontSize: 18, padding: "14px 48px" }}>
                  {isFlipping ? t("擲銅錢中...", "Throwing...") : t("擲銅錢", "Throw Coins")}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ===== STEP 4: Result ===== */}
          {step === "result" && hexagram && (
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
              </div>

              {/* Share card download */}
              {!isLoadingAI && aiReading && (
                <div className="mystic-card" style={{ padding: 20, marginTop: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 200px" }}>
                      <h3 style={{ fontSize: 15, fontFamily: "'Noto Serif TC', serif", color: "#d4a855", marginBottom: 4 }}>
                        📤 {t("分享這次占卜", "Share this divination")}
                      </h3>
                      <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, lineHeight: 1.6 }}>
                        {isActive
                          ? t("下載無浮水印分享圖（付費會員專屬）", "Clean share image (premium member perk)")
                          : t("下載分享圖（免費版含浮水印，升級即可移除）", "Download share image (free version has watermark)")}
                      </p>
                    </div>
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
        </AnimatePresence>
      </main>

      {/* Hidden off-screen ShareCard — 只在 result step 渲染 */}
      {step === "result" && hexagram && divinationResult && (() => {
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

      {/* Background decoration */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: -1 }}>
        <div style={{ position: "absolute", top: "25%", left: "25%", width: 384, height: 384, background: "rgba(88,28,135,0.1)", borderRadius: "50%", filter: "blur(48px)" }} />
        <div style={{ position: "absolute", bottom: "25%", right: "25%", width: 320, height: 320, background: "rgba(49,46,129,0.1)", borderRadius: "50%", filter: "blur(48px)" }} />
      </div>
    </div>
  );
}
