#!/bin/bash
# ============================================================================
# 一次跑完所有備份(Task Scheduler 排程這個檔案)
# ----------------------------------------------------------------------------
# 包含的備份:
#   1. Postgres 資料庫 (backup-supabase.sh)
#   2. Supabase Storage 檔案 (backup-storage.sh)
#   3. GitHub repo (backup-github.sh)
#   4. Vercel 環境變數 (backup-vercel.sh)
#   5. Supabase 專案設定 (backup-supabase-config.sh)
#
# 每個腳本獨立失敗不會影響其他(continue on error)
# 若某個 .env 沒填 credentials,對應腳本會優雅 SKIP,不算失敗
# ============================================================================

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILED=0
TOTAL=0

echo ""
echo "############################################################"
echo "# backup-all.sh — $(date '+%Y-%m-%d %H:%M:%S')"
echo "############################################################"

# 依序執行的腳本清單
SCRIPTS=(
  "backup-supabase.sh"          # 資料庫
  "backup-storage.sh"           # Storage 檔案
  "backup-github.sh"            # GitHub repo
  "backup-vercel.sh"            # Vercel env vars
  "backup-supabase-config.sh"   # Supabase 設定
)

for script in "${SCRIPTS[@]}"; do
  script_path="${SCRIPT_DIR}/${script}"
  if [ ! -f "$script_path" ]; then
    echo "!!! 找不到 ${script},跳過 !!!" >&2
    continue
  fi
  if [ ! -x "$script_path" ]; then
    chmod +x "$script_path" 2>/dev/null || true
  fi

  TOTAL=$((TOTAL + 1))
  if ! "$script_path"; then
    echo "!!! ${script} 執行失敗 !!!" >&2
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "############################################################"
if [ $FAILED -eq 0 ]; then
  echo "# ✓ 全部備份完成($TOTAL 項)"
  echo "############################################################"
  exit 0
else
  echo "# ✗ 有 $FAILED / $TOTAL 項備份失敗,請檢查 log"
  echo "# log 路徑:/volume2/backups/supabase/backup.log"
  echo "############################################################"
  exit 1
fi
