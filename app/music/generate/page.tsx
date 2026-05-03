"use client";

/**
 * /music/generate — AI 背景音樂生成
 *
 * 流程:選分類 → 寫描述詞 → 生成(扣 100 點)→ 試聽 → 公開到排行榜 / 留私人
 * 失敗自動退點。5 分鐘內可半價(50 點)重生一次。
 */

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import LoginOptionsModal from "@/components/LoginOptionsModal";
import InsufficientCreditsModal from "@/components/InsufficientCreditsModal";
import {
  notifyCreditsChanged,
  parseInsufficientCredits,
} from "@/lib/clientCredits";

type Step = "form" | "generating" | "result";

const CATEGORIES = [
  { id: "meditation", emoji: "🧘", labelZh: "冥想", labelEn: "Meditation", labelJa: "瞑想", labelKo: "명상" },
  { id: "mystery",    emoji: "🔮", labelZh: "神秘", labelEn: "Mystery",    labelJa: "神秘", labelKo: "신비" },
  { id: "nature",     emoji: "🌿", labelZh: "自然", labelEn: "Nature",     labelJa: "自然", labelKo: "자연" },
  { id: "oriental",   emoji: "🏮", labelZh: "東方", labelEn: "Oriental",   labelJa: "東洋", labelKo: "동양" },
  { id: "focus",      emoji: "🎯", labelZh: "專注", labelEn: "Focus",      labelJa: "集中", labelKo: "집중" },
  { id: "dream",      emoji: "🌙", labelZh: "夢境", labelEn: "Dream",      labelJa: "夢境", labelKo: "꿈" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

// 範例描述詞 — 一鍵套用,降低空白輸入框的呆住感
const SAMPLE_PROMPTS: Record<CategoryId, { zh: string; en: string; ja: string; ko: string }[]> = {
  meditation: [
    {
      zh: "靜謐山林晨霧,Tibetan singing bowls, low drone",
      en: "Misty mountain forest dawn, Tibetan singing bowls, low drone",
      ja: "霧深い山林の夜明け、チベットのシンギングボウル、低いドローン",
      ko: "안개 자욱한 산림의 새벽, 티벳 싱잉볼, 저음 드론",
    },
    {
      zh: "深呼吸冥想,soft pads with crystal bells",
      en: "Deep breath meditation, soft pads with crystal bells",
      ja: "深呼吸の瞑想、柔らかなパッドとクリスタルベル",
      ko: "깊은 호흡 명상, 부드러운 패드와 크리스탈 벨",
    },
  ],
  mystery: [
    {
      zh: "神秘古老儀式,deep gong with cinematic drone",
      en: "Ancient mystical ritual, deep gong with cinematic drone",
      ja: "古代の神秘儀式、深いゴングとシネマティックドローン",
      ko: "고대의 신비 의식, 깊은 공과 영화적 드론",
    },
    {
      zh: "占卜時刻,glassy synth pads, distant chimes",
      en: "Oracle moment, glassy synth pads, distant chimes",
      ja: "占いの瞬間、ガラスのようなシンセパッド、遠くの鐘",
      ko: "점의 순간, 유리같은 신스 패드, 먼 종소리",
    },
  ],
  nature: [
    {
      zh: "森林溪流,running water, distant birdsong",
      en: "Forest stream, running water, distant birdsong",
      ja: "森の小川、流水、遠くの鳥のさえずり",
      ko: "숲속 시냇물, 흐르는 물, 먼 새소리",
    },
    {
      zh: "雨夜窗邊,gentle rain on glass, soft thunder",
      en: "Rainy night by window, gentle rain on glass, soft thunder",
      ja: "雨の夜の窓辺、ガラスに当たる柔らかな雨、遠雷",
      ko: "비오는 밤 창가, 유리에 부딪히는 가벼운 비, 부드러운 천둥",
    },
  ],
  oriental: [
    {
      zh: "古箏小品,traditional Chinese guzheng, peaceful zen",
      en: "Guzheng piece, traditional Chinese guzheng, peaceful zen",
      ja: "古箏の小品、中国伝統の古箏、静かな禪",
      ko: "고쟁 소품, 중국 전통 고쟁, 평화로운 선",
    },
    {
      zh: "禪庭清音,shakuhachi flute with soft drone",
      en: "Zen garden, shakuhachi flute with soft drone",
      ja: "禅庭の清音、尺八と柔らかなドローン",
      ko: "선의 정원, 샤쿠하치와 부드러운 드론",
    },
  ],
  focus: [
    {
      zh: "雨中讀書,lofi study beats with gentle rain",
      en: "Reading in rain, lofi study beats with gentle rain",
      ja: "雨の中で読書、優しい雨と共にローファイ・スタディ・ビーツ",
      ko: "비속에서 독서, 부드러운 비와 로파이 스터디 비트",
    },
    {
      zh: "深度工作,minimalist synth, repetitive hypnotic",
      en: "Deep work, minimalist synth, repetitive hypnotic",
      ja: "ディープワーク、ミニマリストシンセ、催眠的に反復",
      ko: "깊은 작업, 미니멀 신스, 반복적 최면",
    },
  ],
  dream: [
    {
      zh: "雲端漫遊,dreamy ambient, reverbed pads",
      en: "Floating in clouds, dreamy ambient, reverbed pads",
      ja: "雲の上を漂う、ドリーミーなアンビエント、リバーブパッド",
      ko: "구름 위 떠다님, 몽환적 앰비언트, 리버브 패드",
    },
    {
      zh: "星空夜寐,cosmic synth, twinkling chimes",
      en: "Starry night sleep, cosmic synth, twinkling chimes",
      ja: "星空の眠り、宇宙的シンセ、きらめく鐘",
      ko: "별이 빛나는 밤의 잠, 우주적 신스, 반짝이는 종",
    },
  ],
};

interface GenerateResult {
  musicId: string;
  title: string;
  category: string;
  audioUrl: string;
  durationSeconds: number;
}

export default function MusicGeneratePage() {
  const { locale, t } = useLanguage();
  const [step, setStep] = useState<Step>("form");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [creditsModal, setCreditsModal] = useState<{ open: boolean; required: number }>({
    open: false,
    required: 0,
  });
  const [retryCountdown, setRetryCountdown] = useState(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const categoryLabel = (id: CategoryId): string => {
    const c = CATEGORIES.find((x) => x.id === id)!;
    return locale === "en" ? c.labelEn
      : locale === "ja" ? c.labelJa
      : locale === "ko" ? c.labelKo
      : c.labelZh;
  };

  const samples = category ? SAMPLE_PROMPTS[category] : [];

  const handleGenerate = async (isRetry = false) => {
    if (!category || !prompt.trim() || prompt.trim().length < 5) return;
    setStep("generating");
    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          category,
          title: title.trim() || prompt.trim().slice(0, 30),
          locale,
          isRetry,
        }),
      });

      if (res.status === 401) {
        setLoginOpen(true);
        setStep("form");
        return;
      }
      const insufficient = await parseInsufficientCredits(res);
      if (insufficient) {
        setCreditsModal({ open: true, required: insufficient.required });
        setStep("form");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${res.status}`);
      }

      const data: GenerateResult = await res.json();
      setResult(data);
      notifyCreditsChanged();
      setStep("result");

      // 5 分鐘半價重生窗口
      setRetryCountdown(300);
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
      retryTimerRef.current = setInterval(() => {
        setRetryCountdown((s) => {
          if (s <= 1) {
            if (retryTimerRef.current) clearInterval(retryTimerRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (e) {
      console.error(e);
      setErrorMsg(
        (e as Error).message ||
          t(
            "生成失敗,已自動退點,請稍後再試",
            "Generation failed, credits refunded. Try again later.",
            "生成に失敗しました。ポイントは返却されました。",
            "생성 실패, 포인트 환불되었습니다.",
          ),
      );
      setStep("form");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!result) return;
    try {
      const res = await fetch("/api/music/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicId: result.musicId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.message || t("發布失敗", "Publish failed", "公開に失敗", "발행 실패"));
        return;
      }
      alert(
        t(
          "已發布到排行榜!別人可花 20 點收藏",
          "Published! Others can collect for 20 credits",
          "排行榜に公開しました!他のユーザーが 20 ポイントで収集できます",
          "랭킹에 발행됨! 다른 사용자가 20 포인트로 수집 가능",
        ),
      );
    } catch (e) {
      console.error(e);
      alert(t("發布失敗", "Publish failed", "公開に失敗", "발행 실패"));
    }
  };

  const handleReset = () => {
    if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    setStep("form");
    setResult(null);
    setPrompt("");
    setTitle("");
    setCategory(null);
    setErrorMsg("");
    setRetryCountdown(0);
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

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 28, fontWeight: 700, margin: 0 }}
          >
            {t("AI 背景音樂創作", "AI Background Music", "AI 背景音楽生成", "AI 배경음악 생성")}
          </h1>
          <p style={{ color: "#c0c0d0", fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            {t(
              "用描述詞創作專屬於你的 60 秒 ambient 背景音樂",
              "Create your own 60-second ambient music from a description",
              "説明文から 60 秒のあなただけのアンビエント背景音楽を作成",
              "설명으로 60초의 나만의 앰비언트 배경음악 생성",
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
              {t("每首生成 100 點", "100 credits per track", "1 曲生成 100 ポイント", "곡당 100 포인트")}
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 1: 選分類 */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ color: "#c0c0d0", fontSize: 13, display: "block", marginBottom: 10 }}>
                  {t("1. 選擇音樂類型", "1. Pick a category", "1. 音楽タイプを選ぶ", "1. 음악 유형 선택")}
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                  }}
                >
                  {CATEGORIES.map((c) => {
                    const selected = category === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        style={{
                          padding: "16px 8px",
                          background: selected
                            ? "linear-gradient(135deg, rgba(212,168,85,0.25), rgba(240,215,140,0.15))"
                            : "rgba(255,255,255,0.04)",
                          border: selected
                            ? "1px solid #d4a855"
                            : "1px solid rgba(212,168,85,0.3)",
                          borderRadius: 12,
                          color: "#fff",
                          fontFamily: "inherit",
                          cursor: "pointer",
                          textAlign: "center",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontSize: 28, marginBottom: 4 }}>{c.emoji}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{categoryLabel(c.id)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: 描述詞 */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ color: "#c0c0d0", fontSize: 13, display: "block", marginBottom: 6 }}>
                  {t(
                    "2. 用描述詞描繪你想要的音樂氛圍",
                    "2. Describe the mood / instruments you want",
                    "2. 求める雰囲気・楽器を説明",
                    "2. 원하는 분위기·악기 설명",
                  )}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={t(
                    "例:寧靜的森林,流水聲,輕柔的長笛,Tibetan bowls",
                    "e.g., calm forest, flowing water, soft flute, Tibetan bowls",
                    "例:静かな森、流水音、優しいフルート、チベットボウル",
                    "예:고요한 숲, 흐르는 물소리, 부드러운 플루트",
                  )}
                  rows={3}
                  maxLength={500}
                  minLength={5}
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
                  {prompt.length} / 500
                </div>

                {/* 範例 prompt 一鍵套用 */}
                {category && samples.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ color: "rgba(192,192,208,0.7)", fontSize: 11, marginBottom: 6 }}>
                      {t("試試這些範例:", "Try these:", "サンプル:", "샘플:")}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {samples.map((s, i) => {
                        const text = s[locale];
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setPrompt(text)}
                            style={{
                              padding: "6px 10px",
                              fontSize: 11,
                              background: "rgba(212,168,85,0.08)",
                              border: "1px solid rgba(212,168,85,0.25)",
                              borderRadius: 8,
                              color: "#d4a855",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {text.slice(0, 30)}…
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: 標題(可選) */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ color: "#c0c0d0", fontSize: 13, display: "block", marginBottom: 6 }}>
                  {t(
                    "3. 為你的音樂取個名字(可選)",
                    "3. Title your track (optional)",
                    "3. 曲のタイトル(任意)",
                    "3. 곡 제목(선택)",
                  )}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("留空會自動用描述詞前 30 字", "Leave blank to auto-fill", "空欄なら自動", "비워두면 자동")}
                  maxLength={50}
                  style={inputBase}
                />
              </div>

              {errorMsg && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(231, 76, 60, 0.12)",
                    border: "1px solid rgba(231, 76, 60, 0.4)",
                    borderRadius: 10,
                    color: "#ff8e7a",
                    fontSize: 13,
                    marginBottom: 14,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <button
                onClick={() => handleGenerate(false)}
                disabled={!category || prompt.trim().length < 5}
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  background:
                    category && prompt.trim().length >= 5
                      ? "linear-gradient(135deg, #d4a855, #f0d78c)"
                      : "rgba(212,168,85,0.2)",
                  color: category && prompt.trim().length >= 5 ? "#0a0a1a" : "rgba(192,192,208,0.4)",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: category && prompt.trim().length >= 5 ? "pointer" : "not-allowed",
                  fontFamily: "inherit",
                  boxShadow:
                    category && prompt.trim().length >= 5
                      ? "0 8px 24px rgba(212,168,85,0.25)"
                      : "none",
                }}
              >
                {t(
                  "✦ 生成音樂(扣 100 點)",
                  "✦ Generate (100 credits)",
                  "✦ 音楽を生成(100 ポイント)",
                  "✦ 음악 생성(100 포인트)",
                )}
              </button>

              <p style={{ color: "rgba(192,192,208,0.5)", fontSize: 11, textAlign: "center", marginTop: 10 }}>
                {t(
                  "生成失敗會自動退點 · 約需 10–15 秒",
                  "Auto-refund on failure · Takes 10–15s",
                  "失敗時は自動返却 · 約 10〜15 秒",
                  "실패시 자동 환불 · 약 10〜15초",
                )}
              </p>
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: "center", padding: "60px 20px" }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                style={{ fontSize: 64, marginBottom: 20 }}
              >
                🎵
              </motion.div>
              <div style={{ color: "#d4a855", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                {t("AI 創作中…", "Generating…", "生成中…", "생성 중…")}
              </div>
              <div style={{ color: "#c0c0d0", fontSize: 13 }}>
                {t(
                  "Stable Audio 正在為你譜曲(10–15 秒)",
                  "Stable Audio is composing (10–15s)",
                  "Stable Audio が作曲中(10〜15 秒)",
                  "Stable Audio 작곡 중(10〜15초)",
                )}
              </div>
            </motion.div>
          )}

          {step === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                style={{
                  padding: 20,
                  background: "linear-gradient(135deg, rgba(212,168,85,0.12), rgba(240,215,140,0.06))",
                  border: "1px solid rgba(212,168,85,0.4)",
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 32, textAlign: "center", marginBottom: 8 }}>
                  {CATEGORIES.find((c) => c.id === result.category)?.emoji}
                </div>
                <h2
                  style={{
                    color: "#fff",
                    fontSize: 20,
                    fontWeight: 700,
                    margin: 0,
                    textAlign: "center",
                    marginBottom: 16,
                  }}
                >
                  {result.title}
                </h2>
                <audio
                  controls
                  src={result.audioUrl}
                  style={{ width: "100%", borderRadius: 8 }}
                />
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <button
                  onClick={handlePublish}
                  style={{
                    padding: "14px 24px",
                    background: "linear-gradient(135deg, #d4a855, #f0d78c)",
                    color: "#0a0a1a",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t(
                    "📢 公開到排行榜",
                    "📢 Publish to leaderboard",
                    "📢 ランキングに公開",
                    "📢 랭킹에 발행",
                  )}
                </button>

                {retryCountdown > 0 && (
                  <button
                    onClick={() => handleGenerate(true)}
                    disabled={isLoading}
                    style={{
                      padding: "12px 24px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(212,168,85,0.4)",
                      borderRadius: 12,
                      color: "#d4a855",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isLoading ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {t(
                      `🔄 不滿意?半價重生(50 點) · 剩 ${formatCountdown(retryCountdown)}`,
                      `🔄 Not satisfied? Retry half-price (50 credits) · ${formatCountdown(retryCountdown)} left`,
                      `🔄 もう一度?半額生成(50 ポイント) · 残り ${formatCountdown(retryCountdown)}`,
                      `🔄 다시?반값 재생성(50 포인트) · ${formatCountdown(retryCountdown)} 남음`,
                    )}
                  </button>
                )}

                <Link
                  href="/music/my"
                  style={{
                    display: "block",
                    padding: "12px 24px",
                    background: "transparent",
                    border: "1px solid rgba(192,192,208,0.3)",
                    borderRadius: 12,
                    color: "#c0c0d0",
                    fontSize: 14,
                    fontWeight: 500,
                    textAlign: "center",
                    textDecoration: "none",
                    fontFamily: "inherit",
                  }}
                >
                  {t("🎵 我的音樂", "🎵 My music", "🎵 マイミュージック", "🎵 내 음악")}
                </Link>

                <button
                  onClick={handleReset}
                  style={{
                    padding: "10px 24px",
                    background: "transparent",
                    border: "none",
                    color: "rgba(192,192,208,0.7)",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t("再生成一首", "Generate another", "もう一曲生成", "한 곡 더 생성")}
                </button>
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
    </main>
  );
}

function formatCountdown(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
