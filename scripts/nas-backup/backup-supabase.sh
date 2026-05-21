#!/bin/bash
# ============================================================================
# Supabase → Synology NAS 自動備份腳本
# ----------------------------------------------------------------------------
# 每天執行一次,把 Supabase 資料庫 dump 到 NAS,並自動輪替舊檔
# 依賴:Synology Container Manager (或 Docker 套件)
# ============================================================================

set -euo pipefail

# ---------- 讀取設定 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 優先讀取同目錄的 .env
if [ -f "${SCRIPT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a
fi

DB_URL="${SUPABASE_DB_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-/volume1/backups/supabase}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
PG_IMAGE="${PG_IMAGE:-postgres:17}"
PROJECT_NAME="${PROJECT_NAME:-oracle-iching}"

# 要備份的 schema (逗號分隔)
# public = 業務資料、auth = 使用者帳號、storage = 檔案 metadata、supabase_functions = Edge Functions
SCHEMAS="${SCHEMAS:-public,auth,storage,supabase_functions}"

# ---------- 前置檢查 ----------
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
BACKUP_FILE="${PROJECT_NAME}-${TIMESTAMP}.dump"
LOG_FILE="${BACKUP_DIR}/backup.log"

mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "===== 開始備份 ${PROJECT_NAME} ====="

if [ -z "$DB_URL" ]; then
  log "ERROR: SUPABASE_DB_URL 未設定,請檢查 .env 檔"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  log "ERROR: 找不到 docker 指令,請先在 Synology 安裝 Container Manager"
  exit 1
fi

# ---------- 組 pg_dump 參數 ----------
SCHEMA_ARGS=""
IFS=',' read -ra SCHEMA_LIST <<< "$SCHEMAS"
for s in "${SCHEMA_LIST[@]}"; do
  SCHEMA_ARGS="${SCHEMA_ARGS} --schema=${s}"
done

# ---------- 執行 pg_dump ----------
log "執行 pg_dump (schemas: ${SCHEMAS})..."

# 確保 image 存在 (第一次執行會 pull)
if ! docker image inspect "$PG_IMAGE" >/dev/null 2>&1; then
  log "下載 Docker image: ${PG_IMAGE}"
  docker pull "$PG_IMAGE" >>"$LOG_FILE" 2>&1
fi

# shellcheck disable=SC2086
if docker run --rm \
  -v "${BACKUP_DIR}:/backups" \
  -e PGCONNECT_TIMEOUT=30 \
  "$PG_IMAGE" \
  pg_dump "$DB_URL" \
    $SCHEMA_ARGS \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --format=custom \
    --compress=9 \
    --file="/backups/${BACKUP_FILE}" \
  2>>"$LOG_FILE"
then
  SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
  log "備份成功: ${BACKUP_FILE} (${SIZE})"
else
  EXIT_CODE=$?
  log "ERROR: pg_dump 失敗 (exit code: ${EXIT_CODE})"
  # 失敗時刪除空的半成品
  rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
  exit $EXIT_CODE
fi

# ---------- 驗證備份檔 (用 pg_restore --list 確認可讀) ----------
log "驗證備份檔完整性..."
if docker run --rm \
  -v "${BACKUP_DIR}:/backups" \
  "$PG_IMAGE" \
  pg_restore --list "/backups/${BACKUP_FILE}" >/dev/null 2>>"$LOG_FILE"
then
  log "備份檔驗證通過"
else
  log "ERROR: 備份檔無法讀取,可能已損毀"
  exit 1
fi

# ---------- 輪替舊備份 ----------
log "清理 ${RETENTION_DAYS} 天前的舊備份..."
DELETED_COUNT=0
while IFS= read -r old_file; do
  rm -f "$old_file"
  log "  已刪除: $(basename "$old_file")"
  DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "$BACKUP_DIR" -maxdepth 1 -name "${PROJECT_NAME}-*.dump" -type f -mtime +${RETENTION_DAYS})
log "共刪除 ${DELETED_COUNT} 個舊備份檔"

# ---------- 統計現有備份 ----------
CURRENT_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -name "${PROJECT_NAME}-*.dump" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "目前保留 ${CURRENT_COUNT} 個備份檔,總大小 ${TOTAL_SIZE}"

log "===== 備份流程完成 ====="
echo ""
