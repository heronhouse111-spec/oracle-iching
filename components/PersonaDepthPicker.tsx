"use client";

/**
 * PersonaDepthPicker — 占卜師人格 + Quick/Deep 模式選擇器
 *
 * 用法:
 *   <PersonaDepthPicker
 *     isSubscriber={isActive}
 *     personaId={personaId}
 *     depth={depth}
 *     system="iching" | "tarot"
 *     onChange={(p, d) => { setPersonaId(p); setDepth(d); }}
 *     onUpgrade={() => router.push("/account/upgrade")}
 *   />
 *
 * 資料來源:掛載時 fetch /api/personas(後台 CMS 維護),依 system filter + sort_order;
 * 若 API 空 / 失敗 → fallback 到 lib/personas.ts 的 static 清單。
 *
 * 圖像優先:有 image_url 顯示圖,沒有就 fallback 到 emoji。
 */

import { useEffect, useState } from "react";
import {
  TAROT_PERSONAS,
  getPersonasForSystem,
  type Persona,
  type PersonaSystem,
} from "@/lib/personas";
import { useLanguage, type Locale } from "@/i18n/LanguageContext";

export type ReadingDepth = "quick" | "deep";

interface ApiPersona {
  id: string;
  system: PersonaSystem;
  tier: "free" | "premium";
  sort_order: number;
  emoji: string | null;
  image_url: string | null;
  name_zh: string;
  name_en: string;
  name_ja: string | null;
  name_ko: string | null;
  tagline_zh: string;
  tagline_en: string;
  tagline_ja: string | null;
  tagline_ko: string | null;
}

interface DisplayPersona {
  id: string;
  tier: "free" | "premium";
  emoji: string;
  imageUrl: string | null;
  nameZh: string;
  nameEn: string;
  nameJa?: string;
  nameKo?: string;
  taglineZh: string;
  taglineEn: string;
  taglineJa?: string;
  taglineKo?: string;
}

interface Props {
  isSubscriber: boolean;
  personaId: string;
  depth: ReadingDepth;
  onChange: (personaId: string, depth: ReadingDepth) => void;
  onUpgrade?: () => void;
  /** 顯示哪個系統的 personas;預設 'tarot' */
  system?: PersonaSystem;
  /** (legacy)直接傳一組 personas;新 code 用 system 即可,這個保留向下相容 */
  personas?: Persona[];
}

function fromStatic(p: Persona): DisplayPersona {
  return {
    id: p.id,
    tier: p.tier,
    emoji: p.emoji,
    imageUrl: null,
    nameZh: p.nameZh,
    nameEn: p.nameEn,
    nameJa: p.nameJa,
    nameKo: p.nameKo,
    taglineZh: p.taglineZh,
    taglineEn: p.taglineEn,
    taglineJa: p.taglineJa,
    taglineKo: p.taglineKo,
  };
}

function fromApi(p: ApiPersona): DisplayPersona {
  return {
    id: p.id,
    tier: p.tier,
    emoji: p.emoji ?? "",
    imageUrl: p.image_url,
    nameZh: p.name_zh,
    nameEn: p.name_en,
    nameJa: p.name_ja ?? undefined,
    nameKo: p.name_ko ?? undefined,
    taglineZh: p.tagline_zh,
    taglineEn: p.tagline_en,
    taglineJa: p.tagline_ja ?? undefined,
    taglineKo: p.tagline_ko ?? undefined,
  };
}

function personaName(p: DisplayPersona, locale: Locale): string {
  if (locale === "en") return p.nameEn;
  if (locale === "ja") return p.nameJa ?? p.nameEn;
  if (locale === "ko") return p.nameKo ?? p.nameEn;
  return p.nameZh;
}
function personaTagline(p: DisplayPersona, locale: Locale): string {
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
  system = "tarot",
  personas: legacyPersonas,
}: Props) {
  const { locale, t } = useLanguage();

  // 起始用 static(避免空白閃),mount 後 fetch 覆蓋
  const initialList: DisplayPersona[] = (legacyPersonas ?? getPersonasForSystem(system)).map(
    fromStatic,
  );
  const [list, setList] = useState<DisplayPersona[]>(initialList);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/personas", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { personas?: ApiPersona[] };
        if (cancelled || !data.personas?.length) return;
        const filtered = data.personas
          .filter((p) => p.system === system || p.system === "any")
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(fromApi);
        if (filtered.length > 0) setList(filtered);
      } catch {
        // 沿用 initialList(static)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [system]);

  const handlePersonaClick = (p: DisplayPersona) => {
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
          {list.map((p) => {
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
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    width={36}
                    height={36}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                      margin: "0 auto 4px",
                      filter: isLocked ? "grayscale(0.6)" : "none",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{p.emoji}</div>
                )}
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
