"use client";

import Link from "next/link";
import Header from "@/components/Header";
import { useLanguage } from "@/i18n/LanguageContext";

export default function TermsPage() {
  const { locale, t } = useLanguage();
  const isZh = locale === "zh";

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
            ← {t("返回首頁", "Back to home")}
          </Link>
        </div>

        <h1
          className="text-gold-gradient"
          style={{
            fontSize: 28,
            fontFamily: "'Noto Serif TC', serif",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          {t("服務條款與免責聲明", "Terms & Disclaimer")}
        </h1>
        <p
          style={{
            color: "rgba(192,192,208,0.6)",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          {t(
            "最後更新日期:2026 年 4 月 19 日",
            "Last updated: April 19, 2026"
          )}
        </p>

        {isZh ? (
          <article
            style={{
              color: "rgba(232,232,240,0.9)",
              fontSize: 14,
              lineHeight: 1.85,
              fontFamily: "'Noto Sans TC', sans-serif",
            }}
          >
            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>一、服務性質</h2>
              <p style={paragraphStyle}>
                本平台(以下簡稱「本服務」)提供之易經占卜、塔羅牌占卜及 AI 解盤內容,
                屬於以古今命理文化為本的個人娛樂與自我反思工具,
                不具任何科學預測、醫療診斷、法律意見或財務投資建議之性質與效力,
                亦無法取代合格專業人士之診斷、評估或建議。
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>二、使用限制</h2>
              <p style={paragraphStyle}>
                請勿將本服務所產生之占卜內容,作為下列事項之唯一或主要依據:
              </p>
              <ul style={listStyle}>
                <li>投資、交易、資產配置或任何金融相關決策</li>
                <li>醫療處置、用藥選擇、心理健康或疾病診斷</li>
                <li>婚姻、離婚、扶養、繼承或其他家事決定</li>
                <li>訴訟、合約簽署、法律行為或商業協商</li>
                <li>重大職涯選擇,如離職、創業、移居等</li>
                <li>涉及他人權益、安全或生命之任何判斷</li>
              </ul>
              <p style={paragraphStyle}>
                上述事項建請諮詢合格之醫師、律師、財務顧問、心理師等專業人員,
                並以您個人理性判斷為最終依歸。
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>三、AI 解盤之性質</h2>
              <p style={paragraphStyle}>
                本服務所提供之「老師解盤」及後續對話內容由人工智慧(AI)
                依據卦象或牌意自動生成,其內容可能受模型訓練資料、隨機性與上下文影響,
                無法保證其絕對正確性、完整性或適用性。使用者應以批判性思考評估其內容,
                不應盲目依循。
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>四、責任歸屬</h2>
              <p style={paragraphStyle}>
                使用者理解並同意,任何基於本服務內容所作之判斷、決定、行動及其後果
                (包括但不限於財務損失、健康損害、人際糾紛或法律責任),
                均由使用者本人自行承擔。鷺居國際及本平台之營運團隊、
                合作廠商與授權第三方,均不對任何直接、間接、附帶、衍生或懲罰性損害負責。
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>五、適用對象</h2>
              <p style={paragraphStyle}>
                本服務適用於年滿 18 歲之使用者。未成年人使用本服務前應取得法定代理人同意。
                若您對占卜、命理相關內容感到不適或已影響日常心理狀態,
                建議暫停使用並尋求專業協助。
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>六、智慧財產權</h2>
              <p style={paragraphStyle}>
                本平台所使用之塔羅牌圖像,係由鷺居國際以 AI 繪圖工具
                (Google Gemini) 重新繪製,其構圖意象參考源自公共領域之
                Rider-Waite-Smith 塔羅 (Pamela Colman Smith, 1909)。
                七十八張牌之選擇、編排,以及搭配之牌義解說文字,
                均為鷺居國際之原創編輯成果。其餘介面、文字、程式碼、商標
                等均為鷺居國際或其授權方所有,未經書面同意不得重製、散布
                或商業利用。
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>七、隱私與資料</h2>
              <p style={paragraphStyle}>
                您提出之占卜問題、占卜結果等資料,若於登入狀態下使用,
                將存入本平台之雲端資料庫供您查閱歷史紀錄。
                您可隨時於會員中心刪除個人帳號及相關資料。
                本平台不會主動將您的個人資料提供予第三方,
                但為提供 AI 解盤服務,您的問題內容會傳遞至合作之第三方
                AI 服務進行處理。詳細個資處理方式請參閱隱私權政策。
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>八、條款修訂</h2>
              <p style={paragraphStyle}>
                本平台保留隨時修訂本條款之權利,修訂後將於本頁面公告,
                不另行個別通知。您於條款修訂後繼續使用本服務,
                即視為同意修訂後之條款。
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>九、聯絡方式</h2>
              <p style={paragraphStyle}>
                如對本條款有任何疑問,或需行使個人資料相關權利,
                請透過鷺居國際官方管道聯繫我們。
              </p>
            </section>

            <p
              style={{
                ...paragraphStyle,
                marginTop: 40,
                padding: 16,
                background: "rgba(212,168,85,0.08)",
                border: "1px solid rgba(212,168,85,0.2)",
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              您送出問題並使用本服務,即代表您已詳閱並同意上述所有條款。
            </p>
          </article>
        ) : (
          <article
            style={{
              color: "rgba(232,232,240,0.9)",
              fontSize: 14,
              lineHeight: 1.85,
              fontFamily: "'Noto Sans TC', sans-serif",
            }}
          >
            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>1. Nature of Service</h2>
              <p style={paragraphStyle}>
                This platform provides I Ching divination, tarot readings, and
                AI-generated interpretations as personal entertainment and
                self-reflection tools grounded in classical divinatory culture.
                It does not constitute, and cannot substitute for, scientific
                prediction, medical diagnosis, legal counsel, or financial
                advice from qualified professionals.
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>2. Usage Limitations</h2>
              <p style={paragraphStyle}>
                Do not rely on readings as the sole or primary basis for:
              </p>
              <ul style={listStyle}>
                <li>Investment, trading, or any financial decisions</li>
                <li>Medical treatment, medication, or mental-health diagnosis</li>
                <li>Marriage, divorce, custody, or inheritance matters</li>
                <li>Litigation, contracts, or business negotiations</li>
                <li>Major career moves such as resignation, founding a company, or relocation</li>
                <li>Any judgment affecting the rights, safety, or life of others</li>
              </ul>
              <p style={paragraphStyle}>
                Please consult qualified physicians, lawyers, financial
                advisors, or licensed therapists, and rely on your own rational
                judgment for such matters.
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>3. AI-Generated Content</h2>
              <p style={paragraphStyle}>
                &quot;Master&apos;s Reading&quot; text and follow-up chat
                responses are generated by AI based on hexagram or card
                meanings. Output may be affected by model training data,
                randomness, and context, and accuracy cannot be guaranteed.
                Please evaluate the content critically.
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>4. Liability</h2>
              <p style={paragraphStyle}>
                You agree that any decisions, actions, and consequences
                (including but not limited to financial loss, health harm,
                interpersonal conflict, or legal liability) arising from use of
                this service are solely your responsibility. Heronhouse and its
                operators, partners, and licensed third parties shall not be
                liable for any direct, indirect, incidental, consequential, or
                punitive damages.
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>5. Eligibility</h2>
              <p style={paragraphStyle}>
                This service is intended for users aged 18 or above. Minors
                must obtain consent from a legal guardian before use. If
                divination content causes discomfort or affects your mental
                state, please stop using the service and seek professional
                help.
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>6. Intellectual Property</h2>
              <p style={paragraphStyle}>
                Tarot artwork displayed on this platform is generated by
                Heronhouse using an AI image tool (Google Gemini), with
                compositions inspired by the public-domain Rider-Waite-Smith
                deck (Pamela Colman Smith, 1909). The selection, arrangement,
                and accompanying interpretive text of the 78 cards are
                original editorial works of Heronhouse. All other interface
                elements, text, code, and trademarks belong to Heronhouse or
                its licensors; reproduction, distribution, or commercial use
                is prohibited without written permission.
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>7. Privacy & Data</h2>
              <p style={paragraphStyle}>
                Questions and readings submitted while signed in are stored in
                our cloud database for your personal history. You may delete
                your account and related data at any time. We do not
                proactively share personal data with third parties, but
                questions are transmitted to a third-party AI service for
                processing. See the Privacy Policy for details.
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>8. Updates</h2>
              <p style={paragraphStyle}>
                We reserve the right to update these terms at any time, posted
                on this page without individual notice. Continued use after
                updates constitutes acceptance.
              </p>
            </section>

            <section style={{ marginBottom: 28 }}>
              <h2 style={sectionHeadingStyle}>9. Contact</h2>
              <p style={paragraphStyle}>
                For questions about these terms or to exercise your personal
                data rights, please contact Heronhouse through official
                channels.
              </p>
            </section>

            <p
              style={{
                ...paragraphStyle,
                marginTop: 40,
                padding: 16,
                background: "rgba(212,168,85,0.08)",
                border: "1px solid rgba(212,168,85,0.2)",
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              By submitting a question and using this service, you confirm that
              you have read and agreed to all of the terms above.
            </p>
          </article>
        )}
      </main>
    </div>
  );
}

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 17,
  fontFamily: "'Noto Serif TC', serif",
  fontWeight: 700,
  color: "#d4a855",
  marginTop: 0,
  marginBottom: 10,
};

const paragraphStyle: React.CSSProperties = {
  margin: "0 0 10px",
};

const listStyle: React.CSSProperties = {
  margin: "8px 0 10px",
  paddingLeft: 22,
  color: "rgba(232,232,240,0.85)",
};
