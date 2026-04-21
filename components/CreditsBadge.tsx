"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageContext";
import { CREDITS_CHANGED_EVENT } from "@/lib/clientCredits";

/**
 * Header 點數徽章 —— 只有登入者看得到。
 * 顯示當前餘額,聽 "credits:changed" 事件自動 refetch。
 * 點下去跳轉到 /account(會員頁面後續會加購買點數入口)。
 */
export default function CreditsBadge() {
  const { t } = useLanguage();
  const [balance, setBalance] = useState<number | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null); // null = 還在查
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/credits/balance", { cache: "no-store" });
      if (!res.ok) {
        // 500 之類的失敗 —— 不打擾使用者,就讓 badge 維持原樣
        return;
      }
      const data = await res.json();
      setAuthed(Boolean(data.authenticated));
      setBalance(
        typeof data.balance === "number" ? data.balance : null
      );
    } catch {
      // 靜默處理,點數只是輔助顯示
    } finally {
      setLoading(false);
    }
  }, []);

  // mount + 每次切頁可能回到有 header 的頁面都 refetch
  useEffect(() => {
    refetch();
  }, [refetch]);

  // 聽全站 credits:changed 事件(API 呼叫端成功後 dispatch)
  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener(CREDITS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, handler);
  }, [refetch]);

  // 登入狀態改變也要 refetch(Auth 切換時)
  useEffect(() => {
    let mounted = true;
    import("@/lib/supabase/client").then(({ createClient }) => {
      if (!mounted) return;
      const supabase = createClient();
      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        refetch();
      });
      return () => sub.subscription.unsubscribe();
    });
    return () => {
      mounted = false;
    };
  }, [refetch]);

  // 未登入 / 還在查 → 不渲染(避免 header 閃動)
  if (authed !== true || balance === null) return null;

  // 快耗盡時(< 5 點)改紅色提醒
  const low = balance < 5;
  const borderColor = low ? "rgba(239, 68, 68, 0.45)" : "rgba(212,168,85,0.3)";
  const textColor = low ? "#ef4444" : "#d4a855";
  const bg = low ? "rgba(239, 68, 68, 0.08)" : "rgba(212,168,85,0.08)";

  return (
    <Link
      href="/account/credits"
      title={t("點擊購買或管理點數", "Purchase or manage credits")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 10px",
        borderRadius: 9999,
        border: `1px solid ${borderColor}`,
        background: bg,
        color: textColor,
        fontSize: 12,
        fontWeight: 600,
        textDecoration: "none",
        opacity: loading ? 0.6 : 1,
        transition: "opacity 0.15s",
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: 11 }}>✦</span>
      <span>{balance}</span>
    </Link>
  );
}
