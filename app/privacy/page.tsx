"use client";

/**
 * /privacy — 隱私權政策頁
 *
 * Google Play 2023+ 上架必要(Data Safety 會要求一個 URL),
 * 同時也是 GDPR / 台灣個資法的通用基本盤。內容對應目前實際行為:
 *   - 蒐集項目:email / OAuth 基本資料 / 占卜問題 & 結果 / chat / IP & UA
 *   - 存儲:第三方雲端資料庫,亞太區(不指名廠商,未來換商更彈性)
 *   - 第三方(category-level):登入驗證(Google OAuth)、AI 服務商、雲端基礎設施
 *   - 行使權利:/account/delete 即時刪帳號 + 資料
 *
 * 註:版型與 /terms 對齊,isZh 切換兩套 article。
 */
import Link from "next/link";
import Header from "@/components/Header";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PrivacyPage() {
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
          {t("隱私權政策", "Privacy Policy")}
        </h1>
        <p
          style={{
            color: "rgba(192,192,208,0.6)",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          {t(
            "最後更新日期:2026 年 4 月 21 日",
            "Last updated: April 21, 2026"
          )}
        </p>

        {isZh ? (
          <article style={articleStyle}>
            <section style={sectionStyle}>
              <p style={paragraphStyle}>
                鷺居國際(以下簡稱「本平台」)非常重視您的個人資料保護。本政策
                說明我們於 oracle.heronhouse.me 及其子網域(以下合稱「本服務」)
                所蒐集、使用、儲存與處理之個人資料內容。您使用本服務即代表您
                已閱讀並同意本政策。
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>一、我們蒐集的資料</h2>
              <p style={paragraphStyle}>本平台於下列情境蒐集個人資料:</p>
              <ul style={listStyle}>
                <li>
                  <strong>登入資料</strong>:您透過 Google OAuth 登入時,
                  我們會收到您的電子郵件地址、顯示名稱與頭像 URL。
                  不會取得通訊錄、雲端硬碟或其他 Google 帳戶資料。
                </li>
                <li>
                  <strong>占卜內容</strong>:您輸入的問題、選擇的分類、
                  擲出的卦象或抽到的塔羅牌、AI 生成之解盤文字、衍伸占卜串與
                  後續 chat 對話紀錄。
                </li>
                <li>
                  <strong>點數與訂閱狀態</strong>:您的點數餘額、消耗紀錄、
                  訂閱方案及到期日。
                </li>
                <li>
                  <strong>技術資訊</strong>:瀏覽器類型、IP 位址、
                  操作時間戳記、錯誤日誌。此類資料僅用於系統除錯與濫用防範,
                  不會主動對外揭露。
                </li>
              </ul>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>二、蒐集目的與使用方式</h2>
              <ul style={listStyle}>
                <li>提供占卜 AI 解盤、歷史紀錄、衍伸占卜等核心功能</li>
                <li>維護您的會員身份、訂閱狀態與點數餘額</li>
                <li>防範濫用、攻擊及違反服務條款之行為</li>
                <li>依法令要求配合司法或政府機關調查</li>
              </ul>
              <p style={paragraphStyle}>
                我們不會將您的占卜內容作為廣告推送依據,亦不販售個人資料。
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>三、資料存儲位置與加密</h2>
              <p style={paragraphStyle}>
                您於登入狀態下產生的帳號與占卜資料,由本平台合作之第三方雲端
                服務(見第四章)託管,伺服器位於亞太地區,因此涉及個人資料
                之國際傳輸。未登入時產生的占卜資料僅保存於您的瀏覽器本機
                (localStorage),不會上傳至本平台伺服器。
              </p>
              <p style={paragraphStyle}>
                <strong>傳輸加密</strong>:所有瀏覽器 / App 與本平台之間的
                通訊皆強制使用 HTTPS/TLS 加密,包含登入、占卜送出、AI 對話
                與訂閱金流。
                <br />
                <strong>儲存加密</strong>:雲端資料庫供應商於儲存層預設提供
                靜態加密(encryption at rest),金鑰由供應商管理。
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>四、第三方服務</h2>
              <p style={paragraphStyle}>
                為提供完整服務,本平台會將必要資料傳送至下列類別之第三方:
              </p>
              <ul style={listStyle}>
                <li>
                  <strong>登入驗證服務</strong>:您可選擇 Google OAuth
                  或 Facebook Login 登入,我們僅取得 email、顯示名稱
                  與頭像,不會存取通訊錄、雲端硬碟、好友清單或其他
                  社群帳戶資料。
                </li>
                <li>
                  <strong>AI 服務提供商</strong>:您的問題內容、卦象 / 牌面
                  與衍伸對話會傳送至合作之第三方 AI 服務進行生成,
                  不含您的 email、真實姓名或 IP 位址。
                </li>
                <li>
                  <strong>雲端基礎設施服務商</strong>:提供資料庫與網站託管
                  服務,協助儲存您的帳號與占卜資料。
                </li>
              </ul>
              <p style={paragraphStyle}>
                上述服務商皆具備國際通用之資安與合規標準,但本平台無法完全
                控制其內部處理流程。
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>五、Cookie 與類似技術</h2>
              <p style={paragraphStyle}>
                本平台使用必要 cookie 維持登入狀態與語系偏好,
                並使用瀏覽器 localStorage 暫存訪客占卜紀錄(登入後自動併入雲端)。
                我們目前不使用第三方廣告追蹤 cookie。
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>六、資料保存期限</h2>
              <ul style={listStyle}>
                <li>
                  帳號存在期間:占卜紀錄、訂閱狀態與點數資料將持續保留,
                  供您隨時查閱。
                </li>
                <li>
                  帳號刪除後:所有占卜紀錄、訂閱資料、auth 身份均於 24 小時內
                  清除;第三方服務商之操作日誌則依其各自政策於 30–90 日內輪替。
                </li>
                <li>
                  法令要求保留之資料(如發票、金流對帳)
                  依稅務規定保存 5 年。
                </li>
              </ul>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>七、您的權利</h2>
              <p style={paragraphStyle}>您對本平台所持有之個人資料享有下列權利:</p>
              <ul style={listStyle}>
                <li>查閱與取得複本(透過「占卜紀錄」頁面即時查看)</li>
                <li>請求更正或補充(Google 帳戶資料請至 Google 管理)</li>
                <li>請求停止處理或刪除(見下段「帳號刪除」)</li>
                <li>撤回同意(等同於刪除帳號)</li>
              </ul>
              <p style={paragraphStyle}>
                <strong>帳號刪除:</strong>請前往{" "}
                <Link
                  href="/account/delete"
                  style={{ color: "#d4a855", textDecoration: "underline" }}
                >
                  /account/delete
                </Link>{" "}
                自助刪除,系統會立即清除您於本平台之所有資料,無須聯絡客服。
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>八、兒童隱私</h2>
              <p style={paragraphStyle}>
                本服務不針對 13 歲以下兒童設計,且未主動蒐集其個人資料。
                若您得知未成年者未經其法定代理人同意而提供個人資料,
                請依下列聯絡方式通知我們,我們將儘速移除。
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>九、資料外洩通知</h2>
              <p style={paragraphStyle}>
                如發生可能影響您個人資料安全之重大事件,
                我們將於發現後 72 小時內以您註冊之 email 通知,
                並公告於本頁面。
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>十、政策修訂</h2>
              <p style={paragraphStyle}>
                本政策可能不定期修訂,重大異動將於本頁面最上方更新版本日期,
                並以 email 或網站公告周知。您於修訂後繼續使用本服務,
                即視為同意修訂內容。
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>十一、聯絡方式</h2>
              <p style={paragraphStyle}>
                如對本政策、個人資料處理或權利行使有任何疑問,
                請寄信至{" "}
                <a
                  href="mailto:contact@heronhouse.me"
                  style={{ color: "#d4a855", textDecoration: "underline" }}
                >
                  contact@heronhouse.me
                </a>
                ,我們將於 7 個工作天內回覆。
              </p>
              <p style={paragraphStyle}>營運方:鷺居國際(Heronhouse)</p>
            </section>

            <p style={footerNoteStyle}>
              您使用本服務即代表您已詳閱並同意本隱私權政策之全部內容。
            </p>
          </article>
        ) : (
          <article style={articleStyle}>
            <section style={sectionStyle}>
              <p style={paragraphStyle}>
                Heronhouse (&quot;we,&quot; &quot;us&quot;) takes your privacy
                seriously. This Privacy Policy describes what personal data we
                collect, how we use it, and your rights when you use
                oracle.heronhouse.me and its subdomains (the &quot;Service&quot;).
                By using the Service, you acknowledge that you have read and
                agree to this Policy.
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>1. Data We Collect</h2>
              <ul style={listStyle}>
                <li>
                  <strong>Account data</strong>: When you sign in with Google
                  OAuth, we receive your email address, display name, and
                  avatar URL. We do not access your contacts, Drive, or other
                  Google account data.
                </li>
                <li>
                  <strong>Divination content</strong>: Questions you submit,
                  chosen categories, hexagrams or tarot cards drawn,
                  AI-generated readings, follow-up threads, and chat messages.
                </li>
                <li>
                  <strong>Credits & subscription</strong>: Credit balance,
                  consumption records, subscription plan and expiration date.
                </li>
                <li>
                  <strong>Technical data</strong>: Browser type, IP address,
                  timestamps, and error logs. Used only for debugging and abuse
                  prevention; never disclosed externally.
                </li>
              </ul>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>2. Purposes & Use</h2>
              <ul style={listStyle}>
                <li>
                  Provide core features: AI readings, history, follow-up
                  divinations
                </li>
                <li>
                  Maintain your membership, subscription status, and credit
                  balance
                </li>
                <li>Prevent abuse, attacks, and Terms violations</li>
                <li>Comply with lawful requests from judicial authorities</li>
              </ul>
              <p style={paragraphStyle}>
                We do not use your divination content for advertising and do
                not sell personal data.
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>3. Where Data Is Stored & Encryption</h2>
              <p style={paragraphStyle}>
                Data generated while signed in is hosted by third-party cloud
                providers (see Section 4) on servers located in the
                Asia-Pacific region, which constitutes an international
                transfer of personal data. Divination data generated while
                signed out is stored only in your browser&apos;s localStorage
                and is never uploaded to our servers.
              </p>
              <p style={paragraphStyle}>
                <strong>In transit</strong>: All traffic between your browser
                or App and our servers is encrypted via HTTPS/TLS, including
                sign-in, divinations, AI follow-up chat, and subscription
                payments.
                <br />
                <strong>At rest</strong>: Our cloud database provider applies
                encryption-at-rest by default at the storage layer, with keys
                managed by the provider.
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>4. Third-Party Services</h2>
              <p style={paragraphStyle}>
                To provide full functionality, we transmit necessary data to
                the following categories of third parties:
              </p>
              <ul style={listStyle}>
                <li>
                  <strong>Authentication providers</strong>: You can sign in
                  via Google OAuth or Facebook Login. We receive only email,
                  display name, and avatar. We do not access your contacts,
                  Drive, friend list, or any other social account data.
                </li>
                <li>
                  <strong>AI service providers</strong>: Your question,
                  hexagram/cards, and follow-up chat are forwarded to a
                  third-party AI service for generation. Email, real name, and
                  IP address are not included.
                </li>
                <li>
                  <strong>Cloud infrastructure providers</strong>: Database
                  hosting and website hosting for your account and divination
                  data.
                </li>
              </ul>
              <p style={paragraphStyle}>
                These providers follow internationally recognized security
                standards, but we cannot fully control their internal
                processes.
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>5. Cookies & Similar</h2>
              <p style={paragraphStyle}>
                We use essential cookies to maintain your sign-in state and
                language preference, and browser localStorage to cache guest
                divination history (migrated to cloud upon sign-in). We do not
                use third-party advertising trackers.
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>6. Retention</h2>
              <ul style={listStyle}>
                <li>
                  While the account exists: divination history, subscription,
                  and credits remain available for you to view.
                </li>
                <li>
                  After deletion: all divination records, subscription data,
                  and auth identity are purged within 24 hours. Third-party
                  provider operational logs rotate per their respective
                  policies (30–90 days).
                </li>
                <li>
                  Data legally required to retain (invoices, payment
                  reconciliation) is kept 5 years per tax regulations.
                </li>
              </ul>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>7. Your Rights</h2>
              <p style={paragraphStyle}>You have the right to:</p>
              <ul style={listStyle}>
                <li>Access and obtain a copy (see the History page)</li>
                <li>
                  Request correction (Google profile data via your Google
                  account)
                </li>
                <li>
                  Request deletion or stop processing (see &quot;Account
                  Deletion&quot; below)
                </li>
                <li>Withdraw consent (equivalent to account deletion)</li>
              </ul>
              <p style={paragraphStyle}>
                <strong>Account deletion:</strong> visit{" "}
                <Link
                  href="/account/delete"
                  style={{ color: "#d4a855", textDecoration: "underline" }}
                >
                  /account/delete
                </Link>
                . The self-service flow immediately removes all your data —
                no need to contact support.
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>8. Children&apos;s Privacy</h2>
              <p style={paragraphStyle}>
                The Service is not directed to children under 13 and we do not
                knowingly collect their data. If you learn that a minor has
                provided personal data without guardian consent, please contact
                us and we will remove it promptly.
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>9. Breach Notification</h2>
              <p style={paragraphStyle}>
                If a security incident may impact your personal data, we will
                notify you by email within 72 hours of discovery and post a
                notice on this page.
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>10. Changes</h2>
              <p style={paragraphStyle}>
                This Policy may be updated periodically. Material changes will
                update the date at the top of this page and be announced by
                email or site notice. Continued use after changes constitutes
                acceptance.
              </p>
            </section>

            <section style={sectionStyle}>
              <h2 style={sectionHeadingStyle}>11. Contact</h2>
              <p style={paragraphStyle}>
                For any question about this Policy, personal data handling, or
                to exercise your rights, email{" "}
                <a
                  href="mailto:contact@heronhouse.me"
                  style={{ color: "#d4a855", textDecoration: "underline" }}
                >
                  contact@heronhouse.me
                </a>
                . We aim to reply within 7 business days.
              </p>
              <p style={paragraphStyle}>Operator: Heronhouse</p>
            </section>

            <p style={footerNoteStyle}>
              By using the Service, you confirm that you have read and agreed
              to the entirety of this Privacy Policy.
            </p>
          </article>
        )}
      </main>
    </div>
  );
}

const articleStyle: React.CSSProperties = {
  color: "rgba(232,232,240,0.9)",
  fontSize: 14,
  lineHeight: 1.85,
  fontFamily: "'Noto Sans TC', sans-serif",
};

const sectionStyle: React.CSSProperties = { marginBottom: 28 };

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

const footerNoteStyle: React.CSSProperties = {
  ...paragraphStyle,
  marginTop: 40,
  padding: 16,
  background: "rgba(212,168,85,0.08)",
  border: "1px solid rgba(212,168,85,0.2)",
  borderRadius: 10,
  fontSize: 13,
};
