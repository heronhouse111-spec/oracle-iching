# Tarogram 易問 · Google Play Console + GCP 設定手冊

> 接續 `PACKAGING.md`(Bubblewrap 打 .aab)之後的工作:把 .aab 上傳到 Play Console、
> 建立 in-app products + subscriptions、設好 GCP service account 讓伺服器能驗購買、
> 接 RTDN webhook 讓訂閱續期事件能進來。
>
> 預估時間:第一次做 2-3 個工作天(扣掉 D-U-N-S / 帳號驗證等待)。

---

## 0. Pre-flight 狀態

開始前先確認:

| 項目 | 狀態檢查 |
|---|---|
| Play Console developer account | ✓ 已驗證通過(註冊到通過 1-2 週) |
| Bubblewrap 打出第一版 `.aab` | ✓ 參考 `PACKAGING.md` |
| 已上傳到 Internal testing 軌道 | ✓ Release 至少 Draft 狀態 |
| Play App Signing SHA256 已回填 `assetlinks.json` | ✓ 參考 `PACKAGING.md` §7 |
| `https://tarogram.heronhouse.me` 線上、可訪問 | ✓ Vercel deploy 正常 |
| Privacy Policy URL | ✓ `https://tarogram.heronhouse.me/privacy` 可開啟 |
| Terms of Service URL | ✓ `https://tarogram.heronhouse.me/terms` 可開啟 |

如果上面任一項打 ✗,先回去處理。底下流程都假設這些前置都通過。

---

## 1. Store listing(上架前 Play Console required)

進 Play Console → 選 app → 左側 sidebar 各個必填項依序處理。沒填完 Play 不讓你開放任何測試軌道。

### 1.1 App content(App 內容聲明)

Sidebar → **Policy and programs** → **App content**

| 項目 | 怎麼填 |
|---|---|
| Privacy policy | URL: `https://tarogram.heronhouse.me/privacy` |
| App access | 選 **All or some functionality is restricted**(我們有登入)→ 提供測試帳號(Gmail + Google OAuth 即可) |
| Ads | **No, my app doesn't contain ads** |
| Content rating | 跑問卷,占卜 / 玄學內容大概落在 **Everyone** 或 **Teen**。誠實填,如果勾「mystical content」可能 Teen |
| Target audience | **13 and older**(占卜內容不適合兒童) |
| News app | **No** |
| COVID-19 contact tracing | **No** |
| Data safety | 見 §1.2 |
| Government apps | **No** |
| Financial features | **No**(我們不是金融、不放貸) |
| Health features | **No**(占卜不算 health,要小心不要勾 wellness) |
| Government identification | **No** |
| Actions on Google | **No** |

### 1.2 Data safety(資料收集聲明)

這支必填且要誠實,Play 政策爬蟲會比對你 app 行為。

**Data collected:**
| 類別 | 收集嗎 | 用途 |
|---|---|---|
| Personal info → Email address | ✓ | Account management |
| Personal info → User IDs | ✓ | Account management |
| Personal info → Name | ✓(如有) | Account management |
| App activity → App interactions | ✓ | Analytics |
| App activity → In-app search history | ✗ | — |
| App activity → Other user-generated content | ✓(問卜內容) | App functionality |
| Financial info → Purchase history | ✓ | Account management、Analytics |
| Device or other IDs | ✗(我們沒用 device fingerprint) | — |

**Data sharing:**
- 沒有跟第三方分享,選 **No**

**Security practices:**
- Data is encrypted in transit ✓(Vercel HTTPS)
- Users can request that data be deleted ✓(`/account` 有刪除帳號)

### 1.3 Store listing(商店頁面)

Sidebar → **Grow users** → **Store presence** → **Main store listing**

| 欄位 | 內容 |
|---|---|
| App name | `Tarogram 易問` |
| Short description (80 字) | 「AI 易經 × 塔羅占卜,3 千年古老智慧 × 現代科技,讓你問卜更深入」 |
| Full description (4000 字) | 從 `README.md` 改寫,4 段:1) 我們是什麼 2) 三大功能 3) 訂閱 / 加購方案 4) 隱私保證 |
| App icon | 512×512,從 `public/logo-512.png` |
| Feature graphic | 1024×500,要新做(可用 Canva / Figma) |
| Phone screenshots | 至少 2 張,建議 8 張,1080×1920 或 1080×2400 |
| Tablet screenshots | 可選(如果支援平板) |
| Video | 可選(YouTube link) |

四語版本(zh-TW / en / ja / ko)都要填,Play Console 介面右上角切換語系。

### 1.4 App category + tags

| 欄位 | 值 |
|---|---|
| App category | Lifestyle |
| Tags | Astrology, Divination, Tarot |

---

## 2. In-app products(consumable credit packs)

Sidebar → **Monetize** → **Products** → **In-app products** → **Create product**

對 4 個 pack 各建一個。**Product ID 設定後不能改**,務必跟 `lib/billing/playSkus.ts` 的 `CREDIT_PACK_SKUS` 一字不差。

### 2.1 pack_100_starter(新手限定)

| 欄位 | 值 |
|---|---|
| Product ID | `orc.credits.pack100starter` |
| Name (English) | Tarogram 130 Credits Starter |
| Name (繁中) | 易問 130 點(新手限定) |
| Description (English) | One-time starter pack: 100 credits + 30 bonus. Limited to first purchase. |
| Description (繁中) | 一次性新手包:獲得 100 點 + 30 點贈點。限首次購買。 |
| Status | **Active** |

**Pricing:**
- Default price: `TWD 60`
- 點 **Set prices for other countries** → 用 template 或手動:
  - US: `$1.99`
  - JP: `¥250`
  - KR: `₩2,500`
  - SG: `S$2.49`
  - 其他 EU / UK / AU 用 Auto-conversion 從 TWD 60

> **重要:**Play 後台沒有「限首購」設定,首購限制在 server 端 `verify-purchase` 已實作(query `credit_transactions` 看是否有先前付費紀錄)。所以 Play 端就放著當一般 consumable,違規時 server 回 `403 first_time_only` + 不 acknowledge / 不 consume,3 天後 Google 自動退款。

### 2.2 pack_200

| 欄位 | 值 |
|---|---|
| Product ID | `orc.credits.pack200v2` ⚠️ **v2** |
| Name | 易問 200 點 |
| Description | 加購包:獲得 200 點數,單價 NT$0.60 / 點 |
| Default price | `TWD 120` (US: `$3.99`) |
| Status | Active |

> ⚠️ **為什麼是 v2** — 原本 SKU `orc.credits.pack200` 在 Play Console 被誤刪過,Google 政策「已刪除的 Product ID 永久保留、不能再用」(同 app 同開發者也擋,客服救不回),所以重發成 v2。日後若再誤刪要繼續 v3、v4。`lib/billing/playSkus.ts` 第 33 行 `pack_200` 對應的 SKU 就是 `orc.credits.pack200v2`。

### 2.3 pack_500(主推)

| 欄位 | 值 |
|---|---|
| Product ID | `orc.credits.pack500` |
| Name | 易問 550 點(最划算) |
| Description | 加購包:500 點 + 50 點贈點,單價 NT$0.436 / 點,比基礎包省 27% |
| Default price | `TWD 240` (US: `$7.99`) |
| Status | Active |

### 2.4 pack_1200

| 欄位 | 值 |
|---|---|
| Product ID | `orc.credits.pack1200` |
| Name | 易問 1400 點 |
| Description | 加購包:1200 點 + 200 點贈點,大量問卜首選 |
| Default price | `TWD 480` (US: `$15.99`) |
| Status | Active |

### 2.5 一致性檢查

建完 4 個 product 後,跟 code 對一遍:

```bash
grep "orc.credits" lib/billing/playSkus.ts
```

應該看到 4 行字串,跟 Play Console 上的 Product ID **完全一致**。錯一個字母都會在 Digital Goods API `getDetails([...])` 抓不到、UI 拿不到在地化價格。

---

## 3. Subscriptions(月 / 年訂閱)

Sidebar → **Monetize** → **Products** → **Subscriptions** → **Create subscription**

Play 的 subscription 結構是兩層:
- **Subscription product** = 上層概念(「月會員」這件事)
- **Base plan** = 真正可購買的方案(月扣 NT$150 自動續扣)

我們程式碼裡 `SUBSCRIPTION_SKUS` 用的 SKU 是 **subscription product ID**;base plan ID 我們約定為 `{planId}-auto`(`monthly-auto` / `yearly-auto`)。

### 3.1 月訂閱

**Subscription product:**

| 欄位 | 值 |
|---|---|
| Product ID | `orc.subscription.monthly` |
| Name | 易問月會員 |
| Benefits | 1. 每月補 600 點<br>2. 完整占卜紀錄<br>3. 無浮水印分享<br>4. 詳細爻辭分析<br>5. 開運物品 7 折(各 30 字內) |

**Base plan:**

| 欄位 | 值 |
|---|---|
| Base plan ID | `monthly-auto` |
| Type | **Auto-renewing** |
| Billing period | Monthly (P1M) |
| Default price | `TWD 150` (US: `$4.99`) |
| Grace period | 7 天(Google 預設,卡費刷不過時) |
| Account hold | 30 天(Google 預設) |
| Resubscribe | 啟用(讓退訂使用者重訂閱) |
| Free trial / intro offer | 暫不設定(可日後再加 7-day free trial 做 conversion experiment) |
| Status | Active |

### 3.2 年訂閱

**Subscription product:**

| 欄位 | 值 |
|---|---|
| Product ID | `orc.subscription.yearly` |
| Name | 易問年會員 |
| Benefits | 同月會員 + 「相當於每月 NT$120,省 20%」 |

**Base plan:**

| 欄位 | 值 |
|---|---|
| Base plan ID | `yearly-auto` |
| Type | **Auto-renewing** |
| Billing period | Yearly (P1Y) |
| Default price | `TWD 1440` (US: `$49.99`) |
| Status | Active |

### 3.3 取消政策(Play 必填)

Play Console → Monetize → **Subscription cancellation policy**

填(中英):
> 訂閱可隨時在 Google Play 帳號設定中取消,取消後仍可使用至當期結束,期滿後自動降回免費版。
>
> Subscriptions can be canceled anytime via Google Play account settings. Access continues until the end of the current billing period, then reverts to the free tier.

### 3.4 一致性檢查

```bash
grep "orc.subscription" lib/billing/playSkus.ts
```

兩行 SKU 字串 + 兩個 base plan ID(`monthly-auto` / `yearly-auto`)都跟 Play Console 對齊。

---

## 4. GCP Service Account(verify-purchase 後端驗證用)

`/api/billing/play/verify-purchase` 透過 `googleapis` SDK 呼叫 **Google Play Android Developer API**,需要 service account credentials。

### 4.1 建 GCP 專案

1. https://console.cloud.google.com → 上方專案下拉 → **New project**
2. Project name: `oracle-iching-billing`(或任意辨識名)
3. Organization: 看你 GCP 是否有 organization,個人帳號通常是 No organization
4. Create → 等 10 秒切過去

### 4.2 啟用 Android Publisher API

1. 該專案 → 左側 menu → **APIs & Services** → **Library**
2. 搜尋 **Google Play Android Developer API**
3. **Enable**

### 4.3 建 service account + 下載 JSON

1. **APIs & Services** → **Credentials** → **Create credentials** → **Service account**
2. Service account name: `oracle-play-billing`
3. Service account ID: 自動產生(`oracle-play-billing@<project-id>.iam.gserviceaccount.com`)
4. 不指派 GCP role(Play Console 那邊另外給)→ Done
5. 該 service account → **Keys** → **Add key** → **Create new key** → **JSON** → 下載 `.json`

> ⚠️ 這份 JSON 是 production secret。**不要 commit、不要傳訊息、不要 email**。下面只塞進 Vercel env var。

### 4.4 Play Console 連結 GCP 專案

1. Play Console → **Setup** → **API access**
2. 第一次進會問「Link an existing Google Cloud project」→ 選剛建的 `oracle-iching-billing` → **Link**
3. 連結後等 1-5 分鐘讓 Google 同步

### 4.5 給 service account Play Console 權限

1. Play Console → **Users and permissions** → **Invite new user**
2. Email: 剛剛 service account 的 email(`oracle-play-billing@<project-id>.iam.gserviceaccount.com`)
3. App permissions → 加上 Tarogram 易問
4. Account permissions → 至少勾:
   - **View app information and download bulk reports**
   - **View financial data, orders, and cancellation survey responses**
   - **Manage orders and subscriptions**
5. Send invitation(service account 不會真的收 email,但 Play Console 立即生效)

### 4.6 把 JSON 塞進 Vercel env

1. Vercel Dashboard → 該專案 → **Settings** → **Environment Variables**
2. 新增:
   - Key: `GCP_SERVICE_ACCOUNT_JSON`
   - Value: 把 JSON 檔內容**全部貼進去**(含換行;Vercel 會自動處理 `\n`)
   - Environments: Production + Preview(Development 不需要)
3. Save → 觸發一次 redeploy(Settings → Deployments → 任一 deployment → Redeploy)

### 4.7 驗證 env 有讀到

部署完打:

```bash
curl -X POST https://tarogram.heronhouse.me/api/billing/play/verify-purchase \
  -H "Content-Type: application/json" \
  -d '{"sku": "test", "purchaseToken": "test"}'
```

預期回應:
- `401 unauthorized`(未登入)— ✓ 代表程式有跑到
- 如果回 `500 server_misconfigured` 帶 `[play/verify] GCP_SERVICE_ACCOUNT_JSON ...` — env 沒讀到,檢查 Vercel 設定

> 注意:這支 API 必須登入,curl 直接打會擋在 auth 那關。完整測試走真機 Play Billing flow(§7)。

---

## 5. Real-time Developer Notifications(訂閱續期 / 取消 webhook)

訂閱用戶續扣成功、取消、退款這些事件,Google **不會** 推到 verify-purchase(那個是 client 觸發購買時打的),而是透過 Pub/Sub 推到 RTDN webhook。我們的 endpoint 是 `/api/billing/play/rtdn-webhook`。

沒設好的後果:訂閱用戶取消後我們不知道,下個月還是讓他用 premium 權益。

### 5.1 建 Pub/Sub topic

1. GCP Console → **Pub/Sub** → **Topics** → **Create topic**
2. Topic ID: `play-rtdn`
3. Add a default subscription:**取消勾選**(我們等下手動建 push subscription)
4. Encryption: Google-managed encryption key
5. Create

### 5.2 給 Google Play 系統帳號 Publisher 權限

Google 內部用一個固定的 service account 把訊息推進你的 topic,要先授權給它。

1. 剛建的 topic → **Permissions** tab → **Add principal**
2. Principal: `google-play-developer-notifications@system.gserviceaccount.com`(這是 Google 全球固定的 service account,直接複製貼上)
3. Role: **Pub/Sub Publisher**
4. Save

### 5.3 建 push subscription

讓 Pub/Sub 把訊息推到我們的 webhook endpoint。

1. **Pub/Sub** → **Subscriptions** → **Create subscription**
2. Subscription ID: `play-rtdn-push-tarogram`
3. Select a Cloud Pub/Sub topic: 選剛建的 `play-rtdn`
4. **Delivery type: Push**
5. Endpoint URL: `https://tarogram.heronhouse.me/api/billing/play/rtdn-webhook`
6. **Enable authentication: ✓**
   - Service account: 選 §4.3 建的 `oracle-play-billing`
   - Audience: 留空白
7. Subscription expiration: Never expire(預設 31 天會把整個 subscription 砍掉,改 Never)
8. Acknowledgement deadline: 10 seconds
9. Message retention: 7 days(預設)
10. Dead letter topic: 可選,進階用法,先不設
11. Create

### 5.4 Play Console 設定 RTDN topic

最後一步,告訴 Play Console「我的 RTDN topic 在這」。

1. Play Console → **Monetize** → **Monetization setup**
2. Real-time developer notifications 區塊
3. Topic name: `projects/<your-gcp-project-id>/topics/play-rtdn`
   - 完整格式範例:`projects/oracle-iching-billing/topics/play-rtdn`
4. **Send test notification** → 應該看到 ✓ green
5. Save

如果 test 失敗,常見原因:
- Topic 路徑打錯
- §5.2 沒給 `google-play-developer-notifications@system.gserviceaccount.com` Publisher
- Topic 在錯的 GCP 專案(Play Console 連結的 GCP 專案要跟 topic 同一個)

### 5.5 觀察 webhook 真的有收到

訂閱用戶取消 / 續期時,Vercel logs 應該看到:
```
[rtdn] notification received: type=2 (RENEWED), sku=orc.subscription.monthly
```

沒收到的話,GCP Console → Pub/Sub → Subscriptions → `play-rtdn-push-tarogram` → **Metrics** tab 看 push delivery 是否有錯。

---

## 6. License testing accounts(測試帳號免費購買)

讓你能在內部測試時不用真的刷卡 $480 買 pack_1200。

1. Play Console → **Setup** → **License testing**
2. **Email addresses**: 加你自己的 Gmail(支援多個,逗號分隔)
3. License response: **RESPOND_NORMALLY**(正常購買流程,只是不扣錢)
4. Save changes

> 注意:這些測試帳號**也必須**是 Internal testing 軌道的 tester(§7.1),兩個都要加才有效。

---

## 7. Internal testing + 真機驗證 5 條 case

### 7.1 加 testers 到 Internal testing 軌道

1. Play Console → **Testing** → **Internal testing**
2. **Testers** tab → **Create email list** → 加你自己跟需要測試的人
3. 取個名字 e.g. "Tarogram Internal Testers"
4. Save changes
5. **Copy opt-in link** → 用你的測試 Gmail 在手機 Chrome 開,點 **Become a tester**

之後該帳號在 Play Store 搜尋 `Tarogram` 就會看到(可能要 2-5 分鐘 propagate)。

### 7.2 5 條測試 case

每一條都用**不同帳號**,或同一個帳號做完後重置(刪 supabase profile + credit_transactions)。

#### Case 1:全新帳號買 starter pack

1. 全新 Gmail 帳號 → 進 app → 註冊 → /account/credits
2. 應該看到 4 個 pack,starter 卡帶橘色 "新手限定·一次" badge
3. 點 starter [購買]
4. 跳 Google 內建付款 sheet → 確認 NT$60 → 完成
5. **預期**:
   - Toast 顯示「購買成功!點數已補入帳號」
   - 餘額 +130 點
   - Supabase `credit_transactions` 新增 1 筆 `reason='play_billing_purchase'`、`amount=130`
   - Supabase `play_purchases` 新增 1 筆 `status='granted'`

#### Case 2:同帳號二次買 starter(verify 應拒)

1. 接 Case 1 → 再點 starter [購買]
2. 跳付款 sheet → 完成
3. **預期**:
   - Toast 顯示錯誤「購買失敗:first_time_only ...」
   - 餘額**不變**
   - `play_purchases` 新增 1 筆 `status='failed'`、`status_reason='first_time_only_violation'`
   - 3 天內收到 Google 自動退款 email

#### Case 3:已有 ecpay_purchase 的帳號買 starter

1. 用網頁版(`oracle.heronhouse.me`)買過 pack_200 的帳號(ECPay 付款完成)
2. 用同帳號在 TWA 開 /account/credits
3. **預期**:starter 卡**不顯示**(`has-purchased` API 回 `hasPurchased=true`,UI filter 擋住)
4. (進階)抓 packet 強制送 `verify-purchase` 帶 starter SKU → server 應該回 `403 first_time_only`

#### Case 4:訂閱戶買 starter

1. 已訂閱月會員的帳號(有 `subscription_refill` 紀錄)
2. 進 /account/credits
3. **預期**:starter 卡不顯示(`subscription_refill` 也算「已付費紀錄」)

#### Case 5:Web 端 ECPay 路徑(回歸測試)

1. 桌機瀏覽器開 `https://tarogram.heronhouse.me/account/credits`
2. 全新帳號 → starter 卡可見、點 [購買]
3. **預期**:跳到 ECPay hub checkout,**不是** Play Billing
4. 付款完成 → `credit_transactions` 補 130 點、reason=`ecpay_purchase`

### 7.3 訂閱測試 case(monthly + cancel + refund)

#### Case 6:全新帳號訂閱月會員

1. 全新帳號 → /account/upgrade → 點月會員 [選擇此方案]
2. 跳 Play Billing → 完成
3. **預期**:
   - profiles 表 `subscription_status='active'`、`subscription_plan='monthly'`、`subscription_expires_at` ≈ 30 天後
   - subscriptions 表新增 1 筆 provider='google_play'
   - 餘額 +600 點(訂閱方案的 monthly refill)

#### Case 7:訂閱用戶取消

1. Case 6 的帳號 → 手機 Play Store → 訂閱管理 → 取消
2. **預期**:
   - RTDN webhook 收到 `notificationType=3 (CANCELED)`
   - profiles 表 `subscription_status='canceled'`,但 `subscription_expires_at` **不變**(讓使用者用到期限結束)
   - 期間內 `has_active_subscription()` 仍回 true

---

## 8. 上 production(從 internal → closed → open → production)

當 §7 五條 case 都跑過 + 觀察 1-2 週沒大 bug,可以階段性放量。

```
Internal testing      ← 自己 + 少量信任的 tester(現在這裡)
       ↓
Closed testing        ← 加入 100-200 個 beta 使用者
       ↓
Open testing          ← Play Store 上「Early access」標籤公開
       ↓
Production            ← 正式上架
```

每階段都要重新 review(Internal 1-2 天、Closed 3-5 天、Open / Production 7-14 天)。

第一次 production review 特別嚴格,Google 會檢查:
- Privacy Policy 內容
- Data safety declaration vs 實際 app 行為一致性
- Content rating 是否誠實
- 訂閱取消政策是否清楚

被退件常見原因:
- Store listing 截圖跟實際 app 不符
- Account deletion 沒做(我們有,/account 頁)
- 訂閱 UI 沒清楚顯示 auto-renewal 跟價格

---

## 9. 故障排除(常見問題)

### Q: TWA 內 starter 卡點 [購買] 跳「商品不存在」
A: §2.1 的 product ID 沒建、或 status 不是 Active、或 product ID 拼錯。對照 `lib/billing/playSkus.ts` 第 27 行字面。

### Q: 購買完 verify-purchase 回 `server_misconfigured`
A: §4.6 `GCP_SERVICE_ACCOUNT_JSON` 沒設或 JSON 格式爛掉。Vercel logs 會印「缺少 GCP_SERVICE_ACCOUNT_JSON env var」或 JSON parse 錯誤。

### Q: 購買完 verify-purchase 回 `google_verify_failed`
可能原因:
1. §4.5 service account 沒邀請進 Play Console、或權限不夠
2. §4.4 Play Console 沒連結 GCP 專案
3. Product ID 不一致(Play Console 上 vs `playSkus.ts` 上)
4. Service account 剛建立、權限還沒同步(等 5 分鐘再試)

### Q: RTDN webhook 沒收到事件
A: §5.4 test notification 先確認能通,通過後再檢查我們 webhook 是否回 200。Pub/Sub push 沒收到 200 會 retry,GCP Console Subscriptions → metrics 看 push errors。

### Q: 訂閱用戶 expires_at 沒更新
A: RTDN webhook 收到 `RENEWED` 應該觸發 `refreshSubscriptionFromGoogle`。檢查 Vercel logs 有沒有錯。

---

## 10. 一致性檢查 checklist(設定完跑一遍)

```bash
# 本地確認 SKU IDs 對齊(僅檢查字串,不需 Play 後台連線)
grep -E "orc\.(credits|subscription)" lib/billing/playSkus.ts

# 確認 verify-purchase 有 firstTimeOnly 邏輯
grep "firstTimeOnly" app/api/billing/play/verify-purchase/route.ts

# 確認 package name 全 repo 一致
grep -r "me\.heronhouse" --include="*.ts" --include="*.json" --include="*.md"
# 期待全部 me.heronhouse.tarogram、0 個 me.heronhouse.oracle
```

設定完 Play Console / GCP 後在 Vercel 確認 env vars 有:

```
GCP_SERVICE_ACCOUNT_JSON     ✓ (整段 JSON)
NEXT_PUBLIC_SUPABASE_URL     ✓
SUPABASE_SERVICE_ROLE_KEY    ✓
HUB_PUBLIC_URL               ✓ (ECPay 用)
HUB_INTERNAL_API_TOKEN       ✓ (ECPay 用)
```

---

> 寫於 2026-05,對應 `lib/billing/playSkus.ts` package name `me.heronhouse.tarogram`、
> 4 個 credit pack + 2 個 subscription 配置。若日後改 SKU、Product ID、新增方案,
> 這支文件跟 `lib/billing/playSkus.ts` 兩邊都要動。
