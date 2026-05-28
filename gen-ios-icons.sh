#!/usr/bin/env bash
#
# gen-ios-icons.sh —— 只重新產生 iOS App Icon(不動其他東西)
#
# 用途:
#   - 你改了 launcher-icon-source.png 想重新產一遍
#   - setup-ios.sh 跑過了但 icon 那步失敗,單獨修復
#
# 用法:
#   1. 在 oracle-iching repo 根目錄執行
#   2. 確保 launcher-icon-source.png 在根目錄
#   3. ./gen-ios-icons.sh
#
# 產出:
#   ios/App/App/Assets.xcassets/AppIcon.appiconset/  ← 整套 iOS 圖示
#   ios/App/App/Assets.xcassets/Splash.imageset/     ← splash 圖
#
# 原理:
#   用 Capacitor 官方的 @capacitor/assets 工具,從一張 1024x1024 來源圖
#   自動產生 Apple 要的所有尺寸(20pt @1x/2x/3x、29pt、40pt、60pt、76pt、83.5pt、1024pt)
#   並寫好 Contents.json metadata,Xcode 就會自動識別。

set -euo pipefail

GREEN=$'\e[32m'
YELLOW=$'\e[33m'
RED=$'\e[31m'
BOLD=$'\e[1m'
RESET=$'\e[0m'

# ---------- 檢查 ----------
if [[ ! -f package.json ]]; then
  echo "${RED}✗ 請在 oracle-iching repo 根目錄執行${RESET}" >&2
  exit 1
fi

if [[ ! -f launcher-icon-source.png ]]; then
  echo "${RED}✗ 找不到 launcher-icon-source.png${RESET}" >&2
  echo "  請把 1024x1024(或更大、正方形)的來源圖放在 repo 根目錄" >&2
  exit 1
fi

if [[ ! -d ios ]]; then
  echo "${RED}✗ 找不到 ios/ 資料夾,請先跑 setup-ios.sh 或 npx cap add ios${RESET}" >&2
  exit 1
fi

# ---------- 確認來源圖尺寸 ----------
if command -v sips &> /dev/null; then
  SIZE=$(sips -g pixelWidth launcher-icon-source.png 2>/dev/null | awk '/pixelWidth/{print $2}')
  if [[ -n "$SIZE" ]] && (( SIZE < 1024 )); then
    echo "${YELLOW}⚠ 來源圖只有 ${SIZE}px,Apple 要求最少 1024x1024${RESET}"
    echo "  圖會被放大,可能會模糊。建議改用 1024px 以上的原始圖。"
    read -rp "  仍要繼續嗎?(y/N) " confirm
    [[ "$confirm" =~ ^[Yy] ]] || exit 1
  fi
fi

# ---------- 確認透明背景(Apple App Store 1024x1024 不允許透明) ----------
if command -v sips &> /dev/null; then
  HAS_ALPHA=$(sips -g hasAlpha launcher-icon-source.png 2>/dev/null | awk '/hasAlpha/{print $2}')
  if [[ "$HAS_ALPHA" == "yes" ]]; then
    echo "${YELLOW}⚠ 來源圖有 alpha 通道,Apple App Store 1024x1024 圖不允許透明背景${RESET}"
    echo "  @capacitor/assets 會用指定的 backgroundColor 補底色,但建議來源就是不透明的。"
  fi
fi

# ---------- 安裝工具 ----------
if [[ ! -d node_modules/@capacitor/assets ]]; then
  echo "${BOLD}安裝 @capacitor/assets...${RESET}"
  npm install -D @capacitor/assets
fi

# ---------- 準備 resources/ ----------
mkdir -p resources

# @capacitor/assets 找這些檔名(優先順序):
#   resources/icon-only.png       ← 純圖示(配合 backgroundColor 補底)
#   resources/icon.png            ← 整張圖含背景
# 用 icon-only 比較彈性,可以隨時改 backgroundColor 不用換源圖
cp -f launcher-icon-source.png resources/icon-only.png
echo "  ${GREEN}✓${RESET} resources/icon-only.png 已更新"

# splash 用同一張(會置中、四周填 backgroundColor)
cp -f launcher-icon-source.png resources/splash.png
echo "  ${GREEN}✓${RESET} resources/splash.png 已更新"

# ---------- 產生! ----------
echo ""
echo "${BOLD}產生 iOS Assets...${RESET}"

# --iconBackgroundColor 配合 icon-only 一起用,@capacitor/assets 會自動把圖示
# 跟這個底色組合成最終的 icon。色值要跟 Capacitor.config.ts 的 backgroundColor +
# 網站 manifest.theme_color 三邊一致。
npx capacitor-assets generate --ios \
  --iconBackgroundColor "#0a0a1a" \
  --iconBackgroundColorDark "#0a0a1a" \
  --splashBackgroundColor "#0a0a1a" \
  --splashBackgroundColorDark "#0a0a1a"

echo ""
echo "${GREEN}🎉 完成!${RESET}"
echo ""
echo "產出位置:"
echo "  • ios/App/App/Assets.xcassets/AppIcon.appiconset/"
echo "  • ios/App/App/Assets.xcassets/Splash.imageset/"
echo ""
echo "下一步:"
echo "  ${BOLD}npx cap sync ios${RESET}     ← 確保 Xcode 抓到最新資源"
echo "  ${BOLD}npx cap open ios${RESET}     ← 在 Xcode 內看看 Assets.xcassets/AppIcon 預覽"
