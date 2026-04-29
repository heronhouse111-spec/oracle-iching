"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useLanguage } from "@/i18n/LanguageContext";

interface NavItem {
  href: string;
  label: { tw: string; en: string; ja: string; ko: string };
}

interface NavGroup {
  heading?: { tw: string; en: string; ja: string; ko: string };
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    items: [
      {
        href: "/",
        label: { tw: "首頁", en: "Home", ja: "ホーム", ko: "홈" },
      },
    ],
  },
  {
    heading: { tw: "輕量占卜", en: "Quick readings", ja: "クイック占い", ko: "간편 점" },
    items: [
      {
        href: "/yes-no",
        label: { tw: "Yes/No 占卜", en: "Yes/No", ja: "Yes/No 占い", ko: "Yes/No 점" },
      },
      {
        href: "/daily",
        label: { tw: "每日一卡", en: "Daily Card", ja: "今日の一枚", ko: "오늘의 카드" },
      },
    ],
  },
  {
    heading: { tw: "塔羅", en: "Tarot", ja: "タロット", ko: "타로" },
    items: [
      {
        href: "/tarot/cards",
        label: { tw: "78 張牌意", en: "78 Cards", ja: "78枚の意味", ko: "78장 카드 의미" },
      },
      {
        href: "/tarot-spread",
        label: { tw: "牌陣大全", en: "Spreads", ja: "スプレッド", ko: "스프레드" },
      },
    ],
  },
  {
    heading: { tw: "易經", en: "I-Ching", ja: "易経", ko: "역경" },
    items: [
      {
        href: "/iching/hexagrams",
        label: { tw: "64 卦圖鑑", en: "64 Hexagrams", ja: "64卦図鑑", ko: "64괘 도감" },
      },
      {
        href: "/iching/methods",
        label: { tw: "易經卜法", en: "Methods", ja: "易の占法", ko: "역경 점법" },
      },
    ],
  },
  {
    items: [
      {
        href: "/blog",
        label: { tw: "部落格", en: "Blog", ja: "ブログ", ko: "블로그" },
      },
    ],
  },
];

export default function HomeMenu() {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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

  // 已在某個 route。若 user 點同一個 route,Next router.push 不會 remount,
  // 占卜過程的 state 會留著 → 看起來像沒反應。對首頁特別重要,所以 hard reload 它。
  const navigate = (href: string) => {
    setOpen(false);
    if (pathname === href) {
      window.location.assign(href);
      return;
    }
    router.push(href);
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("主選單", "Main menu", "メインメニュー", "메인 메뉴")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          color: "inherit",
        }}
      >
        <Image
          src="/logo-64.png"
          alt={t("易問", "Tarogram", "易問", "타로그램")}
          width={36}
          height={36}
          priority
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            display: "block",
            boxShadow: "0 0 12px rgba(212,168,85,0.35)",
          }}
        />
        <span
          className="text-gold-gradient"
          style={{ fontFamily: "'Noto Serif TC', serif", fontWeight: 700, fontSize: 18 }}
        >
          {t("易問", "Tarogram", "易問", "타로그램")}
        </span>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            fontSize: 10,
            marginLeft: 2,
            color: "rgba(212,168,85,0.7)",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            margin: 0,
            padding: 6,
            minWidth: 200,
            background: "rgba(13,13,43,0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(212,168,85,0.3)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            zIndex: 60,
          }}
        >
          {GROUPS.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && (
                <div
                  style={{
                    height: 1,
                    background: "rgba(212,168,85,0.15)",
                    margin: "4px 6px",
                  }}
                />
              )}
              {group.heading && (
                <div
                  style={{
                    padding: "6px 10px 2px",
                    fontSize: 10,
                    letterSpacing: 1,
                    color: "rgba(212,168,85,0.55)",
                    textTransform: "uppercase",
                  }}
                >
                  {t(
                    group.heading.tw,
                    group.heading.en,
                    group.heading.ja,
                    group.heading.ko
                  )}
                </div>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    role="menuitem"
                    onClick={() => navigate(item.href)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: active ? "rgba(212,168,85,0.15)" : "transparent",
                      color: active ? "#fde68a" : "#e8e8f0",
                      fontSize: 14,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = "rgba(212,168,85,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {t(item.label.tw, item.label.en, item.label.ja, item.label.ko)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
