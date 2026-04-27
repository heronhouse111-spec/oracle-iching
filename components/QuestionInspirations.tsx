"use client";

/**
 * QuestionInspirations — 問題靈感 picker
 *
 * 在 step="question" 的 textarea 下方顯示 6 大類 + 子標題 + 問句小卡。
 * 點問句 → onPickQuestion(text, categoryId) 由父層 setUserQuestion + 同步 selectedCategory。
 *
 * UX 細節:
 * - tab 預設高亮父層傳入的 selectedCategoryId,使用者也可切到別類瀏覽
 * - tab 列橫向可滾(類別超出 640px 時)
 * - 問句卡點下去視覺上 ripple 一下,讓人知道有反應
 */

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { questionCategories } from "@/lib/divination";
import {
  QUESTION_INSPIRATIONS,
  type InspirationGroup,
  type InspirationQuestion,
} from "@/data/questionInspirations";

interface Props {
  selectedCategoryId: string;
  onPickQuestion: (text: string, categoryId: string) => void;
}

export default function QuestionInspirations({
  selectedCategoryId,
  onPickQuestion,
}: Props) {
  const { locale, t } = useLanguage();
  const [activeCat, setActiveCat] = useState(selectedCategoryId || "love");

  const groups = QUESTION_INSPIRATIONS[activeCat] ?? [];

  const localizedQuestion = (q: InspirationQuestion): string => {
    if (locale === "en") return q.en;
    if (locale === "ja") return q.ja ?? q.en;
    if (locale === "ko") return q.ko ?? q.en;
    return q.zh;
  };

  const localizedGroupTitle = (g: InspirationGroup): string => {
    if (locale === "en") return g.titleEn;
    if (locale === "ja") return g.titleJa ?? g.titleEn;
    if (locale === "ko") return g.titleKo ?? g.titleEn;
    return g.titleZh;
  };

  const localizedCategoryName = (cat: typeof questionCategories[number]): string => {
    // 目前只有 zh / en — 其他 locale fallback en
    if (locale === "zh") return cat.nameZh;
    return cat.nameEn;
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        background: "rgba(13,13,43,0.4)",
        border: "1px solid rgba(212,168,85,0.15)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "rgba(212,168,85,0.7)",
          marginBottom: 10,
          letterSpacing: 0.5,
        }}
      >
        {t("✦ 問題靈感", "✦ Question Ideas", "✦ 質問のヒント", "✦ 질문 영감")}
      </div>

      {/* Category tabs — 橫向可滾 */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 6,
          marginBottom: 12,
          // hide scrollbar on webkit
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "thin",
        }}
      >
        {questionCategories.map((cat) => {
          const isActive = cat.id === activeCat;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              style={{
                flexShrink: 0,
                padding: "6px 12px",
                borderRadius: 9999,
                border: isActive
                  ? "1px solid rgba(212,168,85,0.7)"
                  : "1px solid rgba(255,255,255,0.1)",
                background: isActive
                  ? "linear-gradient(135deg, rgba(212,168,85,0.25), rgba(212,168,85,0.1))"
                  : "rgba(255,255,255,0.02)",
                color: isActive ? "#d4a855" : "rgba(192,192,208,0.8)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ marginRight: 4 }}>{cat.icon}</span>
              {localizedCategoryName(cat)}
            </button>
          );
        })}
      </div>

      {/* Groups + question chips */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groups.map((g, gi) => (
          <div key={gi}>
            <div
              style={{
                fontSize: 12,
                color: "rgba(212,168,85,0.85)",
                fontWeight: 600,
                marginBottom: 6,
                letterSpacing: 0.3,
              }}
            >
              {localizedGroupTitle(g)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.questions.map((q, qi) => {
                const text = localizedQuestion(q);
                return (
                  <button
                    key={qi}
                    onClick={() => onPickQuestion(text, activeCat)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.02)",
                      color: "#e8e8f0",
                      fontSize: 13,
                      lineHeight: 1.5,
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition:
                        "background 0.15s ease, border-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(212,168,85,0.08)";
                      e.currentTarget.style.borderColor =
                        "rgba(212,168,85,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.02)";
                      e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.06)";
                    }}
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
