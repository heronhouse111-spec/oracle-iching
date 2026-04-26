#!/bin/bash
# ============================================================================
# Supabase Storage → Synology NAS 備份腳本
# ----------------------------------------------------------------------------
# 用 rclone(透過 Supabase 的 S3 相容介面)把所有 bucket 的檔案同步到 NAS
# 依賴:Container Manager / Docker (跑 rclone/rclone image)
#
# 設計說明:
#   - 使用 rclone copy(非 sync)→ 不會刪除 NAS 上已存在但 Supabase 已刪除的檔案
#     這樣比較接近「備份」語意,避免 Supabase 誤刪時連本地也跟著消失
#   - 僅下載變動過的檔案(rclone 會比對 size + modtime),每次執行很快
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------- 讀取設定 ----------
if [ -f "${SCRIPT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a
fi

STORAGE_BACKUP_DIR="${STORAGE_BACKUP_DIR:-/volume2/backups/supabase-storage}"
RCLONE_IMAGE="${RCLONE_IMAGE:-rclone/rclone:latest}"
PROJECT_NAME="${PROJECT_NAME:-oracle-iching}"
# 共用 Postgres 備份的 log 檔
BACKUP_DIR="${BACKUP_DIR:-/volume2/backups/supabase}"
LOG_FILE="${BACKUP_DIR}/backup.log"
CURRENT_DIR="${STORAGE_BACKUP_DIR}/current"

mkdir -p "$CURRENT_DIR" "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "===== 開始備份 Storage ====="

# ---------- 檢查 S3 credentials ----------
if [ -z "${SUPABASE_S3_ACCESS_KEY:-}" ] || [ -z "${SUPABASE_S3_SECRET_KEY:-}" ] || [ -z "${SUPABASE_S3_ENDPOINT:-}" ]; then
  log "SKIP: 未設定 S3 credentials,略過 Storage 備份"
  log "      (若要啟用,在 .env 填入 SUPABASE_S3_ACCESS_KEY / SUPABASE_S3_SECRET_KEY / SUPABASE_S3_ENDPOINT)"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  log "ERROR: 找不到 docker 指令"
  exit 1
fi

# ---------- 確保 rclone image 在本地 ----------
if ! docker image inspect "$RCLONE_IMAGE" >/dev/null 2>&1; then
  log "下載 Docker image: ${RCLONE_IMAGE}"
  docker pull "$RCLONE_IMAGE" >>"$LOG_FILE" 2>&1
fi

# ---------- 執行 rclone copy ----------
log "執行 rclone copy (Supabase Storage → ${CURRENT_DIR})"

if docker run --rm \
  -v "${CURRENT_DIR}:/data" \
  -e RCLONE_CONFIG_SUPABASE_TYPE=s3 \
  -e RCLONE_CONFIG_SUPABASE_PROVIDER=Other \
  -e RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID="$SUPABASE_S3_ACCESS_KEY" \
  -e RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET_KEY" \
  -e RCLONE_CONFIG_SUPABASE_ENDPOINT="$SUPABASE_S3_ENDPOINT" \
  -e RCLONE_CONFIG_SUPABASE_REGION="${SUPABASE_S3_REGION:-ap-southeast-1}" \
  -e RCLONE_CONFIG_SUPABASE_FORCE_PATH_STYLE=true \
  "$RCLONE_IMAGE" \
  copy supabase: /data \
    --stats-one-line \
    --stats 30s \
    --transfers 4 \
    --checkers 8 \
    --log-level NOTICE \
  2>>"$LOG_FILE"
then
  FILE_COUNT=$(find "$CURRENT_DIR" -type f 2>/dev/null | wc -l)
  TOTAL_SIZE=$(du -sh "$CURRENT_DIR" 2>/dev/null | cut -f1)
  log "Storage 備份完成: ${FILE_COUNT} 個檔案,總大小 ${TOTAL_SIZE}"
else
  EXIT_CODE=$?
  log "ERROR: rclone copy 失敗 (exit code: ${EXIT_CODE})"
  exit $EXIT_CODE
fi

log "===== Storage 備份流程完成 ====="
echo ""
