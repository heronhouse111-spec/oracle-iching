"use client";

/**
 * LocaleDropdown — 5 種語系下拉選擇 (Header 右上角)
 *
 * 為什麼下拉而不是 cycle 按鈕:cycle 要點到對的語言可能要按 4 次,使用者體驗差。
 * 下拉直接看到全部選項一次選到位。
 *
 * 切換邏輯:
 *   1. setLocale + setZhVariant — 同步 React state、localStorage、cookie。
 *      Client component 會因 state 變動自動 re-render。
 *   2. router.refresh() — 強制 Next.js 重新拉 RSC payload,讓讀 cookie 的
 *      server component (例如 /tarot/cards、/iching/hexagrams) 也立刻用
 *      新 locale 重新渲染,使用者不必手動 reload 整頁。
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLanguage, type Locale, type ZhVariant } from "@/i18n/LanguageContext";

interface LocaleOption {
  id: string;
  label: string; // 顯示在下拉清單裡的「自己語系」標籤
  short: string; // 摺疊狀態的短標籤(繁/简/EN/日/한)
  locale: Locale;
  variant: ZhVariant;
}

const OPTIONS: LocaleOption[] = [
  { id: "zh-TW", label: "繁體中文", short: "繁", locale: "zh", variant: "TW" },
  { id: "zh-CN", label: "简体中文", short: "简", locale: "zh", variant: "CN" },
  { id: "en", label: "English", short: "EN", locale: "en", variant: "TW" },
  { id: "ja", label: "日本語", short: "日", locale: "ja", variant: "TW" },
  { id: "ko", label: "한국어", short: "한", locale: "ko", variant: "TW" },
];

function currentOptionId(locale: Locale, zhVariant: ZhVariant): string {
  if (locale === "en") return "en";
  if (locale === "ja") return "ja";
  if (locale === "ko") return "ko";
  return zhVariant === "CN" ? "zh-CN" : "zh-TW";
}

export default function LocaleDropdown() {
  const { locale, zhVariant, setLocale, setZhVariant } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // outside click / escape 都關掉下拉
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentId = currentOptionId(locale, zhVariant);
  const current = OPTIONS.find((o) => o.id === currentId) ?? OPTIONS[0];

  const pick = (opt: LocaleOption) => {
    if (opt.id === currentId) {
      setOpen(false);
      return;
    }
    setLocale(opt.locale);
    if (opt.locale === "zh") {
      setZhVariant(opt.variant);
    }
    setOpen(false);
    // 讀 cookie 的 server page 不會自己重畫,叫 router 重拉一次 RSC payload
    router.refresh();
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 10px 6px 12px",
          borderRadius: 9999,
          border: "1px solid rgba(212,168,85,0.3)",
          color: "#d4a855",
          fontSize: 12,
          background: "none",
          cursor: "pointer",
          minWidth: 56,
          fontFamily: "inherit",
        }}
      >
        <span>{current.short}</span>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            fontSize: 9,
            marginLeft: 2,
            opacity: 0.7,
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Choose language"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            margin: 0,
            padding: 4,
            listStyle: "none",
            minWidth: 152,
            background: "rgba(13,13,43,0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(212,168,85,0.3)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            zIndex: 60,
          }}
        >
          {OPTIONS.map((opt) => {
            const active = opt.id === currentId;
            return (
              <li key={opt.id}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(opt)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: active ? "rgba(212,168,85,0.15)" : "transparent",
                    color: active ? "#fde68a" : "#e8e8f0",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "rgba(212,168,85,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span>{opt.label}</span>
                  {active && (
                    <span aria-hidden style={{ color: "#d4a855", fontSize: 12 }}>
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
