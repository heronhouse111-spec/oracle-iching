#!/bin/bash
# ============================================================================
# Vercel 環境變數 → NAS 備份
# ----------------------------------------------------------------------------
# 透過 Vercel REST API 抓取 project env vars(含 secret 解密值)
# 備份為 JSON,每天一份,保留 30 天
# 還原方式:參考 JSON 裡的 key/value,逐筆貼回 Vercel Dashboard
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "${SCRIPT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/.env"
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-/volume2/backups/supabase}"
LOG_FILE="${BACKUP_DIR}/backup.log"
VERCEL_BACKUP_DIR="${VERCEL_BACKUP_DIR:-/volume2/backups/vercel}"
VERCEL_RETENTION_DAYS="${VERCEL_RETENTION_DAYS:-30}"

mkdir -p "$VERCEL_BACKUP_DIR" "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "===== 開始備份 Vercel 環境變數 ====="

if [ -z "${VERCEL_TOKEN:-}" ] || [ -z "${VERCEL_PROJECT_ID:-}" ]; then
  log "SKIP: 未設定 VERCEL_TOKEN / VERCEL_PROJECT_ID,略過 Vercel 備份"
  log "      (若要啟用,在 .env 填入 VERCEL_TOKEN 和 VERCEL_PROJECT_ID)"
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  log "ERROR: 找不到 curl"
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
OUTPUT_FILE="${VERCEL_BACKUP_DIR}/vercel-env-${TIMESTAMP}.json"
LATEST_LINK="${VERCEL_BACKUP_DIR}/vercel-env-latest.json"

API_URL="https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env?decrypt=true"
if [ -n "${VERCEL_TEAM_ID:-}" ]; then
  API_URL="${API_URL}&teamId=${VERCEL_TEAM_ID}"
fi

log "呼叫 Vercel API..."

HTTP_CODE=$(curl -sS -w "%{http_code}" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  "$API_URL" \
  -o "$OUTPUT_FILE" 2>>"$LOG_FILE" || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  chmod 600 "$OUTPUT_FILE"
  # 試著算有幾個 env var
  COUNT=$(grep -o '"key":' "$OUTPUT_FILE" 2>/dev/null | wc -l || echo "?")
  SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  # 建立「latest」symlink 方便隨時看最新
  ln -sf "$(basename "$OUTPUT_FILE")" "$LATEST_LINK"
  log "Vercel env 備份完成: ${OUTPUT_FILE}"
  log "  變數數量: ${COUNT} / 檔案大小: ${SIZE}"
else
  log "ERROR: Vercel API 回傳 HTTP ${HTTP_CODE}"
  log "  回應內容:$(head -c 200 "$OUTPUT_FILE" 2>/dev/null)"
  rm -f "$OUTPUT_FILE"
  exit 1
fi

# 輪替舊備份
log "清理 ${VERCEL_RETENTION_DAYS} 天前的舊備份..."
DELETED=$(find "$VERCEL_BACKUP_DIR" -maxdepth 1 -name "vercel-env-*.json" -type f -mtime +${VERCEL_RETENTION_DAYS} -print -delete 2>/dev/null | wc -l)
log "  已刪除 ${DELETED} 個舊檔"

log "===== Vercel 環境變數備份完成 ====="
echo ""
