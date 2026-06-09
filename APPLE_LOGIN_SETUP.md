# Apple 登入(Sign in with Apple)啟用指南

本專案的 Apple 登入走 **Supabase 網頁版 OAuth**(不是原生 Swift 外掛)。
iOS App 是薄殼 Capacitor,直接 WebView 載入 `tarogram.heronhouse.me`,所以網頁的 OAuth 流程在 Safari 與 iOS App 內都會跑。

**程式碼已就緒**,你只需要完成 Apple / Supabase / Vercel 後台設定,最後把開關打開。

> ⚠️ **順序很重要**:`NEXT_PUBLIC_APPLE_LOGIN_ENABLED=true` 一定要**最後**才設。
> 提前打開並部署 → 按鈕會出現,但使用者點下去會收到 `400 unsupported provider`。

---

## 你的專屬值(填表時直接複製)

| 項目 | 值 |
|---|---|
| App Bundle ID | `me.heronhouse.tarogram` |
| 網站網域 | `tarogram.heronhouse.me` |
| Supabase 專案 | `xpijubxjokrpysrpjrct` |
| **Apple Return URL / Supabase callback** | `https://xpijubxjokrpysrpjrct.supabase.co/auth/v1/callback` |

---

## 步驟 1 — 加入 Apple Developer Program(年費 US$99)

1. 前往 https://developer.apple.com/programs/ → Enroll。
2. 用公司或個人 Apple ID 申請,付 US$99/年,等審核通過(通常 24–48 小時)。
   - 沒有這個就無法建立 Services ID 與 .p8 key。

## 步驟 2 — App ID 開啟 Sign in with Apple

1. https://developer.apple.com/account → Certificates, IDs & Profiles → **Identifiers**。
2. 找到(或新增)App ID `me.heronhouse.tarogram`。
3. 編輯 → 勾選 **Sign in with Apple** → Save。

## 步驟 3 — 建立 Services ID(這就是 OAuth 的 client_id)

1. Identifiers → 右上 `+` → 選 **Services IDs** → Continue。
2. Description 隨意(例:`Tarogram Web Login`)。
3. Identifier 建議:`me.heronhouse.tarogram.web`(**記下來,Supabase 要填**)。
4. 建好後再點進該 Services ID → 勾選 **Sign in with Apple** → **Configure**:
   - Primary App ID:選 `me.heronhouse.tarogram`
   - **Domains and Subdomains**:`xpijubxjokrpysrpjrct.supabase.co`
   - **Return URLs**:`https://xpijubxjokrpysrpjrct.supabase.co/auth/v1/callback`
   - Save → Continue → Save。

> 註:Domain 填 Supabase 網域,因為 OAuth 是 redirect 到 Supabase 的 `/auth/v1/callback` 再轉回站內。

## 步驟 4 — 建立 Sign in with Apple Key(.p8)

1. Certificates, IDs & Profiles → **Keys** → `+`。
2. 命名(例:`Tarogram SignIn Key`)→ 勾選 **Sign in with Apple** → Configure → Primary App ID 選 `me.heronhouse.tarogram` → Save → Continue → Register。
3. **下載 `.p8` 檔(只能下載一次,務必保存)**。
4. 記下三個值:
   - **Key ID**(這頁顯示,例 `ABC123DEFG`)
   - **Team ID**(右上角帳號名稱旁,或 Membership 頁,10 碼)
   - **.p8 檔內容**(用文字編輯器打開,整段 `-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----`)

## 步驟 5 — Supabase 啟用 Apple Provider

1. https://supabase.com/dashboard → 專案 `xpijubxjokrpysrpjrct` → **Authentication → Providers → Apple** → Enable。
2. 填入:
   - **Client IDs / Services ID**:`me.heronhouse.tarogram.web`(步驟 3 的 Identifier)
   - **Secret Key (for OAuth)**:Supabase 會要 Team ID / Key ID / .p8 來產生 client secret。依畫面欄位填:
     - Team ID = 步驟 4 的 Team ID
     - Key ID = 步驟 4 的 Key ID
     - Private Key = .p8 檔整段內容
3. Save。
4. (建議)同頁確認 **Authentication → URL Configuration → Redirect URLs** 有包含 `https://tarogram.heronhouse.me/api/auth/callback`(站內 PKCE callback)。

## 步驟 6 — 打開開關並部署

1. **Vercel**(正式環境)→ 專案 → Settings → Environment Variables → 新增:
   - Key:`NEXT_PUBLIC_APPLE_LOGIN_ENABLED`
   - Value:`true`
   - 環境:Production(視需要也勾 Preview)
2. 觸發一次 **redeploy**(env 變更不會自動生效)。
3. (本地測試)把 `.env.local` 的 `NEXT_PUBLIC_APPLE_LOGIN_ENABLED` 改成 `true`,重啟 `npm run dev`。

## 步驟 7 — 驗證

- 開 `tarogram.heronhouse.me`,登入 modal 應出現黑色 **使用 Apple 帳號登入** 按鈕。
- 點下去 → 跳 Apple 同意畫面 → 授權後回到站內並完成登入。
- iOS App 內同樣會出現(因為 App 就是載這個網站)。
- 若出現 `400 unsupported provider` → Supabase Apple provider 還沒存好或 Services ID 填錯。
- 若 Apple 頁面報 `invalid_client` / redirect 錯誤 → 檢查 Services ID 的 Return URL 與 Supabase callback 是否一字不差。

---

## 補充:App Store 審查(4.8 條)

App Store Review 4.8 規定:**若提供第三方社群登入(如 Google/Facebook),就必須同時提供 Sign in with Apple。**
- 目前 iOS App 內 Google 是隱藏的,只有 Email + (本次新增的) Apple,符合規範。
- 送審前確保 Apple 按鈕在 iOS App 內正常運作即可。

## 補充:程式端現況(無需改動)

- `components/LoginOptionsModal.tsx`:Apple 按鈕由 `APPLE_LOGIN_ENABLED`(= `NEXT_PUBLIC_APPLE_LOGIN_ENABLED === "true"`)控制,翻 flag 即顯示。
- `lib/auth/signIn.ts`:`signInWithSocial("apple")` 已帶 `scopes: "email name"`(Apple 預設不回 email,必須明寫)。
- `app/api/auth/callback/route.ts`:PKCE callback 已通用於所有 provider。
