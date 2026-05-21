"use client";

/**
 * /account/delete — 帳號與資料自助刪除頁
 *
 * Google Play 2023+ 規定 app 內必須能自行刪除帳號與相關資料,
 * GDPR / 台灣個資法亦有此要求。這支 UI 走兩步:
 *   1. 展示將被刪除的內容清單
 *   2. 勾「我明白不可復原」+ 輸入 DELETE → 送 API
 *
 * API 做完後 signOut + 導回 /。localStorage 的訪客紀錄也一併清。
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useLanguage } from "@/i18n/LanguageContext";

interface AuthUser {
  id: string;
  email?: string;
}

const isSupabaseConfigured =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "your_supabase_url_here";

export default function AccountDeletePage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ack, setAck] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    import("@/lib/supabase/client").then(async ({ createClient }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user ? { id: user.id, email: user.email } : null);
      setIsLoading(false);
    });
  }, []);

  const canDelete =
    ack && confirmText.trim().toUpperCase() === "DELETE" && !isDeleting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "delete_failed");
      }

      // 後端已刪 auth user;前端 signOut 清 cookie,再順手清 localStorage 訪客紀錄
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch (e) {
        console.error("signOut after delete failed:", e);
      }
      try {
        localStorage.removeItem("divination_history");
      } catch {
        /* ignore */
      }

      // 導回首頁 + 帶 query 顯示成功訊息(首頁不會特別讀,但留著備用)
      router.replace("/?account_deleted=1");
    } catch (e) {
      console.error("[delete] failed:", e);
      setErrorMsg(
        t(
          "刪除失敗,請稍後再試或寄信至 contact@heronhouse.me 協助處理。",
          "Deletion failed. Please retry later or email contact@heronhouse.me for assistance."
        )
      );
      setIsDeleting(false);
    }
  };

  const mainStyle = {
    paddingTop: 88,
    paddingBottom: 48,
    paddingLeft: 16,
    paddingRight: 16,
    maxWidth: 640,
    margin: "0 auto",
  } as const;

  // ---- Loading ----
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Header />
        <main style={mainStyle}>
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "rgba(192,192,208,0.6)",
            }}
          >
            {t("載入中...", "Loading...", "読み込み中...", "불러오는 중...")}
          </div>
        </main>
      </div>
    );
  }

  // ---- Not signed in ----
  if (!user) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <Header />
        <main style={mainStyle}>
          <div
            className="mystic-card"
            style={{ padding: 48, textAlign: "center" }}
          >
            <span
              style={{ fontSize: 40, display: "block", marginBottom: 16 }}
            >
              🔐
            </span>
            <p
              style={{
                color: "rgba(192,192,208,0.8)",
                marginBottom: 16,
              }}
            >
              {t(
                "請先登入才能刪除帳號。如果您沒有帳號,就沒有資料需要刪除。",
                "Please sign in first. If you never signed in, there's nothing stored to delete."
              )}
            </p>
            <Link
              href="/"
              className="btn-gold"
              style={{
                display: "inline-block",
                marginTop: 8,
                textDecoration: "none",
              }}
            >
              {t("回首頁", "Back to home", "ホームに戻る", "홈으로")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />
      <main style={mainStyle}>
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/account"
            style={{
              color: "rgba(212,168,85,0.8)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← {t(
              "返回會員頁",
              "Back to account",
              "アカウントに戻る",
              "계정으로 돌아가기"
            )}
          </Link>
        </div>

        <h1
          style={{
            fontSize: 24,
            fontFamily: "'Noto Serif TC', serif",
            fontWeight: 700,
            color: "#f87171",
            marginBottom: 8,
          }}
        >
          {t("刪除帳號", "Delete Account", "アカウント削除", "계정 삭제")}
        </h1>
        <p
          style={{
            color: "rgba(192,192,208,0.6)",
            fontSize: 13,
            marginBottom: 24,
            lineHeight: 1.6,
          }}
        >
          {t(
            "此動作將永久清除您於本平台的所有資料,且無法復原。",
            "This will permanently erase all your data on this platform. It cannot be undone."
          )}
        </p>

        {/* --- What will be deleted --- */}
        <div
          className="mystic-card"
          style={{
            padding: 20,
            marginBottom: 20,
            border: "1px solid rgba(244,63,94,0.3)",
          }}
        >
          <h2
            style={{
              color: "#f87171",
              fontFamily: "'Noto Serif TC', serif",
              fontSize: 15,
              margin: "0 0 12px 0",
            }}
          >
            {t(
              "將被永久清除的內容",
              "What will be permanently deleted",
              "完全に削除される内容",
              "영구적으로 삭제되는 내용"
            )}
          </h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 22,
              color: "rgba(232,232,240,0.85)",
              fontSize: 13,
              lineHeight: 1.9,
            }}
          >
            <li>
              {t(
                "您的登入身份(email、OAuth 連結)",
                "Your login identity (email, OAuth link)"
              )}
            </li>
            <li>
              {t(
                "所有占卜紀錄、衍伸占卜串、chat 對話",
                "All divinations, follow-up threads, and chat messages"
              )}
            </li>
            <li>
              {t(
                "點數餘額與消耗紀錄",
                "Credit balance and consumption history"
              )}
            </li>
            <li>
              {t(
                "訂閱狀態(若有)—— 已付款金額不另行退款,請於刪除前先至訂閱頁取消",
                "Subscription status (if any). Paid amounts will not be refunded — please cancel via the subscription page before deleting"
              )}
            </li>
            <li>
              {t(
                "本機瀏覽器內的訪客占卜紀錄(localStorage)",
                "Guest divination history stored in your browser (localStorage)"
              )}
            </li>
          </ul>
        </div>

        {/* --- Current account --- */}
        <div
          className="mystic-card"
          style={{
            padding: 16,
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: "rgba(192,192,208,0.5)",
                fontSize: 11,
                marginBottom: 2,
              }}
            >
              {t(
                "目前登入帳號",
                "Signed in as",
                "ログイン中のアカウント",
                "현재 로그인된 계정"
              )}
            </div>
            <div
              style={{
                color: "rgba(192,192,208,0.95)",
                fontSize: 14,
                wordBreak: "break-all",
              }}
            >
              {user.email || user.id}
            </div>
          </div>
        </div>

        {/* --- Confirm controls --- */}
        <div
          className="mystic-card"
          style={{
            padding: 20,
            marginBottom: 20,
            border: "1px solid rgba(244,63,94,0.2)",
            background: "rgba(244,63,94,0.04)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              fontSize: 13,
              color: "rgba(232,232,240,0.9)",
              lineHeight: 1.7,
              cursor: "pointer",
              marginBottom: 16,
            }}
          >
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              disabled={isDeleting}
              style={{
                marginTop: 4,
                width: 16,
                height: 16,
                accentColor: "#f87171",
              }}
            />
            <span>
              {t(
                "我明白此動作無法復原。刪除後,我將失去所有占卜紀錄、點數與訂閱權益。",
                "I understand this action is irreversible. I will lose all divinations, credits, and subscription benefits."
              )}
            </span>
          </label>

          <label
            style={{
              display: "block",
              fontSize: 12,
              color: "rgba(192,192,208,0.7)",
              marginBottom: 6,
            }}
          >
            {t(
              "請輸入大寫 DELETE 確認:",
              "Type DELETE (uppercase) to confirm:"
            )}
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isDeleting}
            placeholder="DELETE"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "rgba(10,10,26,0.6)",
              border: "1px solid rgba(244,63,94,0.3)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              fontFamily: "monospace",
              letterSpacing: 2,
            }}
          />

          {errorMsg && (
            <p
              style={{
                marginTop: 14,
                padding: 10,
                background: "rgba(244,63,94,0.1)",
                border: "1px solid rgba(244,63,94,0.3)",
                borderRadius: 8,
                color: "#fda4af",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              {errorMsg}
            </p>
          )}

          <button
            onClick={handleDelete}
            disabled={!canDelete}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 9999,
              border: "none",
              background: canDelete
                ? "linear-gradient(135deg, #dc2626 0%, #f87171 100%)"
                : "rgba(244,63,94,0.2)",
              color: canDelete ? "#fff" : "rgba(255,255,255,0.5)",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 1,
              cursor: canDelete ? "pointer" : "not-allowed",
              transition: "opacity 0.15s",
            }}
          >
            {isDeleting
              ? t("刪除中...", "Deleting...", "削除中...", "삭제 중...")
              : t(
                  "永久刪除我的帳號",
                  "Permanently Delete My Account",
                  "アカウントを完全に削除",
                  "내 계정 영구 삭제"
                )}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link
            href="/account"
            style={{
              color: "rgba(192,192,208,0.6)",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            {t(
              "← 取消,返回會員頁",
              "← Cancel, back to account",
              "← キャンセル、アカウントに戻る",
              "← 취소, 계정으로 돌아가기"
            )}
          </Link>
        </div>
      </main>
    </div>
  );
}
