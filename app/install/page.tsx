"use client";

/**
 * /install —— PWA 安裝教學落地頁。
 *
 * 對外兩個用途:
 * 1. 社群宣傳:「加入我們 → tarogram.heronhouse.me/install」短連結,圖文教學引導使用者把 app 加到桌面。
 * 2. 站內 fallback:footer 一定有連結到這,使用者搞不清楚怎麼加主畫面時隨時看得到。
 *
 * UX 策略:
 * - 偵測當前平台(Android / iOS Safari / Desktop),預設展開對應區塊,其他區塊摺疊。
 * - Android 若有 beforeinstallprompt event → 顯示一鍵安裝按鈕。
 * - iOS 沒有可程式化的安裝 API → 純圖文步驟。
 * - 每一步有明確的視覺層級,繁簡英三語。
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { useLanguage } from "@/i18n/LanguageContext";
import { useIsTWA } from "@/lib/env/useIsTWA";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

type Platform = "android" | "ios" | "desktop" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  // 粗略桌面偵測:非行動裝置
  const isMobile =
    /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/.test(ua);
  return isMobile ? "other" : "desktop";
}

export default function InstallPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const isTwa = useIsTWA();
  const [platform, setPlatform] = useState<Platform>("other");
  const [deferredEvent, setDeferredEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  // TWA 內已經是 app 了,不需要再看「如何加到主畫面」教學;
  // 而且這頁有露出 tarogram.heronhouse.me URL,Play 政策不允許出現。
  // 一進來直接導回首頁。
  useEffect(() => {
    if (isTwa) router.replace("/");
  }, [isTwa, router]);

  useEffect(() => {
    setPlatform(detectPlatform());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleOneClickInstall = async () => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const result = await deferredEvent.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredEvent(null);
  };

  // TWA 內不渲染任何內容(避免 tarogram.heronhouse.me URL 在 redirect 前閃出)
  if (isTwa) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <main
        style={{
          paddingTop: 88,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <Link
            href="/"
            style={{
              color: "rgba(212,168,85,0.8)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← {t("回首頁", "Back to home")}
          </Link>
        </div>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>✦</div>
          <h1
            className="text-gold-gradient"
            style={{
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 10,
            }}
          >
            {t("把 Tarogram 加到主畫面", "Add Tarogram to your home screen")}
          </h1>
          <p
            style={{
              color: "rgba(192,192,208,0.75)",
              fontSize: 14,
              lineHeight: 1.7,
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            {t(
              "像 app 一樣全螢幕開啟,下次不用再打網址。無需下載、不佔空間、隨時可移除。",
              "Opens fullscreen like a native app. No download, no storage, remove anytime."
            )}
          </p>
        </div>

        {installed && (
          <div
            className="mystic-card"
            style={{
              padding: 16,
              marginBottom: 20,
              textAlign: "center",
              borderColor: "rgba(52,168,83,0.4)",
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>✓</div>
            <div style={{ color: "#9ae0a5", fontSize: 13, fontWeight: 600 }}>
              {t("安裝完成,請從主畫面開啟", "Installed — open from home screen")}
            </div>
          </div>
        )}

        {/* Android */}
        <PlatformSection
          title={t("Android 裝置(Chrome / Samsung / Edge)", "Android (Chrome / Samsung / Edge)")}
          active={platform === "android"}
          steps={[
            t(
              "打開 Chrome(或 Samsung Internet / Edge)瀏覽 tarogram.heronhouse.me",
              "Open Chrome (or Samsung Internet / Edge) and visit tarogram.heronhouse.me"
            ),
            t(
              "若底部跳出「安裝應用程式」橫幅,直接按「安裝」即可",
              "If you see an \"Install app\" banner at the bottom, tap \"Install\""
            ),
            t(
              "若沒跳出橫幅:點右上角 ⋮(三個點)→ 選「加到主畫面」或「安裝應用程式」",
              "No banner? Tap ⋮ (top-right) → \"Add to home screen\" or \"Install app\""
            ),
            t(
              "確認命名後按「新增」,桌面會多一個 Tarogram icon",
              "Confirm the name, tap \"Add\". Tarogram icon appears on your home screen"
            ),
          ]}
          extra={
            platform === "android" && deferredEvent ? (
              <button
                type="button"
                onClick={handleOneClickInstall}
                className="btn-gold"
                style={{
                  marginTop: 14,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 9999,
                  width: "100%",
                }}
              >
                {t("✦ 一鍵安裝到主畫面", "✦ Install now")}
              </button>
            ) : null
          }
        />

        {/* iOS */}
        <PlatformSection
          title={t("iPhone / iPad(Safari)", "iPhone / iPad (Safari)")}
          active={platform === "ios"}
          steps={[
            t(
              "用 Safari 打開 tarogram.heronhouse.me(Chrome iOS 版不支援)",
              "Open in Safari (Chrome/Firefox iOS won't work for this)"
            ),
            t("點畫面底部中間的「分享」按鈕 ⬆", "Tap the Share button ⬆ at the bottom"),
            t(
              "往下捲,找到「加入主畫面」並點選",
              "Scroll down and tap \"Add to Home Screen\""
            ),
            t(
              "右上角「新增」,桌面會多一個 Tarogram icon,點開即是全螢幕 app",
              "Tap \"Add\" (top-right). Tap the new icon on your home screen to launch fullscreen"
            ),
          ]}
          note={t(
            "iOS 限制:只能在 Safari 安裝,其他瀏覽器沒有此選項。",
            "iOS limitation: only Safari can install to home screen."
          )}
        />

        {/* Desktop */}
        <PlatformSection
          title={t("電腦(Chrome / Edge)", "Desktop (Chrome / Edge)")}
          active={platform === "desktop"}
          steps={[
            t(
              "用 Chrome 或 Edge 打開 tarogram.heronhouse.me",
              "Open in Chrome or Edge"
            ),
            t(
              "網址列右邊會出現「安裝」小圖示 ⊕,點下去",
              "Click the \"Install\" icon ⊕ on the right side of the address bar"
            ),
            t(
              "或從瀏覽器選單 ⋮ 找「安裝 Tarogram 易問」",
              "Or from menu ⋮ → \"Install Tarogram 易問\""
            ),
            t(
              "確認後會從作業系統啟動列直接打開獨立視窗",
              "Launches as a standalone window from your OS dock/Start menu"
            ),
          ]}
          extra={
            platform === "desktop" && deferredEvent ? (
              <button
                type="button"
                onClick={handleOneClickInstall}
                className="btn-gold"
                style={{
                  marginTop: 14,
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 9999,
                }}
              >
                {t("✦ 一鍵安裝到桌面", "✦ Install to desktop")}
              </button>
            ) : null
          }
        />

        <div
          style={{
            marginTop: 32,
            padding: 16,
            borderRadius: 10,
            background: "rgba(192,192,208,0.04)",
            border: "1px solid rgba(192,192,208,0.12)",
          }}
        >
          <h3
            style={{
              color: "#e8e8f0",
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            {t("常見問題", "FAQ")}
          </h3>
          <Faq
            q={t("會佔手機空間嗎?", "Does it take up storage?")}
            a={t(
              "幾乎不會。PWA 不是傳統 app,只是一個桌面 icon + 瀏覽器快取,整個加起來通常不到 1 MB。",
              "Almost none. PWA is just a home-screen shortcut plus browser cache — typically under 1 MB total."
            )}
          />
          <Faq
            q={t("要怎麼移除?", "How do I remove it?")}
            a={t(
              "長按桌面上的 Tarogram icon,選「移除」或「解除安裝」即可。不會刪除任何會員資料。",
              "Long-press the Tarogram icon → \"Remove\" or \"Uninstall\". Your account data is not affected."
            )}
          />
          <Faq
            q={t("為什麼 iOS 要用 Safari?", "Why must iOS use Safari?")}
            a={t(
              "蘋果限制:只有 Safari 能安裝 PWA 到主畫面,這是系統限制不是我們能改的。",
              "Apple's restriction: only Safari can install PWAs to home screen on iOS. Not our choice."
            )}
          />
        </div>
      </main>
    </div>
  );
}

// ======== 子元件 ========

interface PlatformSectionProps {
  title: string;
  steps: string[];
  active: boolean;
  extra?: React.ReactNode;
  note?: string;
}

function PlatformSection({
  title,
  steps,
  active,
  extra,
  note,
}: PlatformSectionProps) {
  return (
    <div
      className="mystic-card"
      style={{
        padding: "18px 18px 16px",
        marginBottom: 14,
        borderColor: active ? "rgba(212,168,85,0.5)" : undefined,
        boxShadow: active
          ? "0 0 0 1px rgba(212,168,85,0.2), 0 4px 12px rgba(0,0,0,0.2)"
          : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            color: "#d4a855",
            fontSize: 15,
            fontWeight: 700,
            margin: 0,
          }}
        >
          {title}
        </h2>
        {active && (
          <span
            aria-hidden
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 9999,
              background: "rgba(212,168,85,0.15)",
              color: "#d4a855",
              border: "1px solid rgba(212,168,85,0.3)",
              whiteSpace: "nowrap",
            }}
          >
            ← your device
          </span>
        )}
      </div>
      <ol
        style={{
          margin: 0,
          paddingLeft: 20,
          color: "rgba(232,232,240,0.85)",
          fontSize: 13,
          lineHeight: 1.75,
        }}
      >
        {steps.map((s, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {s}
          </li>
        ))}
      </ol>
      {note && (
        <p
          style={{
            marginTop: 10,
            color: "rgba(192,192,208,0.55)",
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          {note}
        </p>
      )}
      {extra}
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          color: "rgba(212,168,85,0.8)",
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 2,
        }}
      >
        {q}
      </div>
      <div
        style={{
          color: "rgba(232,232,240,0.7)",
          fontSize: 12,
          lineHeight: 1.65,
        }}
      >
        {a}
      </div>
    </div>
  );
}
