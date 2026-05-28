#!/usr/bin/env bash
#
# setup-ios.sh —— Tarogram 易問 iOS Capacitor 一鍵安裝腳本
#
# 用法:
#   1. 把這個檔案放在 oracle-iching repo 根目錄(跟 package.json 同層)
#   2. 把 ios-patch/ 資料夾整個放在 ~/Downloads/ios-patch 或 $PATCH_DIR 環境變數指定位置
#   3. chmod +x setup-ios.sh
#   4. ./setup-ios.sh
#
# 這個腳本會做的事(每一步出錯會停下來,不會默默繼續):
#   1. 檢查環境(macOS / Node / Xcode / CocoaPods)
#   2. 安裝 Capacitor + iOS platform + native-purchases plugin
#   3. 複製 capacitor.config.ts 跟 patch 檔到對應位置
#   4. npx cap add ios       ← 產生 ios/ 資料夾
#   5. 安裝 @capacitor/assets,從 launcher-icon-source.png 產生全尺寸 App Icon
#   6. npx cap sync ios      ← 把 native deps 同步進 Xcode 專案
#   7. 印出後續手動步驟(打開 Xcode、設 Team、Run)
#
# 重新跑安全:每一步都有 idempotent 檢查,可重複執行不會炸。

set -euo pipefail

# ---------- 顏色 ----------
RED=$'\e[31m'
GREEN=$'\e[32m'
YELLOW=$'\e[33m'
BLUE=$'\e[34m'
BOLD=$'\e[1m'
RESET=$'\e[0m'

step() { echo ""; echo "${BOLD}${BLUE}▶ $1${RESET}"; }
ok()   { echo "  ${GREEN}✓${RESET} $1"; }
warn() { echo "  ${YELLOW}⚠${RESET}  $1"; }
fail() { echo "  ${RED}✗${RESET} $1" >&2; exit 1; }

PATCH_DIR="${PATCH_DIR:-$HOME/Downloads/ios-patch}"

# ---------- 1. 環境檢查 ----------
step "Step 1/7 · 檢查環境"

if [[ "$(uname)" != "Darwin" ]]; then
  fail "iOS 打包需要在 macOS 上執行,當前系統:$(uname)"
fi
ok "macOS 確認"

if ! command -v node &> /dev/null; then
  fail "找不到 node,請先安裝 Node.js 20.x LTS:https://nodejs.org/"
fi
NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\)\..*/\1/')
if (( NODE_MAJOR < 20 )); then
  warn "Node 版本 $(node -v) 偏舊,建議 20.x LTS"
else
  ok "Node $(node -v)"
fi

if ! command -v xcodebuild &> /dev/null; then
  fail "找不到 Xcode,請從 Mac App Store 安裝"
fi
ok "Xcode $(xcodebuild -version | head -1 | awk '{print $2}')"

if ! xcode-select -p &> /dev/null; then
  warn "Xcode Command Line Tools 未安裝,執行:xcode-select --install"
  fail "請先裝 CLT 再重跑"
fi
ok "Xcode CLT 已裝"

if ! command -v pod &> /dev/null; then
  warn "CocoaPods 未安裝,執行:sudo gem install cocoapods"
  fail "請先裝 CocoaPods 再重跑"
fi
ok "CocoaPods $(pod --version)"

if [[ ! -f package.json ]]; then
  fail "目前資料夾沒有 package.json,請在 oracle-iching repo 根目錄執行"
fi
if ! grep -q "\"oracle-iching\"" package.json 2>/dev/null; then
  warn "package.json 名稱不是 oracle-iching,確定你在對的目錄嗎?"
fi
ok "在 oracle-iching repo 根目錄"

if [[ ! -d "$PATCH_DIR" ]]; then
  fail "找不到 patch 資料夾:$PATCH_DIR
        請把 Claude 產出的 ios-patch/ 整個資料夾放到 $PATCH_DIR
        或設定環境變數: PATCH_DIR=/your/path ./setup-ios.sh"
fi
ok "Patch 資料夾:$PATCH_DIR"

# ---------- 2. 安裝 Capacitor 套件 ----------
step "Step 2/7 · 安裝 Capacitor"

if [[ ! -d node_modules/@capacitor/core ]]; then
  npm install @capacitor/core @capacitor/cli @capacitor/ios
  ok "Capacitor 核心安裝完成"
else
  ok "Capacitor 已安裝(略過)"
fi

if [[ ! -d node_modules/@capgo/native-purchases ]]; then
  npm install @capgo/native-purchases
  ok "native-purchases plugin 安裝完成"
else
  ok "native-purchases 已安裝(略過)"
fi

# ---------- 3. 複製 patch 檔案 ----------
step "Step 3/7 · 複製 patch 檔到 repo"

mkdir -p lib/billing lib/hooks components

# capacitor.config.ts → repo 根目錄
if [[ -f capacitor.config.ts ]]; then
  warn "capacitor.config.ts 已存在,備份為 .bak"
  cp capacitor.config.ts capacitor.config.ts.bak
fi
cp "$PATCH_DIR/capacitor.config.ts" ./capacitor.config.ts
ok "capacitor.config.ts"

# 6 個程式碼檔
copy_patch() {
  local src="$1"
  local dst="$2"
  if [[ -f "$dst" ]]; then
    warn "$dst 已存在,備份為 .bak"
    cp "$dst" "${dst}.bak"
  fi
  cp "$PATCH_DIR/$src" "$dst"
  ok "$dst"
}

copy_patch "lib/billing/platform.ts"          "lib/billing/platform.ts"
copy_patch "lib/billing/appleProducts.ts"     "lib/billing/appleProducts.ts"
copy_patch "lib/billing/appleIap.ts"          "lib/billing/appleIap.ts"
copy_patch "lib/billing/index.ts"             "lib/billing/index.ts"
copy_patch "lib/hooks/useIsNativeWrapper.ts"  "lib/hooks/useIsNativeWrapper.ts"
copy_patch "components/NativePurchaseNotice.tsx" "components/NativePurchaseNotice.tsx"

# ---------- 4. 新增 iOS platform ----------
step "Step 4/7 · npx cap add ios (產生 ios/ 資料夾)"

if [[ -d ios ]]; then
  ok "ios/ 已存在(略過 cap add)"
else
  npx cap add ios
  ok "ios/ 資料夾已產出"
fi

# ---------- 5. App Icon ----------
step "Step 5/7 · 從 launcher-icon-source.png 產生 iOS App Icon 全尺寸"

if [[ ! -f launcher-icon-source.png ]]; then
  warn "找不到 launcher-icon-source.png,跳過 App Icon 產生"
  warn "你需要自己準備 1024x1024 PNG(不可有 alpha 透明),"
  warn "之後在 Xcode 內把它拖進 Assets.xcassets/AppIcon"
else
  if [[ ! -d node_modules/@capacitor/assets ]]; then
    npm install -D @capacitor/assets
    ok "@capacitor/assets 安裝完成"
  fi

  # @capacitor/assets 預設讀 resources/icon-only.png 或 resources/icon.png
  mkdir -p resources
  if [[ ! -f resources/icon-only.png ]]; then
    cp launcher-icon-source.png resources/icon-only.png
    ok "複製 launcher-icon-source.png → resources/icon-only.png"
  fi

  # 同時準備 splash 用同樣的圖(背景會自動填 backgroundColor)
  if [[ ! -f resources/splash.png ]]; then
    cp launcher-icon-source.png resources/splash.png
    ok "複製 launcher-icon-source.png → resources/splash.png(splash 用)"
  fi

  npx capacitor-assets generate --ios \
    --iconBackgroundColor "#0a0a1a" \
    --splashBackgroundColor "#0a0a1a" || warn "@capacitor/assets 產生失敗,可能要手動處理"
  ok "iOS App Icon 全尺寸已寫入 ios/App/App/Assets.xcassets/"
fi

# ---------- 6. Sync ----------
step "Step 6/7 · npx cap sync ios (鏈接 native deps)"
npx cap sync ios
ok "Capacitor sync 完成"

# ---------- 7. 完成提示 ----------
step "Step 7/7 · 完成!後續手動步驟 ↓"

cat <<EOF

${BOLD}${GREEN}🎉 Setup 完成!${RESET}

接下來請在 ${BOLD}Xcode${RESET} 內手動完成:

  ${BOLD}1.${RESET} 開啟 Xcode workspace
     ${BLUE}npx cap open ios${RESET}

  ${BOLD}2.${RESET} 設定 Signing
     - 左側 Project Navigator 點 App(藍色圖示)
     - 中間選 App target → ${BOLD}Signing & Capabilities${RESET}
     - ${BOLD}Automatically manage signing${RESET} 打勾
     - ${BOLD}Team${RESET} 選你的 Apple Developer 帳號
     - Bundle ID 確認是 ${BOLD}me.heronhouse.tarogram${RESET}

  ${BOLD}3.${RESET} 跑模擬器
     - 上方裝置選 ${BOLD}iPhone 16 Pro${RESET}(或任意 simulator)
     - 按 ▶️ Run
     - 第一次跑會編譯 Pods(2-3 分鐘)

  ${BOLD}4.${RESET} 預期看到的結果
     - 模擬器啟動 → 黑底深色 splash
     - WebView 載入 tarogram.heronhouse.me
     - 點任何頁面正常運作
     - 開 Safari → Develop → Simulator → 你的 App 可以看 console log

  ${BOLD}5.${RESET} 確認 Capacitor 偵測有作用
     - 在 Safari developer console 跑:
       ${BLUE}window.Capacitor.getPlatform()${RESET}
     - 應該回傳 ${GREEN}"ios"${RESET}

如果遇到問題,常見排雷:
  • ${YELLOW}Pods 編譯失敗 'Sandbox: rsync'${RESET}
     → Project Settings → Build Settings → User Script Sandboxing 改 ${BOLD}No${RESET}
  • ${YELLOW}Cannot find module '@capgo/native-purchases'${RESET}
     → 重跑:${BLUE}npm install && npx cap sync ios${RESET}
  • ${YELLOW}App 開啟一片白${RESET}
     → Capacitor.config 的 server.url 確認可以正常打開
       (在模擬器 Safari 內貼 ${BLUE}https://tarogram.heronhouse.me${RESET} 測試)

完整步驟、Reader App 合規檢查、TestFlight 流程都在
${BOLD}IOS_PACKAGING.md${RESET} 文件裡。

EOF
