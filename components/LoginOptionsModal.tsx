"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  signInWithSocial,
  signInWithEmailMagicLink,
  type SocialProvider,
} from "@/lib/auth/signIn";
import {
  useIsInAppBrowser,
  openInExternalBrowserViaLine,
  type InAppBrowserApp,
} from "@/lib/env/useIsInAppBrowser";
import {
  GSI_CLIENT_ID_CONFIGURED,
  renderGoogleButton,
} from "@/lib/auth/googleIdentity";

export interface LoginOptionsModalProps {
  open: boolean;
  onClose: () => void;
  /** 登入完成後要回到的路徑,預設 "/" */
  next?: string;
  /** 標題客製化 —— 例如訪客 gate 會改成「登入以解鎖完整體驗」 */
  title?: string;
  /** 副標,可選 */
  subtitle?: string;
  /** Line 目前走 Supabase Pro 的 Custom OIDC,尚未開通就隱藏按鈕(避免點了就踩雷) */
  lineEnabled?: boolean;
}

// Apple 登入開關 —— 需 $99/yr Apple Developer Program 才能配 Services ID,
// 尚未取得前先用 env flag 隱藏,避免使用者點了踩雷。
// 未來要啟用:在 .env 設 NEXT_PUBLIC_APPLE_LOGIN_ENABLED=true
const APPLE_LOGIN_ENABLED =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_APPLE_LOGIN_ENABLED === "true";

/**
 * 統一的登入 modal —— Google + Email magic link 為主,Apple / LINE 視開關顯示。
 *
 * 設計決策:
 * - Facebook **不**在這裡:FB OAuth 預設不綁定到已存在的 Gmail 帳號,
 *   會生出孤兒 user(點數/訂閱歸屬錯誤)。改走「登入後去 /account/linked 追加綁定」。
 * - Apple / LINE:尚未配置完成時隱藏按鈕,避免點了才收到錯誤。
 *
 * UX:
 * - OAuth 按鈕並列,icon + 品牌色
 * - 最底下 Email magic link,預設摺疊成連結,點開展開 input + 送信
 * - 任何 provider 失敗 → 紅色小字顯示在 modal 底部(不彈 alert,避免打斷)
 */
export default function LoginOptionsModal({
  open,
  onClose,
  next,
  title,
  subtitle,
  lineEnabled = false,
}: LoginOptionsModalProps) {
  const { t } = useLanguage();

  // In-app browser 偵測 —— LINE/FB/IG/Messenger 等內嵌 WebView 會被 Google 擋 OAuth
  // (錯誤碼 disallowed_useragent / 403)。偵測到後顯示警示橫幅並提供脫困動線。
  const { isInApp, app: inAppName } = useIsInAppBrowser();

  const [busy, setBusy] = useState<SocialProvider | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // Google 官方 rendered button 要塞進這個 ref 所指的 div。
  // 改用 GSI id_token flow(而非 signInWithOAuth redirect)的目的:
  // 舊流程 Google 同意畫面會顯示「繼續使用 xpijubxjokrpysrpjrct.supabase.co」,
  // 是因為 redirect_uri 設在 Supabase 自家網域;id_token flow 全程留在 tarogram.heronhouse.me。
  const googleBtnRef = useRef<HTMLDivElement>(null);

  // SSR safety: portal 目標只能在 client 取得。mounted 之前不 render。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 每次開關重置狀態,避免殘留錯誤/已寄信 flag
  useEffect(() => {
    if (open) {
      setError(null);
      setEmailMode(false);
      setEmail("");
      setEmailSent(false);
      setBusy(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // modal 開啟時鎖背景 scroll,避免手機上點 modal 外面還能捲動主畫面
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 每次 modal 打開時(且不在 in-app browser,且 GSI 可用),把 Google 官方按鈕畫進 ref div。
  // In-app browser 時,GSI 跟 OAuth 一樣會被擋,改走下面的 fallback ProviderButton(它會 disabled)。
  useEffect(() => {
    if (!open) return;
    if (!GSI_CLIENT_ID_CONFIGURED) return;
    if (isInApp) return;
    if (!googleBtnRef.current) return;
    // 重覆 render 會累加按鈕,每次先清空
    googleBtnRef.current.innerHTML = "";
    renderGoogleButton(googleBtnRef.current, {
      type: "standard",
      theme: "filled_blue",
      size: "large",
      text: "signin_with",
      shape: "pill",
      width: 320,
      logo_alignment: "left",
    }).catch((e) => {
      console.warn("[LoginOptionsModal] GSI render 失敗:", e);
    });
  }, [open, isInApp]);

  if (!open || !mounted) return null;

  const handleSocial = async (provider: SocialProvider) => {
    setError(null);
    setBusy(provider);
    try {
      await signInWithSocial(provider, { next });
      // OAuth 成功會 full-page redirect,不會走到這一行
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const addr = email.trim();
    if (!addr || !/.+@.+\..+/.test(addr)) {
      setError(
        t(
          "請輸入有效的 Email",
          "Please enter a valid email",
          "有効なメールアドレスを入力してください",
          "유효한 이메일을 입력하세요"
        )
      );
      return;
    }
    setBusy("email");
    try {
      await signInWithEmailMagicLink(addr, { next });
      setEmailSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  // 用 React Portal 把 modal 送到 document.body —— 這是關鍵。
  //
  // 問題背景:首頁 hero 用 framer-motion,motion.div 會 inline style transform: translateZ(0),
  // 這會建立新的 stacking context,讓裡面的 position: fixed 只能相對那個 transform 容器定位,
  // z-index 再高都逃不出去,於是 modal 被 hero 的其他 motion 元素蓋掉。
  // 把節點 render 到 <body> 下面就徹底脫離這個牢籠。
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background: "rgba(5,5,20,0.72)",
        backdropFilter: "blur(6px)",
      }}
    >
      {/*
        內層 wrapper 永遠「至少」跟視窗一樣高 (minHeight: 100%),讓 flex-center 在內容短時能置中,
        內容比視窗高時 wrapper 自然撐高,由外層 overflowY 吸收捲動 —— 這比 alignItems: safe center 可靠。
      */}
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding:
            "max(32px, env(safe-area-inset-top)) 16px max(32px, env(safe-area-inset-bottom))",
          boxSizing: "border-box",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mystic-card"
          style={{
            maxWidth: 380,
            width: "100%",
            padding: "28px 24px 22px",
            textAlign: "center",
            position: "relative",
            // 不要被 flex parent 壓扁
            flexShrink: 0,
          }}
        >
        <button
          onClick={onClose}
          aria-label={t("關閉", "Close", "閉じる", "닫기")}
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            width: 28,
            height: 28,
            background: "none",
            border: "none",
            color: "rgba(192,192,208,0.6)",
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <div style={{ fontSize: 34, marginBottom: 6 }}>✦</div>
        <h3
          className="text-gold-gradient"
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          {title ?? t("登入 / 註冊", "Sign in", "ログイン / 登録", "로그인 / 가입")}
        </h3>
        <p
          style={{
            color: "rgba(192,192,208,0.75)",
            fontSize: 13,
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          {subtitle ??
            t(
              "選擇慣用的登入方式,我們會為你建立會員帳號",
              "Choose how you'd like to sign in — we'll create your account automatically",
              "ご希望のログイン方法を選んでください。アカウントは自動で作成されます。",
              "원하는 로그인 방법을 선택하세요. 계정은 자동으로 생성됩니다."
            )}
        </p>

        {/* === In-app browser 警示 ===
            LINE/FB/IG 等 App 的內嵌 WebView 開啟此頁時,Google 會以
            「disallowed_useragent」擋下 OAuth。這裡主動告知並提供脫困路徑。
            - LINE:一鍵「在外部瀏覽器開啟」(?openExternalBrowser=1)
            - 其他 App:顯示圖文說明,請用戶從 App 的選單手動切換
            Email magic link 不走 OAuth,所以這個警示下方的 email 登入還是能用。 */}
        {isInApp && (
          <InAppBrowserNotice
            app={inAppName}
            t={t}
          />
        )}

        {/* === OAuth 按鈕 ===
            Google:用 GSI id_token flow(renderButton)。好處是全程留在本網域,
                    Google 同意畫面顯示的是 Tarogram 易問,而不是 xpijubxjokrpysrpjrct.supabase.co。
                    In-app browser / 沒設 Client ID env 時,fallback 回舊的 signInWithOAuth 按鈕。
            Apple / LINE:用 env flag 控制,預設隱藏。
            Facebook 刻意不放登入頁 —— 避免孤兒帳號,改從 /account/linked 追加綁定。 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          {GSI_CLIENT_ID_CONFIGURED && !isInApp ? (
            // Google 官方 rendered button —— width 320 跟 modal 內容區等寬感受
            <div
              ref={googleBtnRef}
              style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                minHeight: 40,
              }}
            />
          ) : (
            <ProviderButton
              label={t(
                "使用 Google 帳號登入",
                "Continue with Google",
                "Google アカウントでログイン",
                "Google 계정으로 계속"
              )}
              iconBg="#fff"
              icon={<GoogleIcon />}
              onClick={() => handleSocial("google")}
              busy={busy === "google"}
              // in-app browser 下 Google 一定會撞 disallowed_useragent,直接 disabled
              disabled={busy !== null || isInApp}
            />
          )}
          {APPLE_LOGIN_ENABLED && (
            <ProviderButton
              label={t(
                "使用 Apple 帳號登入",
                "Continue with Apple",
                "Apple アカウントでログイン",
                "Apple 계정으로 계속"
              )}
              iconBg="#000"
              icon={<AppleIcon />}
              labelColor="#fff"
              bg="#000"
              border="1px solid #000"
              onClick={() => handleSocial("apple")}
              busy={busy === "apple"}
              disabled={busy !== null || isInApp}
            />
          )}
          {lineEnabled && (
            <ProviderButton
              label={t(
                "使用 LINE 帳號登入",
                "Continue with LINE",
                "LINE アカウントでログイン",
                "LINE 계정으로 계속"
              )}
              iconBg="#06C755"
              icon={<LineIcon />}
              labelColor="#fff"
              bg="#06C755"
              border="1px solid #06C755"
              onClick={() => handleSocial("line")}
              busy={busy === "line"}
              disabled={busy !== null || isInApp}
            />
          )}
        </div>

        {/* === 分隔線 === */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "18px 0 14px",
            color: "rgba(192,192,208,0.4)",
            fontSize: 11,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "rgba(192,192,208,0.15)" }} />
          <span>{t("或", "or", "または", "또는")}</span>
          <div style={{ flex: 1, height: 1, background: "rgba(192,192,208,0.15)" }} />
        </div>

        {/* === Email magic link === */}
        {!emailMode ? (
          <button
            type="button"
            onClick={() => setEmailMode(true)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(212,168,85,0.35)",
              color: "#d4a855",
              fontSize: 13,
              background: "none",
              cursor: "pointer",
              width: "100%",
              fontWeight: 600,
            }}
          >
            {t(
              "✉  用 Email 登入(寄連結給你)",
              "✉  Email me a magic link",
              "✉  メールでログイン(リンクを送ります)",
              "✉  이메일로 로그인(링크 보내드립니다)"
            )}
          </button>
        ) : emailSent ? (
          <div
            style={{
              padding: "14px 12px",
              borderRadius: 10,
              background: "rgba(212,168,85,0.08)",
              border: "1px solid rgba(212,168,85,0.2)",
              color: "rgba(232,232,240,0.9)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {t(
              `登入連結已寄出至 ${email},請至信箱點擊連結完成登入(若找不到請查看垃圾信件匣)`,
              `A sign-in link has been sent to ${email}. Click the link in the email to continue. (Check spam if not found.)`,
              `${email} にログイン用リンクを送信しました。メール内のリンクをクリックして続けてください(届かない場合は迷惑メールをご確認ください)。`,
              `${email}로 로그인 링크를 보냈습니다. 이메일의 링크를 클릭하여 계속하세요(보이지 않으면 스팸함을 확인하세요).`
            )}
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} style={{ textAlign: "left" }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "rgba(192,192,208,0.7)",
                marginBottom: 6,
              }}
            >
              {t("Email 地址", "Email address", "メールアドレス", "이메일 주소")}
            </label>
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(212,168,85,0.3)",
                background: "rgba(13,13,43,0.5)",
                color: "#e8e8f0",
                fontSize: 14,
                marginBottom: 10,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="submit"
              disabled={busy !== null}
              className="btn-gold"
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 700,
                opacity: busy !== null ? 0.6 : 1,
                cursor: busy !== null ? "wait" : "pointer",
              }}
            >
              {busy === "email"
                ? t("寄送中…", "Sending…", "送信中…", "전송 중…")
                : t("寄送登入連結", "Send magic link", "ログインリンクを送る", "로그인 링크 보내기")}
            </button>
            <button
              type="button"
              onClick={() => setEmailMode(false)}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "6px",
                background: "none",
                border: "none",
                color: "rgba(192,192,208,0.55)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("← 回上一頁", "← Back", "← 戻る", "← 뒤로")}
            </button>
          </form>
        )}

        {/* === 錯誤訊息 === */}
        {error && (
          <p
            style={{
              marginTop: 14,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(229,57,67,0.1)",
              border: "1px solid rgba(229,57,67,0.3)",
              color: "#ff9a9a",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {error}
          </p>
        )}

        <p
          style={{
            marginTop: 18,
            color: "rgba(192,192,208,0.45)",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {t(
            "登入即表示同意 ",
            "By signing in you agree to our ",
            "ログインすることで、",
            "로그인하시면 "
          )}
          <a
            href="/terms"
            target="_blank"
            style={{ color: "rgba(212,168,85,0.7)", textDecoration: "underline" }}
          >
            {t("服務條款", "Terms", "利用規約", "이용약관")}
          </a>
          {t(" 與 ", " and ", " と ", " 및 ")}
          <a
            href="/privacy"
            target="_blank"
            style={{ color: "rgba(212,168,85,0.7)", textDecoration: "underline" }}
          >
            {t("隱私權政策", "Privacy Policy", "プライバシーポリシー", "개인정보처리방침")}
          </a>
          {t("", "", " に同意したものとみなされます。", "에 동의한 것으로 간주됩니다.")}
        </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============ 子元件 ============

/**
 * In-app browser 警示橫幅 —— 偵測到用戶在 LINE/FB/IG 等 App 的內嵌瀏覽器
 * 開啟登入頁時顯示。告知 Google OAuth 會被擋,並提供脫困動線。
 *
 * 依 App 分流:
 * - LINE:顯示「在預設瀏覽器開啟」按鈕 —— LINE 支援 ?openExternalBrowser=1
 *   query param,觸發後會自動用系統預設瀏覽器開新分頁。
 * - Facebook / Instagram / Messenger:沒有類似 query param,必須教用戶
 *   從 App 右上角選單(⋯ 或 ⋮)找「在外部瀏覽器中開啟」。依 iOS / Android
 *   UI 差異,文案折衷寫成「右上角選單」。
 * - WeChat / TikTok / 其他:通用提示。
 */
interface InAppBrowserNoticeProps {
  app: InAppBrowserApp | null;
  t: (zh: string, en: string, ja?: string, ko?: string) => string;
}

function InAppBrowserNotice({ app, t }: InAppBrowserNoticeProps) {
  const handleOpenExternal = () => {
    openInExternalBrowserViaLine();
  };

  // 文案依 App 分流
  let heading: string;
  let body: string;
  if (app === "line") {
    heading = t(
      "偵測到你正在 LINE 內開啟,Google 登入會被擋。",
      "You're inside LINE — Google sign-in won't work here.",
      "LINE 内で開いています。Google ログインはブロックされます。",
      "LINE 안에서 열고 있습니다. Google 로그인은 차단됩니다."
    );
    body = t(
      "點下方按鈕用預設瀏覽器開啟,登入後再回來。",
      "Tap below to reopen in your default browser, then sign in.",
      "下のボタンでデフォルトブラウザで開き直してログインしてください。",
      "아래 버튼으로 기본 브라우저에서 다시 열고 로그인하세요."
    );
  } else if (app === "facebook") {
    heading = t(
      "偵測到你正在 Facebook / Messenger 內開啟,Google 登入會被擋。",
      "You're inside Facebook / Messenger — Google sign-in won't work here.",
      "Facebook / Messenger 内で開いています。Google ログインはブロックされます。",
      "Facebook / Messenger 안에서 열고 있습니다. Google 로그인은 차단됩니다."
    );
    body = t(
      "請點右上角 ⋯ 選單,選「在外部瀏覽器中開啟」或「在 Safari/Chrome 中開啟」。",
      "Tap the ⋯ menu in the top-right and choose \"Open in external browser\" (or Safari / Chrome).",
      "右上の ⋯ メニューから「外部ブラウザで開く」(または Safari / Chrome)を選んでください。",
      "오른쪽 상단 ⋯ 메뉴에서 \"외부 브라우저에서 열기\"(또는 Safari / Chrome)를 선택하세요."
    );
  } else if (app === "instagram") {
    heading = t(
      "偵測到你正在 Instagram 內開啟,Google 登入會被擋。",
      "You're inside Instagram — Google sign-in won't work here.",
      "Instagram 内で開いています。Google ログインはブロックされます。",
      "Instagram 안에서 열고 있습니다. Google 로그인은 차단됩니다."
    );
    body = t(
      "請點右上角 ⋯ 選單,選「在外部瀏覽器中開啟」。",
      "Tap the ⋯ menu in the top-right and choose \"Open in external browser\".",
      "右上の ⋯ メニューから「外部ブラウザで開く」を選んでください。",
      "오른쪽 상단 ⋯ 메뉴에서 \"외부 브라우저에서 열기\"를 선택하세요."
    );
  } else if (app === "wechat") {
    heading = t(
      "偵測到你正在微信內開啟,Google 登入會被擋。",
      "You're inside WeChat — Google sign-in won't work here.",
      "WeChat 内で開いています。Google ログインはブロックされます。",
      "WeChat 안에서 열고 있습니다. Google 로그인은 차단됩니다."
    );
    body = t(
      "請點右上角 ⋯,選「在瀏覽器中打開」。",
      "Tap the ⋯ menu in the top-right and choose \"Open in browser\".",
      "右上の ⋯ から「ブラウザで開く」を選んでください。",
      "오른쪽 상단 ⋯에서 \"브라우저에서 열기\"를 선택하세요."
    );
  } else {
    // tiktok / threads / unknown
    heading = t(
      "偵測到你正在 App 的內嵌瀏覽器中,Google 登入會被擋。",
      "You're inside an app's in-app browser — Google sign-in won't work here.",
      "アプリ内蔵ブラウザで開いています。Google ログインはブロックされます。",
      "앱 내장 브라우저에서 열고 있습니다. Google 로그인은 차단됩니다."
    );
    body = t(
      "請從 App 選單切換到預設瀏覽器(Safari / Chrome)再登入。",
      "Please switch to your default browser (Safari / Chrome) and sign in there.",
      "アプリのメニューからデフォルトブラウザ(Safari / Chrome)に切り替えてログインしてください。",
      "앱 메뉴에서 기본 브라우저(Safari / Chrome)로 전환하여 로그인하세요."
    );
  }

  return (
    <div
      role="alert"
      style={{
        marginBottom: 14,
        padding: "12px 12px 11px",
        borderRadius: 10,
        background: "rgba(255,176,72,0.08)",
        border: "1px solid rgba(255,176,72,0.35)",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          marginBottom: app === "line" ? 10 : 0,
        }}
      >
        <span
          aria-hidden
          style={{
            fontSize: 16,
            lineHeight: 1.2,
            color: "#ffb048",
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          ⚠
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "#ffd99a",
              fontWeight: 600,
            }}
          >
            {heading}
          </p>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              lineHeight: 1.55,
              color: "rgba(232,232,240,0.78)",
            }}
          >
            {body}
          </p>
        </div>
      </div>
      {app === "line" && (
        <button
          type="button"
          onClick={handleOpenExternal}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,176,72,0.55)",
            background: "rgba(255,176,72,0.18)",
            color: "#ffd99a",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {t(
            "在預設瀏覽器開啟",
            "Open in default browser",
            "デフォルトブラウザで開く",
            "기본 브라우저에서 열기"
          )}
        </button>
      )}
    </div>
  );
}

interface ProviderButtonProps {
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  bg?: string;
  border?: string;
  labelColor?: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}

function ProviderButton({
  label,
  icon,
  iconBg,
  bg,
  border,
  labelColor,
  onClick,
  busy,
  disabled,
}: ProviderButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        border: border ?? "1px solid rgba(212,168,85,0.35)",
        background: bg ?? "rgba(255,255,255,0.05)",
        color: labelColor ?? "#e8e8f0",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled && !busy ? 0.5 : 1,
        transition: "background 0.15s ease",
        width: "100%",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: iconBg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span>{busy ? "…" : label}</span>
    </button>
  );
}

// ============ SVG icons ============

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23 12.27c0-.88-.08-1.73-.23-2.54H12v4.8h6.18c-.27 1.43-1.07 2.64-2.28 3.46v2.87h3.69c2.16-1.99 3.41-4.92 3.41-8.59z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.08 0 5.66-1.02 7.55-2.76l-3.69-2.87c-1.02.68-2.32 1.09-3.86 1.09-2.97 0-5.49-2-6.39-4.7H1.8v2.96C3.67 20.9 7.55 23.5 12 23.5z"
      />
      <path
        fill="#FBBC05"
        d="M5.61 14.26c-.23-.68-.36-1.4-.36-2.14s.13-1.46.36-2.14V7.02H1.8C1.04 8.55.6 10.22.6 12.12c0 1.9.44 3.57 1.2 5.1l3.81-2.96z"
      />
      <path
        fill="#EA4335"
        d="M12 5.42c1.68 0 3.18.58 4.37 1.72l3.27-3.27C17.65 2.09 15.08 1 12 1 7.55 1 3.67 3.6 1.8 7.02l3.81 2.96C6.51 7.42 9.03 5.42 12 5.42z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#fff"
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#fff"
        d="M19.37 9.17c0-4.09-4.1-7.42-9.14-7.42S1.09 5.08 1.09 9.17c0 3.67 3.25 6.74 7.65 7.32.3.06.7.2.8.45.1.23.06.59.03.82l-.13.78c-.04.23-.18.9.79.49.97-.41 5.25-3.09 7.17-5.3 1.33-1.46 1.97-2.94 1.97-4.56zM6.4 11.12H4.59c-.13 0-.24-.11-.24-.24V7.24c0-.13.11-.24.24-.24h.45c.13 0 .24.11.24.24v2.94H6.4c.13 0 .24.11.24.24v.45c0 .14-.11.25-.24.25zm1.34-.24c0 .13-.11.24-.24.24h-.45c-.13 0-.24-.11-.24-.24V7.24c0-.13.11-.24.24-.24h.45c.13 0 .24.11.24.24v3.64zm4.01 0c0 .13-.11.24-.24.24h-.45c-.02 0-.05-.01-.07-.01h-.01l-.02-.01-.01-.01h-.01c-.02-.01-.03-.02-.05-.04l-1.57-2.12v2.04c0 .13-.11.24-.24.24h-.45c-.13 0-.24-.11-.24-.24V7.24c0-.13.11-.24.24-.24h.52c.03.01.06.03.08.05l1.57 2.12V7.24c0-.13.11-.24.24-.24h.45c.13 0 .24.11.24.24v3.64zm3.37-2.75c0 .13-.11.24-.24.24h-1.57v.6h1.57c.13 0 .24.11.24.24v.45c0 .13-.11.24-.24.24h-1.57v.6h1.57c.13 0 .24.11.24.24v.45c0 .13-.11.24-.24.24h-2.33c-.13 0-.24-.11-.24-.24V7.24c0-.13.11-.24.24-.24h2.33c.13 0 .24.11.24.24v.45z"
      />
    </svg>
  );
}
