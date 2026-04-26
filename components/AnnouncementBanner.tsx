"use client";

/**
 * 全站頂部公告 banner
 *
 * 從 /api/announcements 拉所有 active 公告(已 RLS 過濾在時段內)。
 * 多筆會輪播或疊加;目前先顯示最高優先序的一筆。
 *
 * 使用者可關閉(只記在當前 tab 的 sessionStorage,重整還會出來,符合「重要訊息」設計)。
 */

import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

interface Announcement {
  id: number;
  zh_text: string | null;
  en_text: string | null;
  link_url: string | null;
  severity: "info" | "warn" | "critical";
  display_order: number;
}

const DISMISS_KEY_PREFIX = "tarogram_dismissed_announcement_";

export default function AnnouncementBanner() {
  const { locale } = useLanguage();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/announcements", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { announcements: Announcement[] };
        // 取符合當前語系的第一筆
        const list = data.announcements.filter((a) =>
          locale === "zh" ? a.zh_text : a.en_text,
        );
        if (list.length === 0) return;
        const first = list[0];
        // 確認當前 session 沒被關掉這筆
        if (
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(DISMISS_KEY_PREFIX + first.id) === "1"
        ) {
          setDismissed(true);
          return;
        }
        setAnnouncement(first);
      } catch {
        /* noop */
      }
    })();
  }, [locale]);

  if (!announcement || dismissed) return null;

  const text = locale === "zh" ? announcement.zh_text : announcement.en_text;
  if (!text) return null;

  // 嚴重性配色
  const palette =
    announcement.severity === "critical"
      ? {
          bg: "rgba(248,113,113,0.12)",
          border: "rgba(248,113,113,0.5)",
          color: "#fca5a5",
        }
      : announcement.severity === "warn"
        ? {
            bg: "rgba(255,176,72,0.12)",
            border: "rgba(255,176,72,0.45)",
            color: "#ffd99a",
          }
        : {
            bg: "rgba(212,168,85,0.10)",
            border: "rgba(212,168,85,0.35)",
            color: "#d4a855",
          };

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISS_KEY_PREFIX + announcement.id, "1");
    }
  };

  const inner = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span aria-hidden>{announcement.severity === "critical" ? "⚠" : announcement.severity === "warn" ? "ⓘ" : "✦"}</span>
      <span>{text}</span>
    </span>
  );

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 64, // header 下方
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "8px 16px",
        background: palette.bg,
        borderBottom: `1px solid ${palette.border}`,
        color: palette.color,
        fontSize: 13,
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      {announcement.link_url ? (
        <a
          href={announcement.link_url}
          target={announcement.link_url.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          {inner}
        </a>
      ) : (
        inner
      )}
      <button
        onClick={handleDismiss}
        aria-label="關閉公告"
        style={{
          background: "none",
          border: "none",
          color: "inherit",
          opacity: 0.6,
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
