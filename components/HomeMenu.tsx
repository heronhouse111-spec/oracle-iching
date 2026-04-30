"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useLanguage } from "@/i18n/LanguageContext";

interface Label {
  tw: string;
  en: string;
  ja: string;
  ko: string;
}

interface NavLeaf {
  /** unique key for state (since two leaves at different depths might share label) */
  key: string;
  href: string;
  label: Label;
}

interface NavBranch {
  key: string;
  label: Label;
  children: NavLeaf[];
}

type NavItem = NavLeaf | NavBranch;

interface NavGroup {
  heading?: Label;
  items: NavItem[];
}

const isBranch = (item: NavItem): item is NavBranch =>
  (item as NavBranch).children !== undefined;

const ICHING_TAROT_CHILDREN = (parentKey: string, ichingHref: string, tarotHref: string): NavLeaf[] => [
  {
    key: `${parentKey}-iching`,
    href: ichingHref,
    label: { tw: "易經", en: "I-Ching", ja: "易経", ko: "역경" },
  },
  {
    key: `${parentKey}-tarot`,
    href: tarotHref,
    label: { tw: "塔羅", en: "Tarot", ja: "タロット", ko: "타로" },
  },
];

const GROUPS: NavGroup[] = [
  {
    items: [
      {
        key: "home",
        href: "/",
        label: { tw: "首頁", en: "Home", ja: "ホーム", ko: "홈" },
      },
    ],
  },
  {
    heading: { tw: "輕量占卜", en: "Quick readings", ja: "クイック占い", ko: "간편 점" },
    items: [
      {
        key: "yes-no",
        label: { tw: "Yes/No 占卜", en: "Yes/No", ja: "Yes/No 占い", ko: "Yes/No 점" },
        children: ICHING_TAROT_CHILDREN("yes-no", "/iching/yes-no", "/yes-no"),
      },
      {
        key: "daily",
        label: { tw: "每日一占卜", en: "Daily Reading", ja: "今日の占い", ko: "오늘의 점" },
        children: ICHING_TAROT_CHILDREN("daily", "/iching/daily", "/daily"),
      },
    ],
  },
  {
    heading: { tw: "塔羅", en: "Tarot", ja: "タロット", ko: "타로" },
    items: [
      {
        key: "tarot-78",
        href: "/tarot/cards",
        label: { tw: "78 張牌意", en: "78 Cards", ja: "78枚の意味", ko: "78장 카드 의미" },
      },
      {
        key: "tarot-spreads",
        href: "/tarot-spread",
        label: { tw: "牌陣大全", en: "Spreads", ja: "スプレッド", ko: "스프레드" },
      },
    ],
  },
  {
    heading: { tw: "易經", en: "I-Ching", ja: "易経", ko: "역경" },
    items: [
      {
        key: "iching-64",
        href: "/iching/hexagrams",
        label: { tw: "64 卦圖鑑", en: "64 Hexagrams", ja: "64卦図鑑", ko: "64괘 도감" },
      },
      {
        key: "iching-methods",
        href: "/iching/methods",
        label: { tw: "易經卜法", en: "Methods", ja: "易の占法", ko: "역경 점법" },
      },
    ],
  },
  {
    items: [
      {
        key: "blog",
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
  // 一次只展開一個 branch — 點同一個再點一次會收起
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setExpandedKey(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setExpandedKey(null);
      }
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
    setExpandedKey(null);
    if (pathname === href) {
      window.location.assign(href);
      return;
    }
    router.push(href);
  };

  const toggleBranch = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (open) setExpandedKey(null);
        }}
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
                if (isBranch(item)) {
                  const expanded = expandedKey === item.key;
                  return (
                    <div key={item.key}>
                      <button
                        role="menuitem"
                        aria-haspopup="menu"
                        aria-expanded={expanded}
                        onClick={() => toggleBranch(item.key)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: "none",
                          background: expanded ? "rgba(212,168,85,0.08)" : "transparent",
                          color: "#e8e8f0",
                          fontSize: 14,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                        onMouseEnter={(e) => {
                          if (!expanded) e.currentTarget.style.background = "rgba(212,168,85,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          if (!expanded) e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <span>{t(item.label.tw, item.label.en, item.label.ja, item.label.ko)}</span>
                        <span
                          aria-hidden
                          style={{
                            display: "inline-block",
                            transition: "transform 0.15s",
                            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                            fontSize: 10,
                            color: "rgba(212,168,85,0.7)",
                          }}
                        >
                          ▸
                        </span>
                      </button>
                      {expanded && (
                        <div
                          role="menu"
                          style={{
                            paddingLeft: 14,
                            borderLeft: "1px solid rgba(212,168,85,0.18)",
                            margin: "2px 0 4px 12px",
                          }}
                        >
                          {item.children.map((child) => {
                            const active = pathname === child.href;
                            return (
                              <button
                                key={child.key}
                                role="menuitem"
                                onClick={() => navigate(child.href)}
                                style={{
                                  width: "100%",
                                  textAlign: "left",
                                  padding: "7px 12px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: active ? "rgba(212,168,85,0.15)" : "transparent",
                                  color: active ? "#fde68a" : "#e8e8f0",
                                  fontSize: 13,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                                onMouseEnter={(e) => {
                                  if (!active) e.currentTarget.style.background = "rgba(212,168,85,0.08)";
                                }}
                                onMouseLeave={(e) => {
                                  if (!active) e.currentTarget.style.background = "transparent";
                                }}
                              >
                                {t(child.label.tw, child.label.en, child.label.ja, child.label.ko)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                const active = pathname === item.href;
                return (
                  <button
                    key={item.key}
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
