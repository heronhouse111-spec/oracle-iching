# 帳號合併設計文件（Account Merge Design）

狀態:**草案,待 heronhouse 拍板**(2026-06-09)
目的:讓同一個人不會因為用了不同登入方式(Google / Apple / Email)而變成兩個帳號、點數與訂閱被切開。

---

## 1. 背景與三種情境

使用者「分裂」成兩個帳號的根本原因:Supabase 預設把不同 OAuth 身分視為不同 user(除非 email 相同且已驗證會自動合併)。Apple 的「隱藏我的電子郵件」會給 `@privaterelay.appleid.com` 轉寄信箱,跟 Google 信箱不同 → 不會自動合併。

| 情境 | 解法 | 現況 |
|---|---|---|
| A. 兩個 provider 用**同一個已驗證 email** | Supabase **自動合併**成一個 user | ✅ 已生效 |
| B. 使用者**先登入**,再去綁定頁加綁另一個還沒用過的 provider | `linkIdentity`(`/account/linked` 綁定頁) | ✅ 已上線 |
| C. 兩個帳號**已經各自存在、各有點數/訂閱** | **本文件要設計的「合併流程」** | ❌ 尚未做 |

### 為什麼情境 C 不能用「連結」按鈕解決

`supabase.auth.linkIdentity()` 只能把一個**尚未被任何 user 使用**的身分,接到目前登入的帳號。如果該 Google 身分已經屬於另一個既有 user,Supabase 會回傳錯誤(identity already linked to another user)。所以「已用 Google 註冊+訂閱過」的使用者,無法靠連結按鈕把舊帳號吸過來——必須走伺服器端合併。

---

## 2. 合併流程(UX)

預設方向:**把「另一個帳號(來源)」合併進「目前登入的帳號(保留)」**。

1. 使用者已登入帳號 A(例如 iPhone 上用 Apple 登入)。
2. 進「帳號設定 → 合併其他帳號」。
3. 系統要求**證明你也擁有帳號 B**(來源帳號)——見第 3 節驗證方式。
4. 顯示預覽:B 帳號有多少點數、訂閱狀態、占卜紀錄筆數,將全部併入 A。明確告知**此動作不可復原**。
5. 使用者確認 → 後端執行合併交易(第 4 節)→ B 帳號標記為已合併並停用。
6. 完成後 A 帳號擁有合計點數、較長的訂閱效期、兩邊的紀錄;之後用 B 的 provider 登入也會導向 A。

---

## 3. 身分驗證(待決策 ①)

要避免有人把**別人的**帳號併走,必須驗證來源帳號 B 的所有權。兩個選項:

- **(建議)當場重新登入 B**:在合併頁觸發一次 B provider 的 OAuth(或 Email 連結),拿到 B 的有效 session/token,後端確認「發起者同時握有 A 與 B 的有效憑證」才執行。最安全。
- **Email 驗證連結**:寄一封確認信到 B 帳號的 email,點了才合併。對 Apple 隱藏信箱使用者較不可靠(信箱是轉寄的)。

---

## 4. 要搬移的資料 + 交易原子性

合併用**單一 Postgres function(SECURITY DEFINER)**包成一筆交易,全成功或全回滾,並寫稽核紀錄。以使用者為鍵、需要從 B 搬到 A 的資料表:

**點數/帳務**
- `profiles`:`credits_balance` 相加;`subscription_status` / `subscription_expires_at` 取「較有利」的一筆(見下);暱稱等以 A 為主。
- `credit_transactions`、`credit_grants`:把 `user_id` 從 B 改成 A(保留完整流水帳)。
- `subscriptions`:web 金流(LINE Pay / ECPay / 藍新)訂閱列改指到 A(見訂閱政策)。
- `play_purchases`:Google Play 購買紀錄改指 A。

**使用紀錄/內容**
- `divinations`(占卜紀錄)、`history_unlocks`、`user_collections`、`collection_milestones`、`daily_checkins`、`promo_code_redemptions`
- 音樂相關:`music_collections`、`music_plays`、`generated_music.creator_id`、`music_creator_follows`、`music_reports`

**衝突處理規則(草案)**
- 點數:直接相加。
- 訂閱效期:取兩者 `subscription_expires_at` 較晚者;狀態若任一為 active 則為 active。
- 每日簽到(`daily_checkins`):同一天兩邊都簽過要去重,連續天數取較佳。
- 收藏/里程碑:聯集去重。

**不搬移**:admin/CMS 類(`personas`、`blog_posts`、`announcements` 等的 `created_by`)與 `admin_audit_log`,那些不是一般使用者資產。

---

## 5. 訂閱政策(待決策 ②——風險最高)

訂閱的「續扣關係」分兩種:

- **Web 金流(LINE Pay / ECPay / 藍新)**:`subscriptions.provider_subscription_id` 是平台的定期扣款 ID,可隨列改 `user_id` 指到 A。**但若 A 與 B 都各有一份 active 訂閱 → 會變兩份同時扣款**,合併時必須擇一保留、另一份去金流平台取消(需要明確規則)。
- **Apple IAP / Google Play**:訂閱綁在**商店帳號**與原購買者,**無法用資料庫搬移**。實務做法是合併後在該裝置用「**還原購買(Restore Purchases)**」把權益重新掛到登入中的帳號;`profiles.subscription_status` 則照搬。

**已定案(2026-06-09)**:
1. A、B 同時有 active 訂閱時 → **由使用者在合併頁自己選要保留哪一份**;未被選中的那份要取消(呼叫對應金流 API 或引導使用者取消),避免雙重扣款。合併頁需清楚顯示兩份訂閱的方案與到期日供選擇。
2. 行動端 IAP(Apple / Google Play)訂閱 → **採「還原購買(Restore Purchases)」**:合併後在裝置上還原,把權益重新掛到保留帳號;不嘗試資料庫搬移。

---

## 6. 邊界情況與風險

- **不可逆**:合併後 B 停用。要不要保留 30 天「反悔期」?(建議:不可逆 + 完整稽核紀錄即可)
- **重複合併 / 併發**:function 內用鎖 + 狀態檢查,避免同時觸發兩次。
- **A=B**:同帳號不可合併自己(擋掉)。
- **資料量**:占卜/音樂紀錄多時,搬移要分批或在交易內一次 UPDATE(以本站規模一次交易應可)。
- **法遵**:合併屬於帳號層級變更,建議寄通知信給兩邊 email 留存證據。

---

## 7. 實作步驟(確認後才動工)

1. 寫 SQL migration:`merge_accounts(p_keep uuid, p_source uuid)` function + `account_merges` 稽核表。
2. 後端 API route:驗證雙方所有權 → 呼叫 function → 回結果。
3. 前端「合併其他帳號」頁:重新登入 B → 預覽 → 確認。
4. 訂閱衝突處理(依第 5 節決策)。
5. 測試:在 staging 用兩個測試帳號跑完整流程,驗證點數、訂閱、紀錄正確且不可重複領。
6. 上線 + 通知信。

---

## 8. 待你拍板的決策清單

- ① 驗證方式:**已定案 → 當場重新登入 B**(2026-06-09)
- ② 訂閱衝突:**已定案 → 由使用者自己選保留哪一份**,未選中的取消(2026-06-09)
- ② 行動端 IAP:**已定案 → 採「還原購買」**(2026-06-09)
- 反悔期:建議不需要(不可逆 + 稽核),未特別指定即採此預設
- 合併入口:`/account` 底下新增「合併其他帳號」(預設採此,如要改再說)

回覆這幾點後,我就照本文件實作。
