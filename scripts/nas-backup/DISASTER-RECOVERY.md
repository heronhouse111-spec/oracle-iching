# oracle-iching 災難復原手冊

最後更新:2026-04-24(備份系統全部上線日)

這份文件說明 oracle-iching 專案**所有重要資料的存放位置**、**備份狀況**,以及**各種壞掉情境的還原步驟**。出事時先看這份,照著做。

---

## 第一部分:完整資料清單

| # | 資料類型 | 正本位置 | 備份位置 | 備份份數 |
|---|---|---|---|---|
| A | Postgres 資料庫 | Supabase 雲端 | ① Supabase 內建 ② NAS `/volume2/backups/supabase/` | 3 份 |
| B | Supabase Storage 檔案 | Supabase 雲端(目前 0 bucket) | NAS `/volume2/backups/supabase-storage/current/` | 2 份 |
| C | App 程式碼 | GitHub private repo | ① 本機 `C:\Users\Eliot\oracle-iching` ② Vercel build cache ③ **NAS git mirror `/volume2/backups/github/oracle-iching.git`** | 4 份 |
| D | 靜態資源 (logo, 卡片圖) | App 的 `public/` 資料夾 | 跟隨 App 程式碼 | 4 份 |
| E | Vercel 環境變數 | Vercel Dashboard | **NAS `/volume2/backups/vercel/vercel-env-*.json`** | 2 份 |
| F | Supabase 專案設定(非資料庫) | Supabase Dashboard | **NAS `/volume2/backups/supabase-config/config-*/`** | 2 份 |
| G | Google Play 上架物 | Google Play Console + 本機 keystore | ⚠️ **沒有自動備份**(手動存 1Password) | 看你 |
| H | 自訂 domain DNS | Domain 供應商(GoDaddy) | ⚠️ **沒有自動備份**(手動存) | 1 份 |
| I | 備份系統本身的 3 個 token | NAS `.env` 檔 | ⚠️ **沒有自動備份**(手動存 1Password) | 1 份 |

---

### A. Postgres 資料庫(最關鍵)

**包含:** 使用者帳號、密碼 hash、email、所有占卜紀錄、對話紀錄 (`chat_messages`)、follow-ups、訂閱狀態、Storage metadata、RLS policies、資料表結構、supabase_functions 設定

**Supabase 專案資訊:**
- Project ref: `xpijubxjokrpysrpjrct`
- Region: `aws-1-ap-southeast-1`(新加坡)
- Session pooler endpoint: `aws-1-ap-southeast-1.pooler.supabase.com:5432`
- Postgres 版本:17.x

**備份策略:**
- **NAS 備份**:每天凌晨 3 點由 Task Scheduler 執行 `backup-all.sh`,存成 `.dump` 檔(Postgres custom format,含壓縮),保留 30 天滾動
- **Supabase 內建**:免費方案有 7 天 daily backup(在 Supabase Dashboard 可以直接還原)
- **備份範圍**:`public`、`auth`、`storage`、`supabase_functions` 四個 schema
- **檔案命名**:`oracle-iching-YYYYMMDD-HHMMSS.dump`

---

### B. Supabase Storage(檔案)

**目前狀態:🟢 空的(沒有任何 bucket)**

備份機制已就位:
- `backup-storage.sh` 用 rclone 把所有 bucket 的檔案同步到 NAS
- 未來只要你在 Supabase Dashboard 建 bucket 上傳檔案,排程自動就會備起來
- **不用改任何設定**

---

### C. App 程式碼

**正本:** GitHub private repo(`heronhouse111-spec/oracle-iching`)

**備份(4 份):**
1. GitHub 雲端(origin)
2. 本機 `C:\Users\Eliot\oracle-iching`(你的工作副本)
3. Vercel 上最後一次 build 的程式碼
4. **NAS git mirror** `/volume2/backups/github/oracle-iching.git`(含所有分支、歷史、tags)

這部分幾乎不可能一次全部消失。

---

### E. Vercel 環境變數(新增備份)

**包含:** `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `OPENAI_API_KEY` / 綠界金流 keys / 其他第三方 token

**NAS 備份位置:** `/volume2/backups/vercel/vercel-env-YYYYMMDD-HHMMSS.json`

**格式:** JSON,含每個變數的 key + decrypted value + target(production/preview/development)

**保留:** 30 天滾動

---

### F. Supabase 專案設定(新增備份)

**包含:** project metadata、api-keys、auth-config、database-config、secrets、functions list、storage-buckets list、pooler-config、network-restrictions、ssl-enforcement

**NAS 備份位置:** `/volume2/backups/supabase-config/config-YYYYMMDD-HHMMSS/`

**格式:** 多個 JSON 檔,每個設定一個檔

**保留:** 30 天滾動

**重建 Supabase 專案時可以從這些 JSON 撈出 redirect URLs、email templates、OAuth provider 設定等,節省大量手動設定時間。**

---

### G-I. ⚠️ 沒有自動備份的重要資料

這些**必須手動照顧**(強烈建議在 1Password / Bitwarden 存一份):

1. **Google Play 相關**
   - App signing key(通常 Google 託管,但如果你自己保管 keystore,keystore + 密碼要備份!keystore 遺失 = 永遠沒辦法發新版)
   - AAB bundle 檔(Play Console 會保留,但本機也建議留一份)
   - Play Console 帳號登入資訊

2. **Domain DNS**(heronhouse.co 或其他自訂網域)
   - A / CNAME records
   - `.well-known/assetlinks.json`(TWA 需要)
   - GoDaddy 登入資訊

3. **備份系統本身的 3 個 token**(NAS `.env` 裡的):
   - `GITHUB_TOKEN`(GitHub PAT)
   - `VERCEL_TOKEN`
   - `SUPABASE_MANAGEMENT_TOKEN`
   - `SUPABASE_S3_ACCESS_KEY` / `SUPABASE_S3_SECRET_KEY`
   - `SUPABASE_DB_URL`(含 DB 密碼)
   
   這些 token 都只有 NAS 上一份。如果 NAS 掛,重建備份系統時要從 Dashboards 重新產新的,原本的 token 沒 access 就換掉即可。

---

## 第二部分:還原情境劇本

### 情境 1:某些資料不小心被刪除/改壞(最常見)

**症狀:** 網站還開得了,但某些功能壞了、某些資料不見、table 被 truncate 等

**復原等級:** 🟢 簡單(10-30 分鐘)

**步驟:**

1. **先不要動正式站**。評估災情時,正式站可能還在持續接受新請求,直接 restore 會覆蓋新資料。
2. 去 [Supabase Dashboard](https://supabase.com/dashboard) → **建一個新的臨時專案**(命名 `oracle-iching-recovery`)
3. 取得臨時專案的 Session pooler 連線字串
4. SSH 進 NAS,把最近的備份還原到臨時專案:
   ```bash
   ssh eliotyang@lovecostco.synology.me
   cd /volume2/scripts/nas-backup
   ls -t /volume2/backups/supabase/ | head -5   # 看最近的備份
   ./restore-supabase.sh /volume2/backups/supabase/oracle-iching-最近一份.dump "postgresql://postgres.臨時專案REF:密碼@aws-...:5432/postgres"
   ```
5. 用 Supabase Dashboard → SQL Editor 連到臨時專案,確認資料完整
6. 兩種選擇:
   - **選 A(低風險):** 寫 SQL 從臨時專案把遺失的資料撈出來 INSERT 回正式站
   - **選 B(簡單粗暴):** 把 Vercel 環境變數指到臨時專案(等同切換到新資料庫),原本正式站保留作為參考

---

### 情境 2:整個 Supabase 專案消失(Supabase 帳號被停、專案被刪)

**復原等級:** 🟡 中等(1-3 小時)

**步驟:**

1. 註冊新的 Supabase 專案(可以同帳號或新帳號),選同 region(`ap-southeast-1`)
2. 去 Project Settings → Database 複製新專案的 Session pooler URL 和密碼
3. SSH 進 NAS 還原最近備份:
   ```bash
   cd /volume2/scripts/nas-backup
   ./restore-supabase.sh /volume2/backups/supabase/oracle-iching-最近一份.dump "postgresql://新URL..."
   ```
4. **⚠️ 設定重建**:參考 NAS 備份的 Supabase 設定 JSON 來重建:
   - 打開 `/volume2/backups/supabase-config/config-latest/auth-config.json`,把裡面的 site_url、redirect_urls、email templates 貼回 Supabase Dashboard → Authentication → URL Configuration
   - 打開 `api-keys.json`,記下新舊 API keys 對應關係(要用 Dashboard 產新的,這個 JSON 給你對照用)
   - 打開 `secrets.json`,重建 Auth Providers (Google/Apple OAuth) 的 client id 設定
5. 更新 Vercel 環境變數(參考 NAS 備份的 Vercel JSON):
   - 打開 `/volume2/backups/vercel/vercel-env-latest.json`,裡面有舊的所有環境變數值
   - `NEXT_PUBLIC_SUPABASE_URL` → 改成新 Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → 改成新 anon key
   - `SUPABASE_SERVICE_ROLE_KEY` → 改成新 service role key
   - 其他保持原樣
6. 更新 NAS 的 `.env`(`SUPABASE_DB_URL` 和 S3 keys 改成新專案的)
7. Vercel 上 redeploy(環境變數改完必須 redeploy 才生效)
8. 驗證網站能連、能登入、歷史資料還在

---

### 情境 3:Vercel 網站掛掉 / 被刪除(資料庫沒事)

**復原等級:** 🟢 簡單(30 分鐘)

**步驟:**

1. 新開一個 Vercel 帳號(或進原帳號建新專案)
2. **Import from GitHub** → 選 oracle-iching repo
3. 照原本的 Framework Preset (Next.js) 設定
4. **用 NAS 備份還原環境變數**:
   ```bash
   # 在電腦查看最新的 Vercel env 備份內容
   ssh eliotyang@lovecostco.synology.me "cat /volume2/backups/vercel/vercel-env-latest.json" | jq '.envs[] | {key, value}'
   ```
   把每個 key/value 手動複製貼到 Vercel Dashboard → Settings → Environment Variables
5. Deploy
6. 設定自訂 domain(如果有),更新 DNS 到新的 Vercel URL
7. 檢查 Supabase Auth → URL Configuration 的 redirect 是不是新 URL

---

### 情境 4:本機電腦掛了 / 沒 access 權限

**復原等級:** 🟢 簡單(1 小時)

所有資料都在雲端 + NAS,重灌電腦後:

1. 裝 Node.js、git、VSCode
2. `git clone git@github.com:heronhouse111-spec/oracle-iching.git`
3. 從 1Password / NAS 備份還原 `.env.local` 內容
4. `npm install && npm run dev` 本地跑起來
5. SSH key 要重新產生 + 加到 GitHub

NAS 的 backup 腳本:
1. 新電腦重新 SSH 進 NAS 就能繼續用(`ssh eliotyang@lovecostco.synology.me`)
2. 腳本本身都在 `/volume2/scripts/nas-backup/`,沒掉

---

### 情境 5:NAS 掛了 / 被偷 / 火災(⚠️ 最危險)

**復原等級:** 🔴 這是真正的測試

**影響:** 30 天的 NAS 備份**全部消失**。

**尚能存活的:**
- Supabase 雲端上的資料庫(正本還在)
- Supabase 內建的 7 天 daily backup
- GitHub 上的程式碼
- Vercel 上的 app + 環境變數(Vercel Dashboard 還能登入)
- Supabase Dashboard(還能登入,設定都在)

**不能還原的:**
- 超過 7 天的歷史資料(如果同時 Supabase 也出事的話)
- 備份系統本身要重建(但腳本在 GitHub repo 的 `scripts/nas-backup/` 裡,照 README 重新裝一次)

**預防對策(強烈建議):**

用 **Synology Cloud Sync** 套件把 `/volume2/backups/` 同步到某個雲端,形成 3-2-1 備份(3 份、2 種媒介、1 份異地)。推薦:

- **Backblaze B2**:$0.006/GB/月,你的備份一個月大概 <$0.10
- **Cloudflare R2**:免費 10GB + 流量免費
- **iDrive e2**:$0.004/GB/月

設定步驟:
1. DSM → 套件中心 → 安裝 **Cloud Sync**
2. 新增連線 → 選 S3 相容服務(B2 / R2 / iDrive)
3. 來源資料夾:`/volume2/backups/`
4. 同步方向:**單向上傳**(NAS → 雲端,不讓雲端覆蓋 NAS)
5. 排程:連續同步(有變就傳)

這樣即使整個 NAS 爆炸,你還有雲端那份。

---

### 情境 6:備份系統本身壞掉(腳本跑不動 / 某個 token 過期)

**症狀:** 每天 3am 收到錯誤 email / 檢查 log 看到特定備份失敗

**復原等級:** 🟢 簡單(10-30 分鐘)

**步驟:**

1. SSH 進 NAS,看 log 判斷哪一支失敗:
   ```bash
   tail -100 /volume2/backups/supabase/backup.log
   ```
2. 根據錯誤訊息對應處理:

| 錯誤 | 原因 | 解法 |
|---|---|---|
| `password authentication failed` | Supabase DB 密碼改了 | 更新 `.env` 的 `SUPABASE_DB_URL` |
| `InvalidAccessKeyId` / `SignatureDoesNotMatch` | Supabase S3 key 失效 | Dashboard 重建,更新 `.env` |
| `Authentication failed` (GitHub) | GitHub PAT 過期或權限改 | 重建 PAT,更新 `.env` 的 `GITHUB_TOKEN` |
| `HTTP 401/403` (Vercel) | Vercel token 過期或權限改 | 重建 token,更新 `.env` 的 `VERCEL_TOKEN` |
| `HTTP 401` (Supabase Management) | Management token 失效 | 重建 token,更新 `.env` |
| `server version mismatch` | Supabase 升級了 Postgres | `.env` 的 `PG_IMAGE` 改成更新的版本(例如 `postgres:18`) |
| `Repository not found` | repo 移動或改名 | 更新 `.env` 的 `GITHUB_REPO` |

3. 改完 `.env` 後手動跑一次驗證:
   ```bash
   sudo /volume2/scripts/nas-backup/backup-all.sh
   ```

---

## 第三部分:日常維護 checklist

### 每月檢查(5 分鐘)

- [ ] SSH 進 NAS,`ls /volume2/backups/supabase/*.dump | wc -l` 確認檔案數接近 30
- [ ] `tail -100 /volume2/backups/supabase/backup.log` 看有沒有錯誤
- [ ] `du -sh /volume2/backups/` 看佔用空間是否合理(預期 <2GB)
- [ ] 檢查 email 有沒有收到備份失敗通知
- [ ] 去 Supabase Dashboard 看 database backup 頁面,確認自動備份正常

### 每季測試還原(30 分鐘,半年一次也可以)

真正的備份不是備了多少,是**能不能還原**。建議每 3-6 個月做一次:

1. 建 Supabase 臨時專案
2. 挑最近一份 `.dump` 用 `restore-supabase.sh` 還原
3. 登入臨時專案的 Dashboard,查幾筆 divination 資料看內容完整
4. 確認 `auth.users` 有資料,筆數合理
5. 測試完刪除臨時專案(Supabase 免費方案會自動 pause)

如果還原失敗,代表備份流程有問題,要立刻排查。備了 30 天但不能還原的備份等於沒備。

### 每年檢查(token 有效性)

- [ ] GitHub PAT 快到期前會收 email,提前重建
- [ ] Vercel token 同上
- [ ] Supabase Management token 同上
- [ ] 如果收到 `.env` 需要更新某 token,記得也要 `sed -i 's/\r$//' .env` 修一次換行

---

## 第四部分:核心指令速查

### 查看最近備份
```bash
ssh eliotyang@lovecostco.synology.me
ls -lth /volume2/backups/supabase/ | head -10
ls -lth /volume2/backups/vercel/ | head
ls -lth /volume2/backups/supabase-config/ | head
ls -lh /volume2/backups/github/
```

### 看 backup log(所有腳本共用同一個 log)
```bash
tail -100 /volume2/backups/supabase/backup.log
```

### 手動執行一次完整備份(測試用)
```bash
sudo /volume2/scripts/nas-backup/backup-all.sh
```

### 手動執行單一腳本
```bash
sudo /volume2/scripts/nas-backup/backup-supabase.sh         # 只備 Postgres
sudo /volume2/scripts/nas-backup/backup-storage.sh          # 只備 Storage
sudo /volume2/scripts/nas-backup/backup-github.sh           # 只備 GitHub
sudo /volume2/scripts/nas-backup/backup-vercel.sh           # 只備 Vercel env
sudo /volume2/scripts/nas-backup/backup-supabase-config.sh  # 只備 Supabase 設定
```

### 還原 Postgres 備份到指定資料庫
```bash
cd /volume2/scripts/nas-backup
./restore-supabase.sh <dump檔路徑> "postgresql://postgres.REF:PWD@HOST:5432/postgres"
```

### 看 Postgres 備份檔裡面有什麼資料表
```bash
sudo docker run --rm -v /volume2/backups/supabase:/b postgres:17 \
  pg_restore --list /b/oracle-iching-YYYYMMDD-HHMMSS.dump | less
```

### 解壓備份成單一 SQL 檔(如果要用文字編輯器看內容)
```bash
sudo docker run --rm -v /volume2/backups/supabase:/b postgres:17 \
  pg_restore --file=/b/dump.sql /b/oracle-iching-YYYYMMDD-HHMMSS.dump
```

### 查看 Vercel 環境變數備份內容
```bash
cat /volume2/backups/vercel/vercel-env-latest.json | jq '.envs[] | {key, value, target}'
```

### 從 GitHub mirror 還原 repo 到新位置
```bash
# 在某台新機器上
git clone /volume2/backups/github/oracle-iching.git ./oracle-iching
# 然後把 remote 改回 GitHub origin
cd oracle-iching
git remote set-url origin git@github.com:heronhouse111-spec/oracle-iching.git
```

### 查看 Supabase Dashboard 設定備份
```bash
ls /volume2/backups/supabase-config/config-latest/
cat /volume2/backups/supabase-config/config-latest/auth-config.json | jq
```

---

## 附錄:關鍵檔案位置

| 用途 | 絕對路徑 |
|---|---|
| 備份腳本(Postgres) | `/volume2/scripts/nas-backup/backup-supabase.sh` |
| 備份腳本(Storage) | `/volume2/scripts/nas-backup/backup-storage.sh` |
| 備份腳本(GitHub) | `/volume2/scripts/nas-backup/backup-github.sh` |
| 備份腳本(Vercel) | `/volume2/scripts/nas-backup/backup-vercel.sh` |
| 備份腳本(Supabase 設定) | `/volume2/scripts/nas-backup/backup-supabase-config.sh` |
| 一鍵全跑 | `/volume2/scripts/nas-backup/backup-all.sh` |
| 還原腳本 | `/volume2/scripts/nas-backup/restore-supabase.sh` |
| 設定檔(含所有 token/密碼) | `/volume2/scripts/nas-backup/.env`(chmod 600) |
| Postgres dump | `/volume2/backups/supabase/*.dump` |
| Storage 檔案 | `/volume2/backups/supabase-storage/current/` |
| GitHub mirror | `/volume2/backups/github/oracle-iching.git/` |
| Vercel env JSON | `/volume2/backups/vercel/vercel-env-*.json` |
| Supabase 設定 JSON | `/volume2/backups/supabase-config/config-*/` |
| 執行 log(共用) | `/volume2/backups/supabase/backup.log` |
| DSM 排程 | DSM 控制台 → 任務排程表 → `Supabase Daily Backup`(每天 03:00) |

---

## 緊急聯絡資訊

| 服務 | 登入入口 | 用途 |
|---|---|---|
| Supabase Dashboard | https://supabase.com/dashboard | 資料庫 / Auth / Storage |
| Vercel Dashboard | https://vercel.com/dashboard | 網站部署 / env vars |
| GitHub | https://github.com | 程式碼 repo |
| DSM (NAS) | https://lovecostco.synology.me:5001 | NAS 管理介面 |
| SSH to NAS | `ssh eliotyang@lovecostco.synology.me` | 執行腳本 / 看 log |
| Google Play Console | https://play.google.com/console | Android app 上架 |
| GoDaddy | https://sso.godaddy.com | Domain 管理 |

---

**記住:真正的備份不是備了多少,而是出事時能不能還原。每半年做一次還原測試,不要等到出事才發現備份壞了。**
