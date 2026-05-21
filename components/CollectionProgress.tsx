"use client";

/**
 * CollectionProgress — 收藏進度條 + 里程碑列表
 *
 * 給 /iching/hexagrams 跟 /tarot/cards 兩個圖鑑頁複用。
 * 自己 fetch /api/collection?type=...,把 owned ids 透過 onOwnedChange 回拋給上層
 * (上層用來決定 grid 哪些卡灰階)。
 *
 * 未登入:顯示全 0 進度 + 「登入後追蹤收集進度」CTA。
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

interface MilestoneConfig {
  id: string;
  collectionType: "iching" | "iching_trigram" | "tarot";
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
  type: "iching" | "iching_trigram" | "tarot";
  owned: Array<{ cardId: string; obtainCount: number; firstObtainedAt: string; lastObtainedAt: string }>;
  ownedCount: number;
  milestoneConfigs: MilestoneConfig[];
  earnedMilestoneIds: string[];
}

interface Props {
  type: "iching" | "iching_trigram" | "tarot";
  /** 該 type 卡牌總數(易經 64,塔羅 78)— 用於進度條的分母 */
  total: number;
  /** 把 owned set + earned milestone set 回拋給 parent,parent 可以決定 grid 上灰階 / icon */
  onLoaded: (data: {
    /** 是否已登入。未登入時 parent 應全彩展示(預覽模式),別套灰階。 */
    authenticated: boolean;
    ownedIds: Set<string>;
    earnedMilestoneIds: Set<string>;
    /** 給 parent 用 — 為了 tarot subkind 統計 */
    ownedCount: number;
    /** cardId → 抽到次數,給 ×N 重複徽章用 */
    obtainCounts: Map<string, number>;
  }) => void;
}

export default function CollectionProgress({ type, total, onLoaded }: Props) {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<CollectionResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/collection?type=${type}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json: CollectionResponse = await res.json();
        if (cancelled) return;
        const ownedIds = new Set(json.owned.map((o) => o.cardId));
        const earnedIds = new Set(json.earnedMilestoneIds);
        const obtainCounts = new Map(json.owned.map((o) => [o.cardId, o.obtainCount]));
        onLoaded({
          authenticated: json.authenticated,
          ownedIds,
          earnedMilestoneIds: earnedIds,
          ownedCount: json.ownedCount,
          obtainCounts,
        });
        setData(json);
      } catch {
        // ignore — 進度條不顯示就不顯示,不影響圖鑑主功能
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, onLoaded]);

  const ownedCount = data?.ownedCount ?? 0;
  const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;

  const localeName = (m: MilestoneConfig): string => {
    if (locale === "en") return m.labelEn;
    if (locale === "ja") return m.labelJa ?? m.labelEn;
    if (locale === "ko") return m.labelKo ?? m.labelEn;
    return m.labelZh;
  };

  const earnedIds = new Set(data?.earnedMilestoneIds ?? []);
  const milestones = data?.milestoneConfigs ?? [];

  return (
    <section
      style={{
        background: "rgba(13,13,43,0.55)",
        border: "1px solid rgba(212,168,85,0.25)",
        borderRadius: 14,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h3
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 16,
            color: "#d4a855",
            margin: 0,
          }}
        >
          ✦ {t("我的收藏進度", "My Collection", "収集進度", "수집 진행도")}
        </h3>
        <div style={{ fontSize: 13, color: "#fde68a", fontWeight: 700 }}>
          {ownedCount} / {total}{" "}
          <span style={{ opacity: 0.6, fontWeight: 400 }}>({pct}%)</span>
        </div>
      </div>

      {/* 進度條 */}
      <div
        style={{
          height: 8,
          borderRadius: 9999,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
          marginBottom: 14,
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

      {/* 里程碑 */}
      {milestones.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {milestones.map((m) => {
            const earned = earnedIds.has(m.id);
            return (
              <span
                key={m.id}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 9999,
                  background: earned
                    ? "rgba(110,231,183,0.12)"
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${earned ? "rgba(110,231,183,0.4)" : "rgba(212,168,85,0.2)"}`,
                  color: earned ? "#6ee7b7" : "rgba(192,192,208,0.65)",
                }}
                title={`${localeName(m)} — +${m.rewardCredits} ✦`}
              >
                {earned ? "✓ " : ""}
                {localeName(m)}
                <span style={{ opacity: 0.6, marginLeft: 6 }}>
                  +{m.rewardCredits}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* 未登入 CTA — 比一般 footer 大一截,首屏曝光率高,觸發收藏慾望 */}
      {data && !data.authenticated && (
        <div
          style={{
            marginTop: 16,
            padding: "16px 18px",
            borderRadius: 12,
            background:
              "linear-gradient(135deg, rgba(212,168,85,0.18), rgba(139,92,246,0.12))",
            border: "1px solid rgba(212,168,85,0.45)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>✨</span>
            <div
              style={{
                fontFamily: "'Noto Serif TC', serif",
                fontSize: 15,
                fontWeight: 700,
                color: "#fde68a",
                lineHeight: 1.4,
              }}
            >
              {t(
                "登入後,每次占卜抽到的卡都會永久留下",
                "Sign in — every card you draw stays with you, forever",
                "ログインで、引いたカードがあなたのものに",
                "로그인하면 뽑은 카드가 영원히 당신의 것",
              )}
            </div>
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "grid",
              gap: 6,
              fontSize: 12.5,
              color: "rgba(229,229,240,0.88)",
              lineHeight: 1.6,
            }}
          >
            <li>
              🎁{" "}
              {t(
                "首次登入贈 30 點(夠你占 6 次 + 收幾張首發卡)",
                "30 free credits on first login (≈ 6 readings + your first few cards)",
                "初回ログインで 30 ポイント贈呈(占い 6 回 + 初コレクション)",
                "첫 로그인 시 30 포인트 증정(점 6회 + 첫 카드 수집)",
              )}
            </li>
            <li>
              ✦{" "}
              {t(
                "收藏進度永久保留,跨裝置同步",
                "Collection saved across devices, never lost",
                "コレクション進捗は永久保存・端末間同期",
                "수집 진행도 영구 보관, 기기 간 동기화",
              )}
            </li>
            <li>
              🏆{" "}
              {t(
                "達到收集里程碑會自動加贈點數",
                "Hit collection milestones to earn bonus credits",
                "コレクション達成ごとにポイント自動贈呈",
                "수집 마일스톤 달성마다 자동 보너스",
              )}
            </li>
          </ul>
          <Link
            href="/login"
            style={{
              alignSelf: "stretch",
              padding: "12px 18px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #d4a855, #f0d78c)",
              color: "#0a0a1a",
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "none",
              textAlign: "center",
              boxShadow: "0 4px 18px rgba(212,168,85,0.4)",
              letterSpacing: 1,
            }}
          >
            ✦ {t(
              "登入,開始我的收藏",
              "Sign in — start collecting",
              "ログインしてコレクション開始",
              "로그인하고 수집 시작",
            )}{" "}
            →
          </Link>
        </div>
      )}
    </section>
  );
}
