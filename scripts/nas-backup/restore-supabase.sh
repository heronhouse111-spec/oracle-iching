#!/bin/bash
# ============================================================================
# Supabase 還原腳本 — 緊急救援用
# ----------------------------------------------------------------------------
# 用法:
#   ./restore-supabase.sh <備份檔路徑> [目標資料庫 URL]
#
# 如果沒給目標 URL,會從 .env 讀取 SUPABASE_DB_URL (還原回原本的資料庫)
# 強烈建議先在「新開的 Supabase 測試專案」還原確認沒問題再覆蓋正式站
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "${SCRIPT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a
fi

PG_IMAGE="${PG_IMAGE:-postgres:17}"

# ---------- 參數檢查 ----------
if [ $# -lt 1 ] || [ $# -gt 2 ]; then
  cat <<EOF
用法: $0 <備份檔路徑> [目標資料庫 URL]

範例:
  # 還原回 .env 設定的資料庫 (危險!會覆蓋正式站)
  $0 /volume1/backups/supabase/oracle-iching-20260423-030000.dump

  # 還原到另一個測試資料庫 (推薦)
  $0 /volume1/backups/supabase/oracle-iching-20260423-030000.dump "postgresql://postgres.xxx:pwd@aws-0-xxx.pooler.supabase.com:5432/postgres"
EOF
  exit 1
fi

BACKUP_FILE="$1"
TARGET_URL="${2:-${SUPABASE_DB_URL:-}}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: 備份檔不存在: $BACKUP_FILE"
  exit 1
fi

if [ -z "$TARGET_URL" ]; then
  echo "ERROR: 未提供目標資料庫 URL 且 .env 中沒有 SUPABASE_DB_URL"
  exit 1
fi

BACKUP_DIR=$(cd "$(dirname "$BACKUP_FILE")" && pwd)
BACKUP_NAME=$(basename "$BACKUP_FILE")

# ---------- 安全確認 ----------
# 用 sed 遮住密碼再顯示
MASKED_URL=$(echo "$TARGET_URL" | sed -E 's#(://[^:]+:)[^@]+(@)#\1****\2#')

echo ""
echo "================================================================"
echo "  WARNING: 即將還原資料庫,這會覆蓋目標資料庫的資料"
echo "================================================================"
echo "  備份檔: $BACKUP_FILE"
echo "  目標:   $MASKED_URL"
echo "================================================================"
echo ""
read -r -p "請輸入 'RESTORE' 確認繼續: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "已取消"
  exit 0
fi

# ---------- 先列出備份內容 ----------
echo ""
echo "備份檔內容預覽:"
docker run --rm \
  -v "${BACKUP_DIR}:/backups" \
  "$PG_IMAGE" \
  pg_restore --list "/backups/${BACKUP_NAME}" | head -30
echo "..."
echo ""

read -r -p "確認開始還原?(yes/no): " CONFIRM2
if [ "$CONFIRM2" != "yes" ]; then
  echo "已取消"
  exit 0
fi

# ---------- 執行 pg_restore ----------
echo "開始還原..."
docker run --rm \
  -v "${BACKUP_DIR}:/backups" \
  "$PG_IMAGE" \
  pg_restore \
    --dbname="$TARGET_URL" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --single-transaction \
    --exit-on-error \
    "/backups/${BACKUP_NAME}"

echo ""
echo "還原完成 ✓"
