"use client";

/**
 * /collection — 收藏中心
 *
 * 一個轉跳頁,給 user:
 *  1. 兩個 hero 大按鈕,分別連到 /iching/hexagrams 跟 /tarot/cards
 *     — 卡片上直接顯示進度條(X/64 跟 Y/78)
 *  2. 收藏規則完整說明
 *  3. 里程碑獎勵列表
 *
 * 所有文案都從 /api/collection-hub 拉(admin 可從 /admin/collection-hub 即時編輯)。
 * milestone 數字從 /api/collection?type=... 拉。
 *
 * 5-locale i18n,訪客也能看(進度條會是 0/64 + 顯示登入 CTA)。
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { useLanguage, type Locale } from "@/i18n/LanguageContext";
import { useUiImages } from "@/hooks/useUiImages";

// ─── 型別 ─────────────────────────────────────

interface MilestoneConfig {
  id: string;
  collectionType: "iching" | "tarot";
  kind: "distinct_count" | "subkind_full";
  threshold: number;
  param: string | null;
  rewardCredits: number;
  labelZh: string;
  labelEn: string;
  labelJa: string | null;
  labelKo: string | null;
  sortOrder: number;
}

interface CollectionResponse {
  authenticated: boolean;
  type: "iching" | "tarot";
  ownedCount: number;
  milestoneConfigs: MilestoneConfig[];
  earnedMilestoneIds: string[];
}

interface SectionData {
  authenticated: boolean;
  ownedCount: number;
  milestones: MilestoneConfig[];
  earnedIds: Set<string>;
}

interface HubItem {
  id: string;
  section: string;
  title_zh: string | null;
  title_en: string | null;
  title_ja: string | null;
  title_ko: string | null;
  body_zh: string | null;
  body_en: string | null;
  body_ja: string | null;
  body_ko: string | null;
  link_href: string | null;
  image_slot: string | null;
  sort_order: number;
}

// ─── 文案 helpers ─────────────────────────────

function pickHubField(item: HubItem | undefined, field: "title" | "body", locale: Locale): string {
  if (!item) return "";
  const key = `${field}_${locale}` as keyof HubItem;
  const fallbackKey = `${field}_en` as keyof HubItem;
  const zhKey = `${field}_zh` as keyof HubItem;
  const v = (item[key] ?? item[fallbackKey] ?? item[zhKey]) as string | null;
  return v ?? "";
}

function pickMilestoneLabel(m: MilestoneConfig, locale: Locale): string {
  if (locale === "en") return m.labelEn;
  if (locale === "ja") return m.labelJa ?? m.labelEn;
  if (locale === "ko") return m.labelKo ?? m.labelEn;
  return m.labelZh;
}

// 從 milestone 資料 + 語系產出說明文字 — 不寫死字串,讓未來改 threshold / reward 自動同步
const TAROT_SUIT_LABELS: Record<string, Record<Locale, string>> = {
  major:     { zh: "大阿爾克那", en: "Major Arcana",  ja: "大アルカナ", ko: "메이저 아르카나" },
  wands:     { zh: "權杖牌組",   en: "Wands suit",    ja: "ワンドの組", ko: "완드 슈트" },
  cups:      { zh: "聖杯牌組",   en: "Cups suit",     ja: "カップの組", ko: "컵 슈트" },
  swords:    { zh: "寶劍牌組",   en: "Swords suit",   ja: "ソードの組", ko: "소드 슈트" },
  pentacles: { zh: "錢幣牌組",   en: "Pentacles suit", ja: "ペンタクルの組", ko: "펜타클 슈트" },
};

function buildMilestoneExplanation(m: MilestoneConfig, locale: Locale): string {
  const reward = m.rewardCredits;
  const threshold = m.threshold;

  if (m.kind === "subkind_full" && m.param) {
    const suit = TAROT_SUIT_LABELS[m.param]?.[locale] ?? m.param;
    if (locale === "en") {
      return `Collect all ${threshold} cards in the ${suit} to unlock this milestone. Draw them one by one through tarot readings — auto-credited with +${reward} once complete (one-time only).`;
    }
    if (locale === "ja") {
      return `「${suit}」全 ${threshold} 枚を集めると達成。タロット占いで少しずつ引き当ててください。完成すると +${reward} ポイントが自動で入帳されます(一度限り)。`;
    }
    if (locale === "ko") {
      return `"${suit}" 전체 ${threshold}장을 모으면 달성됩니다. 타로 점에서 하나씩 뽑아 모으세요. 완성 시 +${reward} 포인트가 자동 지급됩니다(1회 한정).`;
    }
    return `集齊全部 ${threshold} 張「${suit}」即可解鎖。需要在塔羅占卜中陸續抽到全套。完成後自動入帳 +${reward} 點(只發一次)。`;
  }

  // distinct_count
  if (locale === "en") {
    return `Collect ${threshold} different cards in this category (any kind) to unlock. Drawing the same card again does not count. Auto-credited with +${reward} on completion (one-time only).`;
  }
  if (locale === "ja") {
    return `このカテゴリで ${threshold} 枚の異なるカードを集めると達成。同じカードを再度引いてもカウントされません。完成すると +${reward} ポイントが自動で入帳されます(一度限り)。`;
  }
  if (locale === "ko") {
    return `이 카테고리에서 서로 다른 ${threshold}장을 모으면 달성됩니다. 같은 카드를 다시 뽑아도 카운트되지 않습니다. 완성 시 +${reward} 포인트가 자동 지급됩니다(1회 한정).`;
  }
  return `在此分類中集滿 ${threshold} 張不同的牌(無論種類)即可解鎖。同一張重複抽到不會多算。完成後自動入帳 +${reward} 點(只發一次)。`;
}

// ─── Page ─────────────────────────────────────

export default function CollectionHubPage() {
  const { locale } = useLanguage();
  const uiImages = useUiImages();
  const [hub, setHub] = useState<Map<string, HubItem>>(new Map());
  const [iching, setIching] = useState<SectionData | null>(null);
  const [tarot, setTarot] = useState<SectionData | null>(null);
  // Accordion 狀態 — 全頁共用,點開新項目時上一個會自動收起
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);
  const toggleMilestone = (id: string) =>
    setExpandedMilestoneId((prev) => (prev === id ? null : id));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hubRes, ichingRes, tarotRes] = await Promise.all([
          fetch("/api/collection-hub", { cache: "no-store" }),
          fetch("/api/collection?type=iching", { cache: "no-store" }),
          fetch("/api/collection?type=tarot", { cache: "no-store" }),
        ]);
        if (cancelled) return;

        if (hubRes.ok) {
          const j = await hubRes.json();
          const map = new Map<string, HubItem>();
          for (const it of (j.items ?? []) as HubItem[]) map.set(it.id, it);
          setHub(map);
        }
        if (ichingRes.ok) {
          const j: CollectionResponse = await ichingRes.json();
          setIching({
            authenticated: j.authenticated,
            ownedCount: j.ownedCount,
            milestones: j.milestoneConfigs,
            earnedIds: new Set(j.earnedMilestoneIds),
          });
        }
        if (tarotRes.ok) {
          const j: CollectionResponse = await tarotRes.json();
          setTarot({
            authenticated: j.authenticated,
            ownedCount: j.ownedCount,
            milestones: j.milestoneConfigs,
            earnedIds: new Set(j.earnedMilestoneIds),
          });
        }
      } catch {
        // 失敗時頁面用空白文案 + 0/64,不擋
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isAuthenticated =
    iching?.authenticated === true || tarot?.authenticated === true;

  const f = (id: string, field: "title" | "body" = "title") =>
    pickHubField(hub.get(id), field, locale);

  // hero card 圖:優先用 hub 設定的 image_slot,沒設就 fallback 到既有 cta.iching/cta.tarot
  const ichingCard = hub.get("card.iching");
  const tarotCard = hub.get("card.tarot");
  const ichingImage = uiImages[ichingCard?.image_slot ?? "cta.iching"];
  const tarotImage = uiImages[tarotCard?.image_slot ?? "cta.tarot"];

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <main style={{ paddingTop: 88, paddingBottom: 48, paddingLeft: 16, paddingRight: 16, maxWidth: 880, margin: "0 auto" }}>
        {/* ── Header ── */}
        <header style={{ textAlign: "center", marginBottom: 36 }}>
          <h1
            className="text-gold-gradient"
            style={{ fontFamily: "'Noto Serif TC', serif", fontSize: 32, fontWeight: 700, margin: 0 }}
          >
            {f("page.title")}
          </h1>
          <p
            style={{
              color: "#c0c0d0",
              fontSize: 14,
              marginTop: 12,
              lineHeight: 1.7,
              maxWidth: 560,
              margin: "12px auto 0",
              whiteSpace: "pre-line",
            }}
          >
            {f("page.subtitle", "body")}
          </p>
        </header>

        {/* ── 兩張大入口卡 ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <CollectionEntryCard
            href={ichingCard?.link_href ?? "/iching/hexagrams"}
            title={f("card.iching", "title")}
            subtitle={f("card.iching", "body")}
            ownedCount={iching?.ownedCount ?? 0}
            total={64}
            imageUrl={ichingImage}
            isLoading={iching === null}
          />
          <CollectionEntryCard
            href={tarotCard?.link_href ?? "/tarot/cards"}
            title={f("card.tarot", "title")}
            subtitle={f("card.tarot", "body")}
            ownedCount={tarot?.ownedCount ?? 0}
            total={78}
            imageUrl={tarotImage}
            isLoading={tarot === null}
          />
        </div>

        {/* 未登入 CTA */}
        {iching && tarot && !isAuthenticated && (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(212,168,85,0.1), rgba(13,13,43,0.5))",
              border: "1px solid rgba(212,168,85,0.3)",
              marginBottom: 32,
              textAlign: "center",
            }}
          >
            <p style={{ color: "#e8e8f0", fontSize: 14, marginBottom: 12 }}>
              {f("cta.login", "body")}
            </p>
            <Link
              href="/login"
              className="btn-gold"
              style={{ padding: "8px 24px", fontSize: 14, display: "inline-block" }}
            >
              {f("cta.login", "title")}
            </Link>
          </div>
        )}

        {/* ── 收集規則 ── */}
        <section
          style={{
            background: "rgba(13,13,43,0.55)",
            border: "1px solid rgba(212,168,85,0.25)",
            borderRadius: 14,
            padding: "20px 22px",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 18,
              color: "#d4a855",
              marginBottom: 14,
            }}
          >
            ✦ {f("rules.section_title")}
          </h2>
          {[1, 2, 3, 4, 5].map((n) => {
            const item = hub.get(`rule.${n}`);
            if (!item) return null;
            return (
              <Rule
                key={n}
                title={pickHubField(item, "title", locale)}
                body={pickHubField(item, "body", locale)}
              />
            );
          })}
        </section>

        {/* ── 里程碑獎勵 ── */}
        <section
          style={{
            background: "rgba(13,13,43,0.55)",
            border: "1px solid rgba(212,168,85,0.25)",
            borderRadius: 14,
            padding: "20px 22px",
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 18,
              color: "#d4a855",
              marginBottom: 14,
            }}
          >
            🎯 {f("milestones.section_title")}
          </h2>
          <p
            style={{
              color: "rgba(192,192,208,0.7)",
              fontSize: 12,
              lineHeight: 1.7,
              marginBottom: 16,
            }}
          >
            {f("milestones.intro", "body")}
          </p>

          <MilestoneList
            sectionTitle={f("milestones.iching_title")}
            data={iching}
            locale={locale}
            expandedId={expandedMilestoneId}
            onToggle={toggleMilestone}
          />
          <div style={{ height: 14 }} />
          <MilestoneList
            sectionTitle={f("milestones.tarot_title")}
            data={tarot}
            locale={locale}
            expandedId={expandedMilestoneId}
            onToggle={toggleMilestone}
          />
        </section>

        {/* ── 底部提醒 ── */}
        <p
          style={{
            color: "rgba(192,192,208,0.5)",
            fontSize: 11,
            textAlign: "center",
            lineHeight: 1.7,
            marginTop: 24,
          }}
        >
          {f("footer.note", "body")}
        </p>
      </main>
    </div>
  );
}

// ─── 子元件 ────────────────────────────────────

function CollectionEntryCard({
  href,
  title,
  subtitle,
  ownedCount,
  total,
  imageUrl,
  isLoading,
}: {
  href: string;
  title: string;
  subtitle: string;
  ownedCount: number;
  total: number;
  imageUrl: string | undefined;
  isLoading: boolean;
}) {
  const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;
  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(212,168,85,0.35)",
        background: "rgba(13,13,43,0.8)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {imageUrl && (
        <div
          style={{
            width: "100%",
            aspectRatio: "16/10",
            background: "linear-gradient(135deg, rgba(212,168,85,0.10), rgba(13,13,43,0.45))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ color: "#d4a855", fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{title}</div>
        <div style={{ color: "rgba(192,192,208,0.7)", fontSize: 12, marginBottom: 14 }}>{subtitle}</div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 12, color: "rgba(192,192,208,0.7)" }}>進度</span>
          <span style={{ fontSize: 13, color: "#fde68a", fontWeight: 700 }}>
            {isLoading ? "—" : `${ownedCount} / ${total}`}
            {!isLoading && (
              <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 6 }}>({pct}%)</span>
            )}
          </span>
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 9999,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #d4a855, #fde68a)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>
    </Link>
  );
}

function Rule({ title, body }: { title: string; body: string }) {
  if (!title && !body) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      {title && (
        <div style={{ color: "#fde68a", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      )}
      {body && (
        <div style={{ color: "#e8e8f0", fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-line" }}>{body}</div>
      )}
    </div>
  );
}

function MilestoneList({
  sectionTitle,
  data,
  locale,
  expandedId,
  onToggle,
}: {
  sectionTitle: string;
  data: SectionData | null;
  locale: Locale;
  /** 全頁共用的 accordion 開啟中 id;與本 list 的某 milestone 對上時就展開 */
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  if (!data) {
    return (
      <div>
        <div style={{ color: "#fde68a", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{sectionTitle}</div>
        <div style={{ color: "rgba(192,192,208,0.4)", fontSize: 12 }}>載入中…</div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ color: "#fde68a", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{sectionTitle}</div>
      {data.milestones.length === 0 ? (
        <div style={{ color: "rgba(192,192,208,0.4)", fontSize: 12 }}>尚未設定</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.milestones.map((m) => {
            const earned = data.earnedIds.has(m.id);
            const isOpen = expandedId === m.id;
            const explanation = buildMilestoneExplanation(m, locale);
            return (
              <div
                key={m.id}
                style={{
                  borderRadius: 8,
                  background: earned ? "rgba(110,231,183,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${
                    isOpen
                      ? "rgba(212,168,85,0.55)"
                      : earned
                        ? "rgba(110,231,183,0.4)"
                        : "rgba(212,168,85,0.15)"
                  }`,
                  overflow: "hidden",
                  transition: "border-color 0.15s",
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggle(m.id)}
                  aria-expanded={isOpen}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    display: "flex",
                    width: "100%",
                    boxSizing: "border-box",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    fontSize: 13,
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      color: earned ? "#6ee7b7" : "#e8e8f0",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {earned ? "✓ " : ""}
                    {pickMilestoneLabel(m, locale)}
                    <span
                      aria-hidden
                      style={{
                        color: "rgba(212,168,85,0.6)",
                        fontSize: 10,
                        marginLeft: 4,
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                        display: "inline-block",
                      }}
                    >
                      ▾
                    </span>
                  </span>
                  <span
                    style={{
                      color: "#fde68a",
                      fontWeight: 700,
                      fontSize: 12,
                      background: "rgba(212,168,85,0.12)",
                      padding: "2px 10px",
                      borderRadius: 9999,
                      flexShrink: 0,
                    }}
                  >
                    +{m.rewardCredits} ✦
                  </span>
                </button>
                {isOpen && (
                  <div
                    style={{
                      padding: "10px 14px 12px",
                      borderTop: "1px dashed rgba(212,168,85,0.25)",
                      color: "rgba(232,232,240,0.85)",
                      fontSize: 12,
                      lineHeight: 1.75,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
