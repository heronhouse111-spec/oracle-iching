"use client";

/**
 * PWA 安裝提示 —— 橫幅式,底部浮出。
 *
 * 規則:
 * - 已用 standalone 模式開啟 → 不顯示(使用者已經安裝)。
 * - Android / desktop Chrome:捕捉 beforeinstallprompt,保留 event 供按鈕呼叫。
 *   使用者按「加入主畫面」→ prompt.prompt() 跳系統對話框。
 * - iOS Safari:沒有 beforeinstallprompt,偵測 UA 後顯示「分享 → 加入主畫面」圖文。
 * - 非 Android / 非 iOS Safari(例如 iOS Chrome, Firefox mobile):隱藏不吵人。
 *
 * 頻率控制:
 * - 首次符合條件時不立刻跳,等使用者造訪第 3 次(localStorage 計數),
 *   避免剛進站就被推銷。
 * - 使用者按「下次再說」→ 記下 ts,30 天內不再跳。
 * - 按「加入主畫面」成功 → 永久不跳。
 *
 * 視覺:沿用專案 mystic-card / gold 色調。
 */

import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIsTWA } from "@/lib/env/useIsTWA";

// Chrome 自訂事件型別 —— TS lib.dom 沒內建
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const VISIT_KEY = "oracle_pwa_visits";
const DISMISS_KEY = "oracle_pwa_dismissed_at";
const INSTALLED_KEY = "oracle_pwa_installed";
const MIN_VISITS = 3;
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Android / desktop
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  if ((window.navigator as { standalone?: boolean }).standalone) return true;
  return false;
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPhone/iPad/iPod + Safari(不含 Chrome / FxiOS / CriOS)
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function bumpVisitCount(): number {
  try {
    const prev = Number(localStorage.getItem(VISIT_KEY) ?? "0");
    const next = prev + 1;
    localStorage.setItem(VISIT_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

function isInCooldown(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
    if (!ts) return false;
    return Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function wasInstalled(): boolean {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "true";
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const { t } = useLanguage();
  const isTwa = useIsTWA();
  const [show, setShow] = useState(false);
  const [iosMode, setIosMode] = useState(false);
  const [deferredEvent, setDeferredEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // ⚠ TWA(Google Play 上架的 Android app)內絕對不顯示「加入主畫面」提示。
    // Play 政策(anti-steering)禁止 app 內出現引導用戶到 web 版本 / 外部安裝管道的內容。
    // 雖然 isStandalone() 會擋掉大部分 TWA 情境,但保險起見再加一層。
    if (isTwa) return;

    // 已安裝 / 已 standalone / 之前裝過 → 完全不顯示
    if (isStandalone() || wasInstalled()) return;
    if (isInCooldown()) return;

    const visits = bumpVisitCount();
    if (visits < MIN_VISITS) return;

    // Android / desktop Chrome:等 beforeinstallprompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // 阻止 Chrome 自動跳 mini-infobar
      setDeferredEvent(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // 使用者從 Chrome 系統對話框或自家按鈕完成安裝
    const onInstalled = () => {
      try {
        localStorage.setItem(INSTALLED_KEY, "true");
      } catch {
        // localStorage 寫失敗 → 下次還會跳,可接受
      }
      setShow(false);
      setDeferredEvent(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari:沒事件,但符合條件就主動跳圖文
    if (isIOSSafari()) {
      setIosMode(true);
      setShow(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const result = await deferredEvent.userChoice;
    if (result.outcome === "accepted") {
      try {
        localStorage.setItem(INSTALLED_KEY, "true");
      } catch {
        // 寫失敗 → 下次仍會顯示,可接受
      }
    } else {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        // 寫失敗 → cooldown 失效,可接受(下次會再跳)
      }
    }
    setShow(false);
    setDeferredEvent(null);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // 寫失敗 → cooldown 失效,可接受
    }
    setShow(false);
  };

  // 雙重保險:即使 useEffect 那邊邏輯有漏,render 前再 TWA guard 一次,
  // 確保 TWA 內絕對不會顯示安裝 banner(Play anti-steering 合規)
  if (isTwa) return null;
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label={t("加入主畫面", "Install app")}
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "max(12px, env(safe-area-inset-bottom))",
        zIndex: 9000,
        margin: "0 auto",
        maxWidth: 420,
        padding: "14px 16px",
        borderRadius: 14,
        background: "rgba(20,20,36,0.95)",
        border: "1px solid rgba(212,168,85,0.35)",
        boxShadow:
          "0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(212,168,85,0.15) inset",
        backdropFilter: "blur(10px)",
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("關閉", "Close")}
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          width: 24,
          height: 24,
          background: "none",
          border: "none",
          color: "rgba(192,192,208,0.55)",
          fontSize: 16,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ×
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          aria-hidden
          style={{
            flexShrink: 0,
            fontSize: 26,
            marginTop: 2,
          }}
        >
          ✦
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="text-gold-gradient"
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {t("把 Tarogram 加到主畫面", "Add Tarogram to home screen")}
          </div>

          {iosMode ? (
            <>
              <p
                style={{
                  color: "rgba(232,232,240,0.8)",
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: "0 0 10px",
                }}
              >
                {t(
                  "點下方 Safari 的「分享」→ 捲下來選「加入主畫面」",
                  "Tap Safari's Share button below → scroll down → \"Add to Home Screen\""
                )}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  fontSize: 11,
                  color: "rgba(212,168,85,0.9)",
                }}
              >
                <span>⬆ {t("分享", "Share")}</span>
                <span style={{ color: "rgba(192,192,208,0.4)" }}>→</span>
                <span>➕ {t("加入主畫面", "Add to Home Screen")}</span>
              </div>
            </>
          ) : (
            <>
              <p
                style={{
                  color: "rgba(232,232,240,0.8)",
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: "0 0 10px",
                }}
              >
                {t(
                  "安裝後像 app 一樣全螢幕開啟,下次不用再打網址。",
                  "Install to open fullscreen like a native app — no URL needed."
                )}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleInstall}
                  className="btn-gold"
                  style={{
                    padding: "7px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 9999,
                  }}
                >
                  {t("立即加入", "Install")}
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  style={{
                    padding: "7px 12px",
                    fontSize: 12,
                    borderRadius: 9999,
                    border: "1px solid rgba(192,192,208,0.25)",
                    background: "none",
                    color: "rgba(192,192,208,0.7)",
                    cursor: "pointer",
                  }}
                >
                  {t("下次再說", "Later")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
