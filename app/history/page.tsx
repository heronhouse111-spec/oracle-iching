"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import HexagramDisplay from "@/components/HexagramDisplay";
import LoginOptionsModal from "@/components/LoginOptionsModal";

// Line 目前尚未在 Supabase 後台啟用 → env 開關控制顯示
const LINE_LOGIN_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_LINE_LOGIN_ENABLED === "true";
import { getHexagramByNumber } from "@/data/hexagrams";
import { getCardById } from "@/data/tarot";
import { getSpread, DEFAULT_SPREAD_ID } from "@/data/spreads";
import { questionCategories } from "@/lib/divination";

interface TarotCardSlot {
  cardId: string;
  /** position key — 對應 data/spreads.ts SpreadPosition.key,任意 string */
  position: string;
  isReversed: boolean;
}

// follow_ups 陣列內單元 — schema 見 supabase/phase4_followups.sql
interface FollowUpItem {
  id: string;
  question: string;
  createdAt: string;
  divineType: "iching" | "tarot";
  aiReading: string;
  // iching
  hexagramNumber?: number | null;
  primaryLines?: number[] | null;
  changingLines?: number[] | null;
  relatingHexagramNumber?: number | null;
  // tarot
  tarotCards?: TarotCardSlot[] | null;
  /** Phase 12 後 tarot follow-up 才開始寫,舊資料無 → default 'three-card' */
  spreadId?: string | null;
}

// chat_messages 陣列內單元 — schema 見 supabase/phase6_chat_persistence.sql
interface ChatMessageItem {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface Record {
  id: string;
  created_at: string;
  question: string;
  category: string;
  ai_reading: string;
  divine_type: "iching" | "tarot";
  // iching-only
  hexagram_number: number | null;
  primary_lines: number[] | null;
  changing_lines: number[] | null;
  // tarot-only
  tarot_cards: TarotCardSlot[] | null;
  /** Phase 12 加的塔羅牌陣 id;舊資料 backfill 'three-card' */
  tarot_spread_id?: string | null;
  // 訂閱者在展開時可看到的延伸鏈 + 聊天紀錄(localStorage 紀錄不會有)
  follow_ups?: FollowUpItem[] | null;
  chat_messages?: ChatMessageItem[] | null;
}

type Source = "supabase" | "local" | null;

const FREE_VISIBLE_LIMIT = 3;
// 未登入訪客:列表只顯示 2 筆,展開只顯示一半 AI 回覆(下方加登入 CTA)
const GUEST_VISIBLE_LIMIT = 2;
// 歷史顯示的時間窗 —— 12 個月內,避免長期用戶 UI 爆掉
const HISTORY_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

export default function HistoryPage() {
  const { locale, t } = useLanguage();
  const [records, setRecords] = useState<Record[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<Source>(null);
  const [isActive, setIsActive] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const loadFromLocal = () => {
      try {
        const stored = localStorage.getItem("divination_history");
        if (stored) {
          // 同時收易經 + 塔羅;但擋掉資料不齊的 row 避免 render crash
          const parsed = JSON.parse(stored) as Record[];
          const clean = parsed.filter((r) => {
            if (!r || !r.id) return false;
            // 舊紀錄可能沒 divine_type,預設為 iching
            const dt = r.divine_type ?? "iching";
            if (dt === "iching") {
              return typeof r.hexagram_number === "number" && Array.isArray(r.primary_lines);
            }
            if (dt === "tarot") {
              return Array.isArray(r.tarot_cards) && r.tarot_cards.length > 0;
            }
            return false;
          });
          setRecords(clean);
        }
      } catch (e) {
        console.error("localStorage read failed:", e);
      }
      setSource("local");
      setIsLoading(false);
    };

    const load = async () => {
      if (!isSupabaseConfigured) {
        loadFromLocal();
        return;
      }
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          loadFromLocal();
          return;
        }

        setUserEmail(user.email ?? null);

        // 只撈最近 12 個月 — 避免訂閱者幾年後畫面炸掉(需要更早紀錄可之後加分頁)
        const sinceIso = new Date(Date.now() - HISTORY_WINDOW_MS).toISOString();

        // Fetch subscription status + divinations in parallel
        const [subRes, divRes] = await Promise.all([
          supabase
            .from("user_subscription_summary")
            .select("is_active")
            .eq("user_id", user.id)
            .maybeSingle(),
          // 易經 + 塔羅一起撈;訂閱者會用到 follow_ups / chat_messages,未訂閱的多撈也無害
          supabase
            .from("divinations")
            .select(
              "id, created_at, question, category, divine_type, hexagram_number, primary_lines, changing_lines, tarot_cards, tarot_spread_id, ai_reading, follow_ups, chat_messages"
            )
            .eq("user_id", user.id)
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false }),
        ]);

        if (divRes.error) {
          console.error("Supabase fetch failed:", divRes.error);
          loadFromLocal();
          return;
        }

        setIsActive(Boolean(subRes.data?.is_active));
        setRecords((divRes.data as Record[]) ?? []);
        setSource("supabase");
        setIsLoading(false);
      } catch (e) {
        console.error("Supabase error:", e);
        loadFromLocal();
      }
    };

    load();
  }, []);

  // 開登入 modal(Google / Apple / Line / Email magic link 共用)
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const handleGuestLogin = () => {
    if (!isSupabaseConfigured) return;
    setLoginModalOpen(true);
  };

  // Subscription gating:
  //   guest (local)      → 只能看 2 筆,展開只看一半
  //   supabase 未訂閱    → 只能看 3 筆
  //   supabase 訂閱戶    → 無限制
  const isGuest = source === "local";
  const gatingApplies = source === "supabase" && !isActive;
  const visibleLimit = isGuest
    ? GUEST_VISIBLE_LIMIT
    : gatingApplies
    ? FREE_VISIBLE_LIMIT
    : null;
  const visibleRecords =
    visibleLimit !== null ? records.slice(0, visibleLimit) : records;
  const lockedCount =
    visibleLimit !== null
      ? Math.max(0, records.length - visibleLimit)
      : 0;

  // Watermark text: email + date (for expanded AI reading)
  const watermarkText = userEmail
    ? `${userEmail} · ${new Date().toLocaleDateString(
        locale === "zh" ? "zh-TW" : "en-US"
      )}`
    : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />

      <LoginOptionsModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        lineEnabled={LINE_LOGIN_ENABLED}
      />
      <main style={{ paddingTop: 80, paddingBottom: 48, paddingLeft: 16, paddingRight: 16, maxWidth: 640, margin: "0 auto" }}>
        <h1 className="text-gold-gradient" style={{ fontSize: 24, fontFamily: "'Noto Serif TC', serif", textAlign: "center", marginBottom: 8 }}>
          {t("占卜紀錄", "Divination History")}
        </h1>

        {source && !isLoading && (
          <p
            style={{
              textAlign: "center",
              color: "rgba(192,192,208,0.4)",
              fontSize: 11,
              marginBottom: 20,
            }}
          >
            {source === "supabase"
              ? t("☁ 雲端同步中", "☁ Synced to cloud")
              : t("📱 僅存於本機(登入後可跨裝置同步)", "📱 Local only (sign in to sync across devices)")}
          </p>
        )}

        {/* 未登入訪客引導卡:登入同步 + 升級解鎖 */}
        {!isLoading && source === "local" && (
          <div
            className="mystic-card"
            style={{
              padding: 20,
              marginBottom: 20,
              border: "1px solid rgba(212,168,85,0.35)",
              background:
                "linear-gradient(135deg, rgba(212,168,85,0.08), rgba(212,168,85,0.02))",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>☁</div>
              <h2
                style={{
                  color: "#d4a855",
                  fontFamily: "'Noto Serif TC', serif",
                  fontSize: 17,
                  margin: 0,
                  marginBottom: 6,
                }}
              >
                {t("登入以解鎖完整體驗", "Sign in to unlock full features")}
              </h2>
              <p
                style={{
                  color: "rgba(192,192,208,0.7)",
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: 0,
                  maxWidth: 360,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                {t(
                  "目前紀錄僅存於本機,換裝置或清瀏覽器就會消失。",
                  "Records are currently stored only on this device and will disappear if you switch devices or clear your browser."
                )}
              </p>
            </div>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 auto 18px",
                maxWidth: 320,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                color: "rgba(192,192,208,0.85)",
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#d4a855" }}>✦</span>
                <span>
                  {t(
                    "跨裝置雲端同步,手機 / 電腦都看得到",
                    "Cloud sync across all your devices"
                  )}
                </span>
              </li>
              <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#d4a855" }}>✦</span>
                <span>
                  {t(
                    "產生公開分享連結,傳給朋友也能看到你的卦象",
                    "Generate shareable links so friends can view your reading"
                  )}
                </span>
              </li>
              <li style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: "#d4a855" }}>✦</span>
                <span>
                  {t(
                    "訂閱解鎖完整歷史、無浮水印輸出",
                    "Subscribe to unlock full history and watermark-free output"
                  )}
                </span>
              </li>
            </ul>

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {isSupabaseConfigured && (
                <button
                  onClick={handleGuestLogin}
                  className="btn-gold"
                  style={{
                    padding: "10px 22px",
                    fontSize: 13,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {t("使用 Google 登入", "Sign in with Google")}
                </button>
              )}
              <Link
                href="/account/upgrade"
                style={{
                  padding: "10px 22px",
                  fontSize: 13,
                  color: "#d4a855",
                  border: "1px solid rgba(212,168,85,0.3)",
                  borderRadius: 9999,
                  textDecoration: "none",
                  background: "rgba(212,168,85,0.04)",
                }}
              >
                {t("了解訂閱方案 →", "View subscription plans →")}
              </Link>
            </div>
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 48, color: "rgba(192,192,208,0.6)" }}>
            {t("載入中...", "Loading...")}
          </div>
        ) : records.length === 0 ? (
          <div className="mystic-card" style={{ padding: 48, textAlign: "center" }}>
            <span style={{ fontSize: 40, display: "block", marginBottom: 16 }}>🔮</span>
            <p style={{ color: "rgba(192,192,208,0.6)" }}>{t("尚無占卜紀錄", "No records yet")}</p>
            <a href="/" className="btn-gold" style={{ display: "inline-block", marginTop: 16, textDecoration: "none" }}>
              {t("開始第一次占卜", "Start your first divination")}
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleRecords.map((record) => {
              const divineType = record.divine_type ?? "iching";
              const cat = questionCategories.find((c) => c.id === record.category);
              const isExpanded = expandedId === record.id;
              const hex =
                divineType === "iching" && record.hexagram_number != null
                  ? getHexagramByNumber(record.hexagram_number)
                  : null;
              // 塔羅 label = 「塔羅 · 牌陣名」(顯示使用者占卜時用的牌陣);
              // 易經 label = 卦名。
              const recordSpread =
                divineType === "tarot"
                  ? getSpread(record.tarot_spread_id ?? DEFAULT_SPREAD_ID)
                  : null;
              const tarotLabel =
                divineType === "tarot" && recordSpread
                  ? t(
                      `塔羅 · ${recordSpread.nameZh}`,
                      `Tarot · ${recordSpread.nameEn}`,
                      `タロット · ${recordSpread.nameEn}`,
                      `타로 · ${recordSpread.nameEn}`
                    )
                  : locale === "zh"
                  ? hex?.nameZh
                  : hex?.nameEn;

              return (
                <motion.div key={record.id} layout className="mystic-card" style={{ overflow: "hidden" }}>
                  <button onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    style={{
                      width: "100%", padding: 16, display: "flex", alignItems: "center", gap: 16,
                      textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "white",
                    }}>
                    <div style={{ fontSize: 28, minWidth: 36, textAlign: "center" }}>
                      {divineType === "tarot" ? "🃏" : hex?.character}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{cat?.icon}</span>
                        <span style={{ color: "#d4a855", fontFamily: "'Noto Serif TC', serif", fontSize: 14 }}>
                          {tarotLabel}
                        </span>
                      </div>
                      <p style={{ color: "rgba(192,192,208,0.6)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>
                        {record.question}
                      </p>
                    </div>
                    <div style={{ color: "rgba(192,192,208,0.4)", fontSize: 12 }}>
                      {new Date(record.created_at).toLocaleDateString(locale === "zh" ? "zh-TW" : "en-US")}
                    </div>
                  </button>

                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      style={{ borderTop: "1px solid rgba(212,168,85,0.1)", padding: 16, position: "relative", overflow: "hidden" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, position: "relative", zIndex: 1 }}>
                        {divineType === "iching" && record.primary_lines ? (
                          <HexagramDisplay
                            lines={record.primary_lines}
                            changingLines={record.changing_lines ?? []}
                            size="sm"
                            animate={false}
                          />
                        ) : divineType === "tarot" && record.tarot_cards && recordSpread ? (
                          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                            {record.tarot_cards.map((tc, ci) => {
                              const card = getCardById(tc.cardId);
                              // 用 position key 從 spread.positions 找;找不到 fallback 到 idx 對應位置
                              const pos =
                                recordSpread.positions.find((p) => p.key === tc.position) ??
                                recordSpread.positions[ci];
                              if (!card) return null;
                              return (
                                <div key={`${tc.position}-${ci}`} style={{ textAlign: "center", width: 72 }}>
                                  <div style={{ fontSize: 10, color: "#d4a855", marginBottom: 4 }}>
                                    {locale === "zh" ? pos?.labelZh : pos?.labelEn}
                                  </div>
                                  <div
                                    style={{
                                      width: 72,
                                      height: 120,
                                      borderRadius: 4,
                                      overflow: "hidden",
                                      position: "relative",
                                      border: "1px solid rgba(212,168,85,0.25)",
                                      transform: tc.isReversed ? "rotate(180deg)" : undefined,
                                    }}
                                  >
                                    <Image
                                      src={card.imagePath}
                                      alt={locale === "zh" ? card.nameZh : card.nameEn}
                                      fill
                                      sizes="72px"
                                      style={{ objectFit: "cover" }}
                                    />
                                  </div>
                                  <div style={{ fontSize: 10, color: "rgba(192,192,208,0.7)", marginTop: 4, lineHeight: 1.3 }}>
                                    {locale === "zh" ? card.nameZh : card.nameEn}
                                    {tc.isReversed ? t("・逆", " (rev)") : ""}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      {(() => {
                        const fullReading = record.ai_reading ?? "";
                        const isTruncated = isGuest && fullReading.length > 40;
                        const shownReading = isTruncated
                          ? fullReading.slice(0, Math.floor(fullReading.length / 2))
                          : fullReading;
                        return (
                          <>
                            <div
                              style={{
                                color: "rgba(192,192,208,0.8)",
                                fontSize: 14,
                                lineHeight: 1.8,
                                whiteSpace: "pre-wrap",
                                position: "relative",
                                zIndex: 1,
                                // 訪客版下方漸層淡出,暗示還有後半段
                                maskImage: isTruncated
                                  ? "linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0.15))"
                                  : undefined,
                                WebkitMaskImage: isTruncated
                                  ? "linear-gradient(to bottom, rgba(0,0,0,1) 60%, rgba(0,0,0,0.15))"
                                  : undefined,
                              }}
                            >
                              {shownReading}
                              {isTruncated && "…"}
                            </div>
                            {isTruncated && (
                              <div
                                style={{
                                  marginTop: 16,
                                  padding: 18,
                                  borderRadius: 12,
                                  textAlign: "center",
                                  border: "1px solid rgba(212,168,85,0.35)",
                                  background:
                                    "linear-gradient(135deg, rgba(212,168,85,0.1), rgba(212,168,85,0.02))",
                                  position: "relative",
                                  zIndex: 1,
                                }}
                              >
                                <div style={{ fontSize: 26, marginBottom: 6 }}>🔐</div>
                                <h4
                                  style={{
                                    color: "#d4a855",
                                    fontFamily: "'Noto Serif TC', serif",
                                    fontSize: 15,
                                    margin: "0 0 6px",
                                  }}
                                >
                                  {t("登入以解鎖完整體驗", "Sign in to unlock full reading")}
                                </h4>
                                <p
                                  style={{
                                    color: "rgba(192,192,208,0.7)",
                                    fontSize: 12,
                                    lineHeight: 1.6,
                                    margin: "0 auto 14px",
                                    maxWidth: 320,
                                  }}
                                >
                                  {t(
                                    "登入後可讀完整 AI 解卦、跨裝置同步、產生分享圖。",
                                    "Sign in to read the full AI analysis, sync across devices, and create shareable images."
                                  )}
                                </p>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 10,
                                    justifyContent: "center",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {isSupabaseConfigured && (
                                    <button
                                      onClick={handleGuestLogin}
                                      className="btn-gold"
                                      style={{
                                        padding: "9px 20px",
                                        fontSize: 13,
                                        border: "none",
                                        cursor: "pointer",
                                      }}
                                    >
                                      {t("使用 Google 登入", "Sign in with Google")}
                                    </button>
                                  )}
                                  <Link
                                    href="/account/upgrade"
                                    style={{
                                      padding: "9px 20px",
                                      fontSize: 13,
                                      color: "#d4a855",
                                      border: "1px solid rgba(212,168,85,0.3)",
                                      borderRadius: 9999,
                                      textDecoration: "none",
                                      background: "rgba(212,168,85,0.04)",
                                    }}
                                  >
                                    {t("了解訂閱方案 →", "View plans →")}
                                  </Link>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* 免責聲明 */}
                      <p
                        style={{
                          marginTop: 14,
                          paddingTop: 10,
                          borderTop: "1px dashed rgba(212,168,85,0.15)",
                          color: "rgba(192,192,208,0.5)",
                          fontSize: 11,
                          lineHeight: 1.7,
                          fontStyle: "italic",
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        {t(
                          "※ 僅供參考,不構成投資、醫療、法律或重大決策之建議。",
                          "※ For reference only. Not investment, medical, legal, or major life decision advice."
                        )}
                      </p>

                      {/* 訂閱者:延伸占卜鏈 */}
                      {isActive && Array.isArray(record.follow_ups) && record.follow_ups.length > 0 && (
                        <div
                          style={{
                            marginTop: 20,
                            paddingTop: 16,
                            borderTop: "1px dashed rgba(212,168,85,0.25)",
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          <h4
                            style={{
                              fontSize: 14,
                              fontFamily: "'Noto Serif TC', serif",
                              color: "#d4a855",
                              marginBottom: 12,
                            }}
                          >
                            🌿 {t("延伸占卜", "Follow-up Readings")}
                            <span style={{ color: "rgba(192,192,208,0.5)", fontSize: 12, marginLeft: 8, fontWeight: 400 }}>
                              ({record.follow_ups.length})
                            </span>
                          </h4>
                          {record.follow_ups.map((f, fi) => {
                            const isIching = f.divineType === "iching";
                            const fHex =
                              isIching && typeof f.hexagramNumber === "number"
                                ? getHexagramByNumber(f.hexagramNumber)
                                : null;
                            const fSpread = !isIching
                              ? getSpread(f.spreadId ?? DEFAULT_SPREAD_ID)
                              : null;
                            return (
                              <div
                                key={f.id ?? fi}
                                style={{
                                  marginBottom: 14,
                                  padding: 12,
                                  borderRadius: 8,
                                  background: "rgba(212,168,85,0.04)",
                                  border: "1px solid rgba(212,168,85,0.15)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    marginBottom: 8,
                                    gap: 8,
                                  }}
                                >
                                  <span style={{ color: "#d4a855", fontSize: 12, fontFamily: "'Noto Serif TC', serif" }}>
                                    {isIching
                                      ? `${t("第", "#")}${fHex?.number ?? "?"} ${locale === "zh" ? fHex?.nameZh ?? "" : fHex?.nameEn ?? ""}`
                                      : fSpread
                                      ? t(
                                          `塔羅 · ${fSpread.nameZh}`,
                                          `Tarot · ${fSpread.nameEn}`,
                                          `タロット · ${fSpread.nameEn}`,
                                          `타로 · ${fSpread.nameEn}`
                                        )
                                      : t("塔羅", "Tarot", "タロット", "타로")}
                                  </span>
                                  <span style={{ color: "rgba(192,192,208,0.4)", fontSize: 10 }}>
                                    {f.createdAt ? new Date(f.createdAt).toLocaleDateString(locale === "zh" ? "zh-TW" : "en-US") : ""}
                                  </span>
                                </div>
                                <p
                                  style={{
                                    color: "rgba(192,192,208,0.6)",
                                    fontSize: 12,
                                    marginBottom: 8,
                                    fontStyle: "italic",
                                  }}
                                >
                                  Q: {f.question}
                                </p>
                                {isIching && Array.isArray(f.primaryLines) ? (
                                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                                    <HexagramDisplay
                                      lines={f.primaryLines}
                                      changingLines={f.changingLines ?? []}
                                      size="sm"
                                      animate={false}
                                    />
                                  </div>
                                ) : !isIching && Array.isArray(f.tarotCards) && fSpread ? (
                                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
                                    {f.tarotCards.map((tc, fci) => {
                                      const card = getCardById(tc.cardId);
                                      const pos =
                                        fSpread.positions.find((p) => p.key === tc.position) ??
                                        fSpread.positions[fci];
                                      if (!card) return null;
                                      return (
                                        <div key={`${tc.position}-${fci}`} style={{ textAlign: "center", width: 56 }}>
                                          <div style={{ fontSize: 9, color: "#d4a855", marginBottom: 3 }}>
                                            {locale === "zh" ? pos?.labelZh : pos?.labelEn}
                                          </div>
                                          <div
                                            style={{
                                              width: 56,
                                              height: 94,
                                              borderRadius: 3,
                                              overflow: "hidden",
                                              position: "relative",
                                              border: "1px solid rgba(212,168,85,0.25)",
                                              transform: tc.isReversed ? "rotate(180deg)" : undefined,
                                            }}
                                          >
                                            <Image
                                              src={card.imagePath}
                                              alt={locale === "zh" ? card.nameZh : card.nameEn}
                                              fill
                                              sizes="56px"
                                              style={{ objectFit: "cover" }}
                                            />
                                          </div>
                                          <div style={{ fontSize: 9, color: "rgba(192,192,208,0.7)", marginTop: 2, lineHeight: 1.3 }}>
                                            {locale === "zh" ? card.nameZh : card.nameEn}
                                            {tc.isReversed ? t("・逆", " (r)") : ""}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                <div
                                  style={{
                                    color: "rgba(192,192,208,0.8)",
                                    fontSize: 13,
                                    lineHeight: 1.75,
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {f.aiReading}
                                </div>
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
                                    "※ For reference only. Not investment, medical, legal, or major life decision advice."
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 訂閱者:跟老師的聊天紀錄 */}
                      {isActive && Array.isArray(record.chat_messages) && record.chat_messages.length > 0 && (
                        <div
                          style={{
                            marginTop: 20,
                            paddingTop: 16,
                            borderTop: "1px dashed rgba(212,168,85,0.25)",
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          <h4
                            style={{
                              fontSize: 14,
                              fontFamily: "'Noto Serif TC', serif",
                              color: "#d4a855",
                              marginBottom: 12,
                            }}
                          >
                            💬 {t("跟老師的對話", "Chat with the Master")}
                            <span style={{ color: "rgba(192,192,208,0.5)", fontSize: 12, marginLeft: 8, fontWeight: 400 }}>
                              ({record.chat_messages.length})
                            </span>
                          </h4>
                          <div>
                            {record.chat_messages.map((msg, mi) => (
                              <div
                                key={mi}
                                style={{
                                  display: "flex",
                                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                                  marginBottom: 8,
                                }}
                              >
                                <div
                                  style={{
                                    maxWidth: "85%",
                                    padding: "8px 12px",
                                    borderRadius:
                                      msg.role === "user"
                                        ? "14px 14px 4px 14px"
                                        : "14px 14px 14px 4px",
                                    background:
                                      msg.role === "user"
                                        ? "rgba(212,168,85,0.15)"
                                        : "rgba(30,30,60,0.6)",
                                    border:
                                      msg.role === "user"
                                        ? "1px solid rgba(212,168,85,0.25)"
                                        : "1px solid rgba(192,192,208,0.1)",
                                    color:
                                      msg.role === "user"
                                        ? "#e8e0d0"
                                        : "rgba(192,192,208,0.85)",
                                    fontSize: 13,
                                    lineHeight: 1.7,
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {msg.role === "assistant" && (
                                    <span
                                      style={{
                                        color: "#d4a855",
                                        fontSize: 11,
                                        display: "block",
                                        marginBottom: 2,
                                      }}
                                    >
                                      {t("老師", "Master")}
                                    </span>
                                  )}
                                  {msg.content}
                                  {/* 免責聲明(assistant 訊息才顯示) */}
                                  {msg.role === "assistant" && (
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
                          </div>
                        </div>
                      )}

                      {/* 訂閱者:從這筆繼續對話 / 衍伸占卜 */}
                      {isActive && (
                        <div
                          style={{
                            marginTop: 18,
                            paddingTop: 14,
                            borderTop: "1px dashed rgba(212,168,85,0.25)",
                            textAlign: "center",
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          <Link
                            href={`/?resume=${record.id}`}
                            className="btn-gold"
                            style={{
                              display: "inline-block",
                              textDecoration: "none",
                              padding: "10px 22px",
                              fontSize: 13,
                            }}
                          >
                            {t("繼續對話 / 衍伸占卜 →", "Continue chat / follow-up →")}
                          </Link>
                          <p
                            style={{
                              color: "rgba(192,192,208,0.45)",
                              fontSize: 11,
                              marginTop: 8,
                              lineHeight: 1.5,
                            }}
                          >
                            {t(
                              "回到首頁並帶入此筆占卜的完整脈絡",
                              "Returns to home with this reading's full context"
                            )}
                          </p>
                        </div>
                      )}

                      {/* Translucent watermark to deter unauthorized screenshot sharing */}
                      {watermarkText && (
                        <div
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            inset: 0,
                            pointerEvents: "none",
                            overflow: "hidden",
                            zIndex: 0,
                            opacity: 0.07,
                            userSelect: "none",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%) rotate(-25deg)",
                              whiteSpace: "nowrap",
                              display: "flex",
                              flexDirection: "column",
                              gap: 48,
                              fontSize: 14,
                              color: "#d4a855",
                              fontFamily: "'Noto Serif TC', serif",
                            }}
                          >
                            {[0, 1, 2, 3, 4].map((i) => (
                              <div key={i} style={{ letterSpacing: 3 }}>
                                {watermarkText} · {watermarkText} · {watermarkText}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}

            {/* Locked records upsell */}
            {lockedCount > 0 && (
              <div
                className="mystic-card"
                style={{
                  position: "relative",
                  padding: 24,
                  overflow: "hidden",
                  border: "1px solid rgba(212,168,85,0.25)",
                }}
              >
                {/* Faux "locked" card rows behind the overlay */}
                <div
                  aria-hidden="true"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    filter: "blur(6px)",
                    opacity: 0.35,
                    pointerEvents: "none",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 10,
                      }}
                    >
                      <div style={{ fontSize: 22 }}>䷀</div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            height: 10,
                            width: "40%",
                            background: "rgba(212,168,85,0.3)",
                            borderRadius: 4,
                            marginBottom: 6,
                          }}
                        />
                        <div
                          style={{
                            height: 8,
                            width: "75%",
                            background: "rgba(192,192,208,0.2)",
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Lock + upsell CTA */}
                <div
                  style={{
                    position: "relative",
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
                  <p
                    style={{
                      color: "#d4a855",
                      fontFamily: "'Noto Serif TC', serif",
                      fontSize: 15,
                      marginBottom: 6,
                    }}
                  >
                    {t(
                      `還有 ${lockedCount} 筆紀錄已鎖定`,
                      `${lockedCount} more record${lockedCount === 1 ? "" : "s"} locked`
                    )}
                  </p>
                  <p
                    style={{
                      color: "rgba(192,192,208,0.7)",
                      fontSize: 12,
                      lineHeight: 1.6,
                      marginBottom: 16,
                      maxWidth: 320,
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    {isGuest
                      ? t(
                          "未登入訪客僅顯示最近 2 筆紀錄。登入即可查看全部,並跨裝置同步。",
                          "Guests see only the 2 most recent records. Sign in to view all and sync across devices."
                        )
                      : t(
                          "免費會員僅顯示最近 3 筆占卜紀錄。升級訂閱後可解鎖全部歷史,並支援無浮水印輸出。",
                          "Free members can see the 3 most recent divinations. Upgrade to unlock full history and watermark-free output."
                        )}
                  </p>
                  {isGuest && isSupabaseConfigured ? (
                    <button
                      onClick={handleGuestLogin}
                      className="btn-gold"
                      style={{
                        padding: "10px 24px",
                        fontSize: 13,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {t("使用 Google 登入", "Sign in with Google")}
                    </button>
                  ) : (
                    <Link
                      href="/account/upgrade"
                      className="btn-gold"
                      style={{
                        display: "inline-block",
                        textDecoration: "none",
                        padding: "10px 24px",
                        fontSize: 13,
                      }}
                    >
                      {t("升級解鎖 →", "Upgrade to unlock →")}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* 列表尾端:繼續新的占卜(有紀錄時才顯示,空狀態已有自己的 CTA) */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <a
                href="/"
                className="btn-gold"
                style={{
                  display: "inline-block",
                  textDecoration: "none",
                  padding: "12px 28px",
                  fontSize: 14,
                }}
              >
                {t("繼續新的占卜 →", "Start a new divination →")}
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
