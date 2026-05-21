# Supabase → Synology NAS 每日備份

把 oracle-iching 的 Supabase 資料庫每天自動 dump 到你的 Synology NAS,保留 30 天,舊的自動刪除。

## 功能

- 每天凌晨自動跑 `pg_dump`(走 Synology Task Scheduler)
- 備份 `public` + `auth` + `storage` + `supabase_functions` 四個 schema(業務資料、使用者帳號、檔案 metadata、Edge Functions 設定都包進來)
- 使用 Postgres 原生 custom format(`.dump`),還原最乾淨
- 每次備份完會自動驗證檔案可讀,壞檔會被偵測出來
- 自動刪除超過 30 天的舊備份
- 完整 log 寫在 `backup.log`
- 附還原腳本 `restore-supabase.sh`,緊急時可以一鍵還原

## 一次性設定(照做一次就好)

### 步驟 1 — 在 Synology 安裝 Container Manager

腳本用 Docker 跑 `pg_dump`,不需要在 NAS 上裝 PostgreSQL client。

1. 開 DSM → **套件中心**
2. 搜尋 **Container Manager**(DSM 7.2+)或 **Docker**(DSM 7.1 以下)
3. 安裝

> DSM 6 或更舊版本也有 Docker 套件,但建議升級到 DSM 7 再做這件事。
> 非 Plus 系列(j / value 系列)某些型號可能不支援 Docker,請先在套件中心確認。

### 步驟 2 — 建立備份資料夾

用 DSM **File Station**:

1. 在 `volume1` 建一個 **backups** 共用資料夾(如果還沒有)
2. 在裡面建 **supabase** 子資料夾
3. 最終路徑會是 `/volume1/backups/supabase`

### 步驟 3 — 把這個專案放到 NAS

SSH 到 NAS(DSM → 控制台 → 終端機 → 啟用 SSH,用自己的 DSM 帳號登入):

```bash
# 建議放在 /volume1/scripts/ 底下
sudo mkdir -p /volume1/scripts
cd /volume1/scripts

# 只拉 scripts/nas-backup 目錄(或整個 repo clone 下來也可以)
git clone https://github.com/YOUR_USERNAME/oracle-iching.git
cd oracle-iching/scripts/nas-backup
```

如果不想裝 git,也可以把 `backup-supabase.sh`、`restore-supabase.sh`、`.env.example` 三個檔案直接用 File Station 拖到 NAS 的 `/volume1/scripts/nas-backup/`。

### 步驟 4 — 建立 `.env` 設定檔

```bash
cp .env.example .env
vi .env   # 或用 File Station 開啟編輯
```

必填項目:

**`SUPABASE_DB_URL`** — 從 Supabase Dashboard 取得:

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 進入 oracle-iching 專案
3. 左邊選單 **Project Settings** → **Database**
4. 往下找 **Connection string** 區塊
5. 切到 **URI** tab,選 **Session pooler**(不是 Transaction pooler!)
6. 複製出來的字串,把 `[YOUR-PASSWORD]` 換成你的資料庫密碼

> **為什麼要用 Session pooler 而不是 Transaction pooler?**
> `pg_dump` 需要建立 session 跑多次查詢,Transaction pooler(port 6543)不支援這種模式會直接斷線。Session pooler(port 5432)才能順利跑完。

**密碼有特殊字元的話要 URL encode**:
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`
- `#` → `%23`
- 空格 → `%20`

設定完後保護一下檔案權限(只讓自己讀):

```bash
chmod 600 .env
chmod +x backup-supabase.sh restore-supabase.sh
```

### 步驟 5 — 手動跑一次測試

```bash
./backup-supabase.sh
```

第一次會下載 Postgres Docker image(約 150 MB),之後就不用再下載。

成功的話會看到:
```
[2026-04-23 15:30:00] ===== 開始備份 oracle-iching =====
[2026-04-23 15:30:02] 執行 pg_dump (schemas: public,auth,storage,supabase_functions)...
[2026-04-23 15:30:15] 備份成功: oracle-iching-20260423-153000.dump (2.3M)
[2026-04-23 15:30:16] 驗證備份檔完整性...
[2026-04-23 15:30:17] 備份檔驗證通過
[2026-04-23 15:30:17] 清理 30 天前的舊備份...
[2026-04-23 15:30:17] 共刪除 0 個舊備份檔
[2026-04-23 15:30:17] 目前保留 1 個備份檔,總大小 2.3M
[2026-04-23 15:30:17] ===== 備份流程完成 =====
```

失敗的話看 `/volume1/backups/supabase/backup.log` 的錯誤訊息排除(常見問題見文末)。

### 步驟 6 — 排程每天自動跑(Synology Task Scheduler)

1. DSM → **控制台** → **任務排程**
2. **新增** → **排定的任務** → **使用者定義的指令碼**
3. **一般** tab:
   - 任務名稱:`Supabase Daily Backup`
   - 使用者:`root`(確保有權限跑 docker)
4. **排程** tab:
   - 日期:每天
   - 時間:`03:00`(或任何你覺得伺服器閒的時段)
5. **任務設定** tab:
   - 執行指令:
     ```bash
     /volume1/scripts/oracle-iching/scripts/nas-backup/backup-supabase.sh
     ```
     (路徑依照你實際擺放位置調整)
   - 勾 **通知詳細資料** → **透過電子郵件傳送執行詳細資料** → 輸入你的 email(建議勾「只有當指令碼異常終止時才傳送」,這樣平常不會被信灌爆)
6. 按 **確定**
7. 回任務清單,右鍵剛剛建立的任務 → **執行**,再檢查 `backup.log` 確認排程模式下也能跑

## 日常使用

不用做任何事。每天早上 3 點會自動跑,失敗會寄信給你。

偶爾可以檢查:
```bash
cd /volume1/backups/supabase
ls -lh oracle-iching-*.dump   # 看最近的備份
tail -50 backup.log            # 看最近的 log
```

## 緊急還原

**極度不建議直接還原回正式站**。正確流程是:

### A 情境:正式站掛了,需要重建

1. 在 Supabase 建一個新的專案當臨時站
2. 把新專案的 Session pooler 連線字串記下來
3. 從 NAS 找最近一份可用的備份
4. 在 NAS 跑:
   ```bash
   cd /volume1/scripts/oracle-iching/scripts/nas-backup
   ./restore-supabase.sh /volume1/backups/supabase/oracle-iching-20260422-030000.dump \
     "postgresql://postgres.NEW_REF:NEW_PWD@aws-0-xxx.pooler.supabase.com:5432/postgres"
   ```
5. 把 app 的 `NEXT_PUBLIC_SUPABASE_URL` 切到新專案,重新 deploy
6. DNS / env 都 OK 之後再把舊專案關掉

### B 情境:只是想把某天的資料撈出來看

1. 用 Supabase CLI 起本地 Postgres:`supabase start`
2. 用 `pg_restore` 還原到本地 db 看
3. 或直接用 `pg_restore --list` 看備份內容清單

### 用哪份備份?

用 `pg_restore --list` 可以在不還原的狀態下看到備份裡有哪些資料表:

```bash
docker run --rm -v /volume1/backups/supabase:/backups postgres:16 \
  pg_restore --list /backups/oracle-iching-20260423-030000.dump | less
```

## 常見問題

### pg_dump: error: connection to server ... failed

→ 檢查 `.env` 裡的 `SUPABASE_DB_URL`:
- 有沒有用 **Session pooler**(port 5432)而非 Transaction pooler(6543)
- 密碼有沒有 URL encode
- Supabase 專案有沒有被 pause(免費方案閒置 7 天會暫停)

### docker: permission denied

→ Task Scheduler 的任務要用 `root` 身分跑,不能用一般使用者。

### 備份檔突然變很大

→ 看看是不是 `chat_messages` 或 `divinations` 爆量了。可以考慮:
- 把舊對話紀錄歸檔到另外的 archive table,主表只留近 90 天
- 或在備份前先清理 `auth.audit_log_entries`(Supabase 預設會累積登入紀錄)

### 想改保留策略

編輯 `.env` 的 `RETENTION_DAYS`,例如改成 90。下次跑就生效。

### 想把備份也丟雲端多一份

3-2-1 備份原則(3 份、2 種媒介、1 份異地)是好習慣。建議做法:
- NAS 本機:這個腳本的輸出(本地快速還原)
- NAS Cloud Sync 套件:把 `/volume1/backups/supabase` 同步到 Backblaze B2 / iDrive e2 / Cloudflare R2(便宜的 S3 相容雲端)
- Synology Hyper Backup:另外排程備份到你的 Google Drive / Dropbox

## 檔案清單

| 檔案 | 用途 |
|---|---|
| `backup-supabase.sh` | 主備份腳本,給 Task Scheduler 排程 |
| `restore-supabase.sh` | 還原腳本,緊急時手動跑 |
| `.env.example` | 設定範本 |
| `.env` | 實際設定(含密碼,**不會 commit** 到 git) |
| `.gitignore` | 排除 `.env` 和備份檔 |
| `backup.log` | 執行 log(自動產生在 BACKUP_DIR) |
