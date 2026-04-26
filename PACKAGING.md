# Tarogram 易問 · Google Play 打包指南 (Bubblewrap TWA)

> 從零到 `.aab` 上傳到 Play Console 的完整流程。
> 目標產物:`app-release-bundle.aab`(Play Store 上架用)+ `app-release-signed.apk`(Internal Testing 側載測試用)。
> 預估時間:第一次做 2–3 小時(扣掉下載等待)。

---

## 0. Pre-flight 狀態(2026-04-22 確認)

| 項目 | 狀態 |
|---|---|
| `public/manifest.json` | ✅ 欄位齊全 |
| `public/.well-known/assetlinks.json` | ✅ placeholder,等 keystore 產出後回填 SHA256 |
| Service Worker `public/sw.js` | ✅ v2,PWA 可安裝 |
| Icons 16–1024 全尺寸 | ✅ |
| TWA guard (`useIsTWA` + `TwaPurchaseNotice`) | ✅ 已合規 |
| Play App Signing | 待 Console 啟用(預設自動啟用) |
| `me.heronhouse.oracle` package name | ✅ 預留 |

---

## 1. 本機環境準備 (Windows)

Bubblewrap 需要 JDK 17 + Android SDK 才能 build 出 AAB。以下步驟照順序做,跳步會踩雷。

### 1.1 Node.js (如果沒裝)

https://nodejs.org/ 下載 **LTS 20.x**。裝完開 PowerShell:

```powershell
node -v    # 應該 >= v20
npm -v
```

### 1.2 JDK 17 (Eclipse Temurin)

Bubblewrap 2.x 要 JDK 17,**不要用 21,Gradle 會炸**。

- 下載:https://adoptium.net/temurin/releases/?version=17&os=windows&arch=x64
- 選 **Windows x64 MSI Installer**
- 裝的時候勾 **Set JAVA_HOME environment variable** 跟 **Add to PATH**

開新的 PowerShell 驗證:

```powershell
java -version      # should print "openjdk version 17.0.x"
echo $env:JAVA_HOME
```

### 1.3 Android Command-line Tools

不用整包 Android Studio,Bubblewrap 只要 Command-line Tools + SDK 就夠了。

1. 建資料夾:`C:\Android\sdk`
2. 下載:https://developer.android.com/studio#command-line-tools-only
   - 找 **Command line tools only** → Windows 的 zip
3. 解壓縮後裡面有 `cmdline-tools` 資料夾 —— **再在外層包一層 `latest`**,結構要長這樣:

```
C:\Android\sdk\
└── cmdline-tools\
    └── latest\
        ├── bin\
        ├── lib\
        └── NOTICE.txt
```

> 這個 `latest` 子資料夾**非常重要**,沒包 sdkmanager 會報 `Could not determine SDK root`。

4. 設環境變數(PowerShell **以系統管理員身分**開):

```powershell
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Android\sdk', 'User')
[System.Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', 'C:\Android\sdk', 'User')

# 把 sdkmanager 加到 PATH
$newPath = "$env:Path;C:\Android\sdk\cmdline-tools\latest\bin;C:\Android\sdk\platform-tools"
[System.Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
```

**關掉所有 PowerShell 視窗重開一個**,環境變數才會生效。驗證:

```powershell
sdkmanager --version
echo $env:ANDROID_HOME
```

### 1.4 安裝 Android SDK 必要模組

第一次跑會叫你接受 license,一路按 `y`:

```powershell
sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

> `android-34` 是 Play Store 2024 後的最低 target SDK 要求,之後會漲,建議裝當下最新的。

---

## 2. 安裝 Bubblewrap CLI

```powershell
npm i -g @bubblewrap/cli
bubblewrap doctor
```

`bubblewrap doctor` 會檢查 JDK / SDK,全綠勾才算 OK。有紅叉就回第 1 步找缺的。

---

## 3. `bubblewrap init` —— 用你的 manifest 初始化專案

**重要:建一個獨立資料夾給 Bubblewrap 用,不要混在 Next.js 專案裡**。Bubblewrap 會產 Android Gradle 專案、keystore,跟 oracle-iching 原始碼完全不同樹。

```powershell
mkdir C:\Users\Eliot\oracle-twa
cd C:\Users\Eliot\oracle-twa

bubblewrap init --manifest https://tarogram.heronhouse.me/manifest.json
```

### Bubblewrap 會問一連串問題 —— 對照表

| 問題 | 這個專案該填 | 理由 |
|---|---|---|
| Domain being opened in the TWA | `tarogram.heronhouse.me` | 自動帶,確認 |
| Name of the application | `Tarogram 易問` | 中文 launcher name |
| Short name | `Tarogram` | 桌面 icon 底下的短名,太長會被截 |
| Application ID (package name) | `me.heronhouse.oracle` | **必須跟 assetlinks.json 裡的 `package_name` 一致** |
| Display mode | `standalone` | 不要 `fullscreen`(會藏狀態列,UX 差) |
| Status bar color | `#0a0a1a` | 跟 manifest `theme_color` 一致 |
| Background color (啟動閃屏) | `#0a0a1a` | 開 app 時黑底那瞬間,跟主題色一致才不閃 |
| Starting URL | **`/?source=twa`** | ⚠️ **手動改!**manifest 裡是 `?source=pwa`,TWA 要用 `twa` 讓 `useIsTWA()` 偵測到,關掉 Play Billing 違規的購買 UI |
| Icon URL | `https://tarogram.heronhouse.me/logo-512.png` | 512 px maskable |
| Maskable icon URL | 同上 | |
| Monochrome icon URL (通知列單色) | 空(按 Enter 跳過) | 可選,之後再補 |
| Fallback behavior | `customtabs` | TWA 主用,網站 SSL 壞了退 Custom Tabs,不退 browser |
| Chrome OS only | `No` | 我們要全 Android |
| Enable notifications | `Yes` | 之後做 push 用 |
| Include support for Play Billing | **`No`** | ⚠️ 合規!我們用綠界不用 Play Billing,勾 Yes 審核會被擋 |
| Locations | `No` | 不需要地理位置權限 |
| Key store file | 接受預設 `./android.keystore` | |
| Key name | 接受預設 `android` | |
| Key store password | **自己設,記下來!** | 丟了 = app 永遠不能更新 |
| Key password | 同上,可以跟 keystore 密碼一樣 | |
| First and Last name, Org, City, ... | 照實填(證書用) | 例:`Eliot Yang` / `Heronhouse` / `Taipei` / `TW` |

init 跑完會在當前資料夾產出:

```
oracle-twa/
├── twa-manifest.json       ← Bubblewrap 設定,之後改設定就改這個
├── android.keystore        ← ⚠️ 絕對要備份!
├── app/                    ← Android 專案
├── gradle/
├── build.gradle
└── ...
```

---

## 4. 🔐 Keystore 備份儀式(做完 init 馬上做!)

**Keystore 如果遺失或密碼忘了,app 就永遠不能更新**(只能重新用不同 package name 發新 app,所有評價歸零、訂閱戶作廢)。做完 init 第一件事:

```powershell
# 1. 複製到雲端備份(OneDrive / Google Drive / iCloud 都可)
Copy-Item .\android.keystore C:\Users\Eliot\OneDrive\backup\oracle-twa-android.keystore

# 2. 另存一份離線到 USB 或加密檔案
# 3. 密碼寫在密碼管理器(1Password / Bitwarden),NOT 明文記事本
```

推薦:密碼 + keystore 檔案分兩個地方放,都丟了才會一起沒。

---

## 5. `bubblewrap build` —— 產出 AAB

```powershell
cd C:\Users\Eliot\oracle-twa
bubblewrap build
```

會要你再輸入一次 keystore 密碼。第一次跑會下載 Gradle(~100 MB),之後就快了。

產出:

```
oracle-twa/
├── app-release-bundle.aab       ← ⭐ 這支傳 Play Console
├── app-release-signed.apk       ← 側載裝手機測試用
└── ...
```

### 先用 APK 側載測試

把 APK 傳到 Android 手機(LINE 傳給自己 / USB 複製),手機要**開發者選項 → 允許未知來源安裝**。安裝打開看看:

- ✅ **沒有看到網址列 = TWA 正確接管**(assetlinks 還沒生效前,會看到網址列,這是正常的,等第 7 步回填後才會全螢幕)
- ✅ 圖示正常(圓形剪裁沒吃到 logo)
- ✅ 開啟時背景色對(不閃白)
- ✅ `/?source=twa` 有被偵測,**沒有**點數購買按鈕顯示(看到的是 `TwaPurchaseNotice`)

---

## 6. 拿 SHA256 Fingerprint

```powershell
bubblewrap fingerprint
```

輸出會長這樣:

```
SHA-256 Fingerprint:
  12:AB:34:CD:56:EF:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90
```

**複製整串**(含冒號)。

---

## 7. 回填 `assetlinks.json` + 部署

### 7.1 修改 `public/.well-known/assetlinks.json`

回到 Next.js 專案(`C:\Users\Eliot\oracle-iching`),打開 `public/.well-known/assetlinks.json`,把 placeholder 換成真實 fingerprint:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "me.heronhouse.oracle",
      "sha256_cert_fingerprints": [
        "12:AB:34:CD:56:EF:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90"
      ]
    }
  }
]
```

### 7.2 commit + push

```powershell
cd C:\Users\Eliot\oracle-iching
git add public/.well-known/assetlinks.json
git commit -m "twa: fill real SHA256 fingerprint in assetlinks.json"
git push
```

### 7.3 驗證部署

等 Vercel Ready 後,瀏覽器直接開:

```
https://tarogram.heronhouse.me/.well-known/assetlinks.json
```

應該看到剛填的 JSON(Content-Type: application/json)。

再用 Google 官方工具驗:
https://developers.google.com/digital-asset-links/tools/generator
- Hosting site domain: `tarogram.heronhouse.me`
- App package name: `me.heronhouse.oracle`
- App package fingerprint: 剛那串 SHA256
- 按 **Test statement** → 應該 ✅ 綠勾

---

## 8. 上傳 AAB 到 Play Console

### 8.1 建 app

- Play Console → **建立應用程式**
- Default language:`繁體中文(台灣) – zh-TW`
- App name:`Tarogram 易問`
- App or game:**App**
- Free or paid:**Free**
- 兩個同意框勾起來

### 8.2 Internal Testing 上傳

進入 app → **Testing → Internal testing → Create new release**

上傳 `C:\Users\Eliot\oracle-twa\app-release-bundle.aab`。

Play Console 會自動:
1. 啟用 **Play App Signing**(把你的 upload key 升級成 Play 管的 app signing key)
2. 產生**第二組 SHA256**(Play 簽的那組)

### 8.3 ⚠️ 第二組 SHA256 也要回填

進 **Setup → App integrity → App signing key certificate**,會看到:

```
SHA-256 certificate fingerprint:
  AB:CD:EF:...
```

把這組**也加進** `public/.well-known/assetlinks.json` 的 `sha256_cert_fingerprints` 陣列(兩組都要):

```json
"sha256_cert_fingerprints": [
  "12:AB:34:... (你本機 upload key)",
  "AB:CD:EF:... (Play App Signing key)"
]
```

再 commit + push + Vercel 部署。

> **為什麼要兩組?** Internal Testing 下載的 APK 是 Play 重新簽的(用 Play 的 key),所以它要能驗證 TWA 關聯;你自己側載用的 APK 是你本機 keystore 簽的。兩個情境都要 work。

---

## 9. 填 Store Listing + Send for Review

照你之前做的 `Play 商店文案-三語.md` 跟 `Google Play 上架指南.md` 把欄位填完。關鍵:

- **Data Safety** 表單:照 `/privacy` 頁的對照表填
- **Content rating**:做 questionnaire,預計 Rated for 12+ 或 Teen
- **Target audience**:18+(避免兒童相關合規成本)
- **Ads**:選 **No, my app does not contain ads**
- **Google Play Billing declaration**:選 **My app does not use Play Billing**,理由欄寫:
  > "Physical goods (Taiwanese credits pack) processed via ECPay. Digital services purchases are restricted to the web version only (TWA shows a static notice)."

Send for review → 初審 1–3 天。

---

## 10. 之後要更新 app 時

每次要發新版(修 bug / 新功能):

```powershell
cd C:\Users\Eliot\oracle-twa

# 改 twa-manifest.json 的 appVersionName 跟 appVersionCode
# appVersionCode 必須比上次大(例 2 → 3),不然 Play 會拒

bubblewrap update      # 從網站 manifest 同步最新圖 / 名字 / 主題色
bubblewrap build       # 產新 AAB
```

上傳新 `.aab` 到 Play Console 同一個 app,不是建新 app。

---

## 11. 常見踩雷

| 症狀 | 原因 | 解法 |
|---|---|---|
| TWA 打開有網址列,沒全螢幕 | assetlinks.json 未生效 | 第 7 步,兩組 SHA256 都要填,CDN 快取要等 |
| `bubblewrap doctor` 找不到 sdkmanager | `cmdline-tools/latest/` 結構不對 | 第 1.3 步的資料夾層級要嚴格 |
| Gradle build 失敗 `Unsupported class file major version` | JDK 版本錯 | 換回 JDK 17,不能 21 |
| AAB 上傳被拒 "Target SDK 太低" | `targetSdkVersion` 過期 | `sdkmanager` 裝最新 `platforms;android-XX`,`bubblewrap update` 重 build |
| App 裡看得到點數購買按鈕 | `useIsTWA()` 沒偵測到 | 檢查 `twa-manifest.json` 裡 `launcherName` 的 start_url 是否 `/?source=twa` |
| Play Review 拒絕 "違反 Play Billing 政策" | 有可點的購買 CTA | 8.3 Billing declaration 要寫清楚,UI 層 `TwaPurchaseNotice` 要蓋掉所有 pricing grid |

---

## 12. 你現在可以開始的順序

1. [ ] 1.1–1.4 裝 Node / JDK 17 / Android SDK(最花時間的一步,~30 分鐘)
2. [ ] 2. `npm i -g @bubblewrap/cli` + `bubblewrap doctor` 全綠
3. [ ] 3. `bubblewrap init` 照 Q&A 表填
4. [ ] 4. **馬上備份 keystore** ⚠️
5. [ ] 5. `bubblewrap build` → 產出 AAB
6. [ ] 5. 側載 APK 到手機試,確認 TWA 行為對
7. [ ] 6+7. 拿 SHA256 → 填 assetlinks.json → push
8. [ ] 8. 上傳 AAB 到 Play Console Internal Testing
9. [ ] 8.3 拿 Play App Signing 的第二組 SHA256 → 再填 → push
10. [ ] 9. 填 Store Listing + Data Safety → Send for review

做到第 5 步時跟我說,我幫你看 APK 側載結果截圖確認沒問題再往下。

---

*最後更新 2026-04-22*
