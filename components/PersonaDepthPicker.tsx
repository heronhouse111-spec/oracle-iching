"use client";

/**
 * PersonaDepthPicker — 占卜師人格 + Quick/Deep 模式選擇器
 *
 * 用法:
 *   <PersonaDepthPicker
 *     isSubscriber={isActive}
 *     personaId={personaId}
 *     depth={depth}
 *     onChange={(p, d) => { setPersonaId(p); setDepth(d); }}
 *     onUpgrade={() => router.push("/account/upgrade")}
 *   />
 *
 * 設計:
 *   - 5 位人格用 emoji + 名字呈現,免費 3 位無鎖、訂閱 2 位帶 🔒
 *   - 非訂閱戶點 premium 人格 → 觸發 onUpgrade(由父層決定要做什麼,通常導去訂閱頁)
 *   - Quick / Deep toggle —— Deep 對非訂閱戶 disabled
 */

import { TAROT_PERSONAS, type Persona } from "@/lib/personas";
import { useLanguage, type Locale } from "@/i18n/LanguageContext";

export type ReadingDepth = "quick" | "deep";

interface Props {
  isSubscriber: boolean;
  personaId: string;
  depth: ReadingDepth;
  onChange: (personaId: string, depth: ReadingDepth) => void;
  onUpgrade?: () => void;
  /** 顯示哪一組 personas;不傳則用塔羅 / 通用清單 */
  personas?: Persona[];
}

/** Locale-aware 取 persona 顯示名;ja/ko 缺值 fallback en */
function personaName(p: Persona, locale: Locale): string {
  if (locale === "en") return p.nameEn;
  if (locale === "ja") return p.nameJa ?? p.nameEn;
  if (locale === "ko") return p.nameKo ?? p.nameEn;
  return p.nameZh;
}

function personaTagline(p: Persona, locale: Locale): string {
  if (locale === "en") return p.taglineEn;
  if (locale === "ja") return p.taglineJa ?? p.taglineEn;
  if (locale === "ko") return p.taglineKo ?? p.taglineEn;
  return p.taglineZh;
}

export default function PersonaDepthPicker({
  isSubscriber,
  personaId,
  depth,
  onChange,
  onUpgrade,
  personas = TAROT_PERSONAS,
}: Props) {
  const { locale, t } = useLanguage();

  const handlePersonaClick = (p: Persona) => {
    if (p.tier === "premium" && !isSubscriber) {
      if (onUpgrade) onUpgrade();
      return;
    }
    onChange(p.id, depth);
  };

  const handleDepthClick = (d: ReadingDepth) => {
    if (d === "deep" && !isSubscriber) {
      if (onUpgrade) onUpgrade();
      return;
    }
    onChange(personaId, d);
  };

  return (
    <div
      style={{
        marginTop: 14,
        marginBottom: 14,
        padding: 14,
        background: "rgba(13,13,43,0.4)",
        border: "1px solid rgba(212,168,85,0.15)",
        borderRadius: 12,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "rgba(212,168,85,0.7)", marginBottom: 8, letterSpacing: 0.5 }}>
          {t("✦ 占卜師", "✦ Reader", "✦ 占い師", "✦ 점술사")}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 6,
          }}
        >
          {personas.map((p) => {
            const isActive = p.id === personaId;
            const isLocked = p.tier === "premium" && !isSubscriber;
            return (
              <button
                key={p.id}
                onClick={() => handlePersonaClick(p)}
                style={{
                  padding: "8px 6px",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(212,168,85,0.25), rgba(212,168,85,0.1))"
                    : "rgba(255,255,255,0.02)",
                  border: isActive
                    ? "1px solid rgba(212,168,85,0.7)"
                    : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  textAlign: "center",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: isLocked ? "rgba(192,192,208,0.5)" : "#e8e8f0",
                  position: "relative",
                  opacity: isLocked ? 0.7 : 1,
                }}
                title={personaTagline(p, locale)}
              >
                <div style={{ fontSize: 18, marginBottom: 2 }}>{p.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>
                  {personaName(p, locale)}
                  {isLocked && <span style={{ marginLeft: 4, fontSize: 10 }}>🔒</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, color: "rgba(212,168,85,0.7)", marginBottom: 6, letterSpacing: 0.5 }}>
          {t("✦ 解讀深度", "✦ Reading Depth", "✦ 解読の深さ", "✦ 해석 깊이")}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => handleDepthClick("quick")}
            style={{
              flex: 1,
              padding: "8px 12px",
              background: depth === "quick"
                ? "linear-gradient(135deg, rgba(212,168,85,0.25), rgba(212,168,85,0.1))"
                : "rgba(255,255,255,0.02)",
              border: depth === "quick"
                ? "1px solid rgba(212,168,85,0.7)"
                : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "inherit",
              color: "#e8e8f0",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ⚡ {t("快速解讀", "Quick", "クイック", "빠른")}
          </button>
          <button
            onClick={() => handleDepthClick("deep")}
            style={{
              flex: 1,
              padding: "8px 12px",
              background: depth === "deep"
                ? "linear-gradient(135deg, rgba(212,168,85,0.25), rgba(212,168,85,0.1))"
                : "rgba(255,255,255,0.02)",
              border: depth === "deep"
                ? "1px solid rgba(212,168,85,0.7)"
                : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "inherit",
              color: isSubscriber ? "#e8e8f0" : "rgba(192,192,208,0.5)",
              fontSize: 12,
              fontWeight: 600,
              opacity: isSubscriber ? 1 : 0.7,
            }}
            title={
              isSubscriber
                ? t(
                    "Deep Insight — 約 500 字深度解析(+3 點)",
                    "Deep Insight — ~350-word deep read (+3 credits)",
                    "Deep Insight — 約500字の深い解読(+3クレジット)",
                    "Deep Insight — 약 500자 심층 해석 (+3 크레딧)"
                  )
                : t(
                    "Deep Insight 為訂閱戶限定",
                    "Deep Insight is for subscribers",
                    "Deep Insight は有料会員限定",
                    "Deep Insight 은 구독자 전용"
                  )
            }
          >
            🔮 {t("深度洞察", "Deep", "深い", "심층")}
            {!isSubscriber && <span style={{ marginLeft: 4, fontSize: 10 }}>🔒</span>}
            {depth === "deep" && isSubscriber && (
              <span style={{ fontSize: 9, marginLeft: 4, color: "rgba(212,168,85,0.8)" }}>+3</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
