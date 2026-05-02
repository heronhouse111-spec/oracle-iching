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
  owned: Array<{ cardId: string; obtainCount: number; firstObtainedAt: string; lastObtainedAt: string }>;
  ownedCount: number;
  milestoneConfigs: MilestoneConfig[];
  earnedMilestoneIds: string[];
}

interface Props {
  type: "iching" | "tarot";
  /** 該 type 卡牌總數(易經 64,塔羅 78)— 用於進度條的分母 */
  total: number;
  /** 把 owned set + earned milestone set 回拋給 parent,parent 可以決定 grid 上灰階 / icon */
  onLoaded: (data: {
    ownedIds: Set<string>;
    earnedMilestoneIds: Set<string>;
    /** 給 parent 用 — 為了 tarot subkind 統計 */
    ownedCount: number;
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
        onLoaded({
          ownedIds,
          earnedMilestoneIds: earnedIds,
          ownedCount: json.ownedCount,
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

      {/* 未登入 CTA */}
      {data && !data.authenticated && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px dashed rgba(212,168,85,0.2)",
            fontSize: 12,
            color: "rgba(192,192,208,0.7)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span>
            {t(
              "登入後即可開始收集 — 抽到的卡片會變成彩色,集到一定數量還有點數獎勵。",
              "Sign in to start collecting — drawn cards turn from grey to colour, with credit rewards at milestones.",
              "ログインで収集開始 — 引いたカードがカラーになり、達成ごとにポイント報酬。",
              "로그인 후 수집 시작 — 뽑은 카드가 컬러가 되고, 달성마다 포인트 보상.",
            )}
          </span>
          <Link
            href="/login"
            style={{
              padding: "6px 14px",
              borderRadius: 9999,
              background: "linear-gradient(135deg, #d4a855, #f0d78c)",
              color: "#0a0a1a",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {t("登入", "Sign in", "ログイン", "로그인")}
          </Link>
        </div>
      )}
    </section>
  );
}
