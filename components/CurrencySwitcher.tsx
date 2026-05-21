"use client";

/**
 * CurrencySwitcher —— TWD / USD 切換器。
 *
 * 用於 /account/credits、/account/upgrade 頁面頂部。
 * 點擊立即反應,透過 useCurrency 寫入 localStorage + cookie。
 *
 * 設計:淡金邊分段按鈕(segmented control),保持 mystic-card 視覺語言一致。
 */

import { useLanguage } from "@/i18n/LanguageContext";
import { useCurrency } from "@/lib/geo/useCurrency";
import type { Currency } from "@/lib/pricing";

const CURRENCIES: { value: Currency; label: string; flag: string }[] = [
  { value: "TWD", label: "NT$", flag: "🇹🇼" },
  { value: "USD", label: "US$", flag: "🌐" },
];

export default function CurrencySwitcher() {
  const { t } = useLanguage();
  const { currency, autoDetected, setCurrency } = useCurrency();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginBottom: 20,
      }}
    >
      <span
        style={{
          color: "rgba(192,192,208,0.5)",
          fontSize: 11,
          letterSpacing: 0.5,
        }}
      >
        {t("幣別", "Currency", "通貨", "통화")}
      </span>
      <div
        role="group"
        aria-label={t("幣別選擇", "Currency", "通貨選択", "통화 선택")}
        style={{
          display: "inline-flex",
          padding: 3,
          borderRadius: 9999,
          border: "1px solid rgba(212,168,85,0.3)",
          background: "rgba(212,168,85,0.04)",
        }}
      >
        {CURRENCIES.map((c) => {
          const active = currency === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setCurrency(c.value)}
              aria-pressed={active}
              style={{
                padding: "4px 12px",
                borderRadius: 9999,
                border: "none",
                background: active
                  ? "linear-gradient(135deg, #d4a855 0%, #b88a3f 100%)"
                  : "transparent",
                color: active ? "#1a1530" : "rgba(192,192,208,0.7)",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                letterSpacing: 0.5,
                cursor: "pointer",
                transition: "background 0.15s ease, color 0.15s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 10 }}>{c.flag}</span>
              {c.label}
            </button>
          );
        })}
      </div>
      {autoDetected && (
        <span
          title={t(
            "依所在地區自動偵測",
            "Auto-detected from your region",
            "地域から自動検出",
            "지역에서 자동 감지"
          )}
          style={{
            color: "rgba(192,192,208,0.4)",
            fontSize: 10,
          }}
        >
          {t("自動", "auto", "自動", "자동")}
        </span>
      )}
    </div>
  );
}
