#!/bin/bash
# ============================================================================
# Supabase 專案設定 → NAS 備份
# ----------------------------------------------------------------------------
# 透過 Supabase Management API 抓取各種專案設定(auth、api-keys、secrets 等)
# 這些東西不在 pg_dump 裡面,專案被刪時要手動重建,備份這些可以節省很多時間
# 備份每天一份,每份是一個資料夾包多個 JSON,保留 30 天
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
SB_CONFIG_BACKUP_DIR="${SB_CONFIG_BACKUP_DIR:-/volume2/backups/supabase-config}"
SB_CONFIG_RETENTION_DAYS="${SB_CONFIG_RETENTION_DAYS:-30}"
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-xpijubxjokrpysrpjrct}"

mkdir -p "$SB_CONFIG_BACKUP_DIR" "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "===== 開始備份 Supabase 專案設定 ====="

if [ -z "${SUPABASE_MANAGEMENT_TOKEN:-}" ]; then
  log "SKIP: 未設定 SUPABASE_MANAGEMENT_TOKEN,略過 Supabase 設定備份"
  log "      (若要啟用,在 https://supabase.com/dashboard/account/tokens 建立 token 後填入 .env)"
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  log "ERROR: 找不到 curl"
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
OUTPUT_DIR="${SB_CONFIG_BACKUP_DIR}/config-${TIMESTAMP}"
LATEST_LINK="${SB_CONFIG_BACKUP_DIR}/config-latest"
mkdir -p "$OUTPUT_DIR"

# 抓某個 API endpoint 並存成 JSON
fetch_api() {
  local path="$1"
  local name="$2"
  local url="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}${path}"
  local output="${OUTPUT_DIR}/${name}.json"

  local http_code
  http_code=$(curl -sS -w "%{http_code}" \
    -H "Authorization: Bearer ${SUPABASE_MANAGEMENT_TOKEN}" \
    -H "Content-Type: application/json" \
    "$url" \
    -o "$output" 2>>"$LOG_FILE" || echo "000")

  if [ "$http_code" = "200" ]; then
    log "  ✓ ${name}"
    return 0
  else
    # 某些 endpoint 在 free plan 可能不存在,不算致命錯誤
    log "  - ${name} (HTTP ${http_code},跳過)"
    rm -f "$output"
    return 1
  fi
}

log "抓取設定中..."

# 核心設定
fetch_api ""                      "project"          || true
fetch_api "/api-keys?reveal=true" "api-keys"         || true
fetch_api "/config/auth"          "auth-config"      || true
fetch_api "/config/database/postgres" "database-config" || true
fetch_api "/secrets"              "secrets"          || true

# 其他(可能用到也可能沒用到,留著)
fetch_api "/functions"            "functions"        || true
fetch_api "/storage/buckets"      "storage-buckets"  || true
fetch_api "/config/database/pooler" "pooler-config"  || true
fetch_api "/custom-hostname"      "custom-hostname"  || true
fetch_api "/network-bans"         "network-bans"     || true
fetch_api "/network-restrictions" "network-restrictions" || true
fetch_api "/ssl-enforcement"      "ssl-enforcement"  || true

# 設定權限
chmod 700 "$OUTPUT_DIR"
find "$OUTPUT_DIR" -type f -exec chmod 600 {} \;

# latest symlink
ln -sfn "$(basename "$OUTPUT_DIR")" "$LATEST_LINK"

FILE_COUNT=$(find "$OUTPUT_DIR" -type f | wc -l)
SIZE=$(du -sh "$OUTPUT_DIR" | cut -f1)
log "Supabase 設定備份完成: ${OUTPUT_DIR}"
log "  檔案數: ${FILE_COUNT} / 總大小: ${SIZE}"

# 輪替舊備份
log "清理 ${SB_CONFIG_RETENTION_DAYS} 天前的舊備份..."
DELETED=0
while IFS= read -r old_dir; do
  rm -rf "$old_dir"
  DELETED=$((DELETED + 1))
done < <(find "$SB_CONFIG_BACKUP_DIR" -maxdepth 1 -type d -name "config-2*" -mtime +${SB_CONFIG_RETENTION_DAYS})
log "  已刪除 ${DELETED} 個舊備份目錄"

log "===== Supabase 設定備份完成 ====="
echo ""
