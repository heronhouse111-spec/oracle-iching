"use client";

/**
 * /support — 客服支援頁
 *
 * 為什麼存在:
 *   App Store Connect 的「支援 URL」欄位必填,Apple 審查員會點。
 *   Google Play Console 也要求有「客服聯絡方式」可達。
 *   本頁同時承接這兩個需求,提供:
 *     - 聯絡 email
 *     - 常見問題(FAQ)涵蓋帳號、點數、訂閱、退款、刪帳號
 *     - 隱私 / 條款的反連結
 *
 * 為什麼不用 LegalDocView 的 JSON 模式:
 *   /privacy 跟 /terms 是「長篇靜態法律文件」,JSON 化讓四語翻譯統一管理。
 *   /support 比較像「動線型頁面」(聯絡按鈕、deep link),用 inline tsx + useLanguage 比較直接,
 *   未來要加表單、要 link 進 /account/delete 等都好改,不需要每次動 JSON。
 *
 * 四語:用 t() helper,跟 Header / Footer 保持一致風格。
 */

import Link from "next/link";
import Header from "@/components/Header";
import { useLanguage } from "@/i18n/LanguageContext";

const SUPPORT_EMAIL = "contact@heronhouse.me";

export default function SupportPage() {
  const { t } = useLanguage();

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header />

      <main
        style={{
          paddingTop: 88,
          paddingBottom: 48,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 720,
          margin: "0 auto",
          color: "#e8e8f0",
          lineHeight: 1.75,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <Link
            href="/"
            style={{
              color: "rgba(212,168,85,0.8)",
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← {t("返回首頁", "Back to home", "ホームへ戻る", "홈으로 돌아가기")}
          </Link>
        </div>

        <h1
          className="text-gold-gradient"
          style={{
            fontFamily: "'Noto Serif TC', serif",
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          {t("客服支援", "Support", "サポート", "고객지원")}
        </h1>

        <p style={{ color: "rgba(192,192,208,0.75)", fontSize: 14, marginBottom: 28 }}>
          {t(
            "感謝您使用 Tarogram 易問。我們盡力在 7 個工作天內回覆您的訊息。",
            "Thanks for using Tarogram. We aim to respond within 7 business days.",
            "Tarogram をご利用いただきありがとうございます。7営業日以内にご返信いたします。",
            "Tarogram을 이용해 주셔서 감사합니다. 7영업일 이내에 답변드립니다."
          )}
        </p>

        {/* === 聯絡卡片 === */}
        <div
          style={{
            border: "1px solid rgba(212,168,85,0.25)",
            background: "rgba(13,13,43,0.5)",
            borderRadius: 12,
            padding: "18px 18px 16px",
            marginBottom: 32,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              color: "#d4a855",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            {t("聯絡我們", "Contact us", "お問い合わせ", "문의하기")}
          </h2>
          <p style={{ fontSize: 14, marginBottom: 10 }}>
            {t(
              "請來信告訴我們您的問題,以及(若有)您註冊使用的 email,以利我們快速協助:",
              "Please email us your question along with the email you used to sign up so we can help you faster:",
              "ご質問内容と、登録に使用したメールアドレスをお送りください:",
              "문의 내용과 가입에 사용한 이메일을 함께 보내주시면 빠르게 도와드릴 수 있습니다:"
            )}
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 8,
              background: "rgba(212,168,85,0.15)",
              border: "1px solid rgba(212,168,85,0.5)",
              color: "#ffd99a",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ✉ {SUPPORT_EMAIL}
          </a>
        </div>

        {/* === FAQ === */}
        <h2
          style={{
            fontSize: 20,
            color: "#d4a855",
            marginBottom: 14,
            fontFamily: "'Noto Serif TC', serif",
            fontWeight: 700,
          }}
        >
          {t("常見問題", "Frequently asked questions", "よくあるご質問", "자주 묻는 질문")}
        </h2>

        <Faq
          question={t(
            "我的點數什麼時候會用到?",
            "When are credits consumed?",
            "ポイントはいつ消費されますか?",
            "포인트는 언제 소모되나요?"
          )}
          answer={t(
            "每次提交一個新的問題並由 AI 占師生成解盤,會依該功能消耗對應點數。每日靈訊、是非快問、瀏覽歷史紀錄為免費功能,不會扣點。",
            "Each new question that produces an AI reading consumes credits, with the amount depending on the feature. Daily oracle, yes/no questions, and viewing history are free and do not consume credits.",
            "新しい質問を投稿し AI が解読を生成するごとに、機能に応じたポイントが消費されます。デイリーオラクル、Yes/No 質問、履歴閲覧は無料です。",
            "새 질문을 보내고 AI 해석을 받을 때마다 기능별로 포인트가 차감됩니다. 데일리 오라클, 예/아니오 질문, 기록 조회는 무료입니다."
          )}
        />

        <Faq
          question={t(
            "我可以退款嗎?",
            "Can I get a refund?",
            "返金は可能ですか?",
            "환불할 수 있나요?"
          )}
          answer={t(
            "透過 App Store 完成的點數購買,退款流程由 Apple 統一處理。請至 reportaproblem.apple.com 提交退款申請,Apple 將依其政策審核。若有特殊狀況,您也可以來信 contact@heronhouse.me 由我們協助轉達。",
            "Refunds for in-app purchases made through the App Store are handled by Apple. Please submit a refund request at reportaproblem.apple.com — Apple will review it according to their policy. For special circumstances you may also email contact@heronhouse.me and we can help relay your case.",
            "App Store 経由のアプリ内購入の返金は Apple が一括管理します。reportaproblem.apple.com から返金リクエストをご提出ください。特別な事情がある場合は contact@heronhouse.me までご連絡いただければお取り次ぎいたします。",
            "App Store에서 구매한 인앱 결제 환불은 Apple이 일괄 처리합니다. reportaproblem.apple.com에서 환불 요청을 제출해 주세요. 특별한 사정이 있다면 contact@heronhouse.me로 연락 주시면 도움을 드릴 수 있습니다."
          )}
        />

        <Faq
          question={t(
            "我想刪除我的帳號",
            "How do I delete my account?",
            "アカウントを削除したい",
            "계정을 삭제하고 싶어요"
          )}
          answer={t(
            "請至「會員中心 → 刪除帳號」自助刪除,系統會立即清除您於本平台之所有占卜紀錄、點數與 auth 身份。完成後若仍有第三方留存資料(例如金流發票紀錄),會依稅務法令保留固定期間。",
            "Go to Account → Delete Account in the app to remove your data immediately. All readings, credit balances and auth identities will be erased. Third-party records required by tax law (e.g. payment receipts) will be retained for the legally required period.",
            "アプリ内の「アカウント → アカウント削除」からセルフサービスで削除できます。占い履歴、ポイント残高、認証情報がすぐに削除されます。税法上保管が必要な決済記録のみ法定期間保持されます。",
            "앱 내 \"계정 → 계정 삭제\"에서 직접 삭제할 수 있습니다. 모든 점술 기록, 포인트 잔액, 인증 정보가 즉시 삭제됩니다. 세법상 보관이 필요한 결제 기록만 법정 기간 동안 보관됩니다."
          )}
          link={{
            href: "/account/delete",
            label: t("前往刪除頁", "Go to delete page", "削除ページへ", "삭제 페이지로"),
          }}
        />

        <Faq
          question={t(
            "我登入後看不到舊的占卜紀錄",
            "I can't see my old readings after signing in",
            "ログイン後、過去の占いが見つかりません",
            "로그인 후 이전 점술 기록이 보이지 않아요"
          )}
          answer={t(
            "未登入時的占卜紀錄保存在當下使用的瀏覽器或裝置本機(localStorage)。若您在新裝置或不同瀏覽器登入,先前的本機紀錄無法同步過去。您可在原本的瀏覽器登入,讓資料自動上傳雲端,之後就可跨裝置查看。",
            "Readings made before sign-in are stored locally on the browser or device you used. If you sign in from a new device or different browser, those local records cannot be synced over. Sign in from the original browser to upload the data to the cloud first — after that it will be available across devices.",
            "ログイン前の占い履歴は、ご利用のブラウザまたは端末のローカル(localStorage)に保存されています。新しい端末や別のブラウザでログインした場合、以前のローカル履歴は同期できません。元のブラウザでログインすればデータがクラウドへアップロードされ、以降は端末をまたいで閲覧できます。",
            "로그인 전의 점술 기록은 사용한 브라우저나 기기의 로컬(localStorage)에 저장됩니다. 새 기기나 다른 브라우저에서 로그인하면 이전 로컬 기록은 동기화되지 않습니다. 원래 브라우저에서 로그인하면 데이터가 클라우드로 업로드되어 이후 여러 기기에서 확인할 수 있습니다."
          )}
        />

        <Faq
          question={t(
            "AI 解盤的內容可以當作人生決策的依據嗎?",
            "Can I rely on the AI reading to make life decisions?",
            "AI の解読を人生の決断に使ってもよいですか?",
            "AI 해석을 인생의 결정에 사용해도 되나요?"
          )}
          answer={t(
            "不建議。Tarogram 的所有占卜內容皆為娛樂與自我反思用途,不構成醫療、財務、法律或心理治療建議。重大決策請諮詢合格的專業人士,並以您自身的理性判斷為最終依歸。",
            "We recommend you don't. All readings in Tarogram are for entertainment and self-reflection only and do not constitute medical, financial, legal, or therapeutic advice. For major decisions please consult qualified professionals and rely on your own judgment.",
            "おすすめしません。Tarogram の占い内容はすべて娯楽と自己内省のためのものであり、医療・金融・法律・心理療法の助言には該当しません。重大な決断は有資格の専門家にご相談のうえ、ご自身の判断を最優先してください。",
            "권장하지 않습니다. Tarogram의 모든 점술 내용은 오락과 자기 성찰을 위한 것이며 의료, 금융, 법률, 심리치료 조언에 해당하지 않습니다. 중요한 결정은 자격을 갖춘 전문가와 상의하시고 본인의 판단을 최우선으로 하시기 바랍니다."
          )}
        />

        {/* === 法律連結 === */}
        <div
          style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: "1px solid rgba(212,168,85,0.15)",
            fontSize: 13,
            color: "rgba(192,192,208,0.7)",
          }}
        >
          <p style={{ marginBottom: 6 }}>
            {t("相關文件:", "Related documents:", "関連文書:", "관련 문서:")}{" "}
            <Link
              href="/terms"
              style={{ color: "rgba(212,168,85,0.85)", textDecoration: "underline" }}
            >
              {t("服務條款", "Terms of Service", "利用規約", "이용약관")}
            </Link>
            {" · "}
            <Link
              href="/privacy"
              style={{ color: "rgba(212,168,85,0.85)", textDecoration: "underline" }}
            >
              {t("隱私權政策", "Privacy Policy", "プライバシーポリシー", "개인정보처리방침")}
            </Link>
          </p>
          <p style={{ fontSize: 12, color: "rgba(192,192,208,0.5)" }}>
            {t(
              "營運方:鷺居國際 Heron House",
              "Operated by Heron House",
              "運営:Heron House",
              "운영: Heron House"
            )}
          </p>
        </div>
      </main>
    </div>
  );
}

// ====== 子元件 ======

interface FaqProps {
  question: string;
  answer: string;
  link?: { href: string; label: string };
}

function Faq({ question, answer, link }: FaqProps) {
  return (
    <details
      style={{
        marginBottom: 14,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid rgba(212,168,85,0.18)",
        background: "rgba(10,10,30,0.45)",
      }}
    >
      <summary
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "#e8e8f0",
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        {question}
      </summary>
      <p
        style={{
          marginTop: 10,
          fontSize: 14,
          color: "rgba(232,232,240,0.85)",
          lineHeight: 1.75,
        }}
      >
        {answer}
      </p>
      {link && (
        <Link
          href={link.href}
          style={{
            display: "inline-block",
            marginTop: 8,
            color: "#d4a855",
            fontSize: 13,
            textDecoration: "underline",
          }}
        >
          {link.label} →
        </Link>
      )}
    </details>
  );
}
