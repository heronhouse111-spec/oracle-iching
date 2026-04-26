#!/bin/bash
# ============================================================================
# GitHub repo → NAS 備份
# ----------------------------------------------------------------------------
# 用 git clone --mirror 建立一份完整鏡像(含所有分支、tags、歷史)
# 首次執行會完整 clone,之後每次只拉 incremental(git 的增量很小)
# 還原方式:git clone <mirror-path> <new-location>
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
GITHUB_BACKUP_DIR="${GITHUB_BACKUP_DIR:-/volume2/backups/github}"
GIT_IMAGE="${GIT_IMAGE:-alpine/git:latest}"

mkdir -p "$GITHUB_BACKUP_DIR" "$BACKUP_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "===== 開始備份 GitHub repo ====="

if [ -z "${GITHUB_REPO:-}" ] || [ -z "${GITHUB_TOKEN:-}" ]; then
  log "SKIP: 未設定 GITHUB_REPO / GITHUB_TOKEN,略過 GitHub 備份"
  log "      (若要啟用,在 .env 填入 GITHUB_REPO=\"owner/repo\" 和 GITHUB_TOKEN)"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  log "ERROR: 找不到 docker"
  exit 1
fi

# 從 owner/repo 或完整 URL 解析出 repo 名字
REPO_PATH="$GITHUB_REPO"
REPO_PATH="${REPO_PATH##https://github.com/}"
REPO_PATH="${REPO_PATH##git@github.com:}"
REPO_PATH="${REPO_PATH%.git}"
REPO_NAME=$(basename "$REPO_PATH")
MIRROR_DIR="${GITHUB_BACKUP_DIR}/${REPO_NAME}.git"
AUTH_URL="https://${GITHUB_TOKEN}@github.com/${REPO_PATH}.git"

# 下載 git image(若尚未有)
if ! docker image inspect "$GIT_IMAGE" >/dev/null 2>&1; then
  log "下載 Docker image: ${GIT_IMAGE}"
  docker pull "$GIT_IMAGE" >>"$LOG_FILE" 2>&1
fi

if [ -d "${MIRROR_DIR}/objects" ]; then
  log "更新 mirror: ${MIRROR_DIR}"
  if docker run --rm \
    -v "${GITHUB_BACKUP_DIR}:/backup" \
    --entrypoint sh \
    "$GIT_IMAGE" \
    -c "cd '/backup/${REPO_NAME}.git' && git remote set-url origin '${AUTH_URL}' && git remote update --prune" \
    2>>"$LOG_FILE"
  then
    :
  else
    log "ERROR: git remote update 失敗"
    exit 1
  fi
else
  log "首次 clone mirror: ${GITHUB_REPO}"
  rm -rf "$MIRROR_DIR"
  if docker run --rm \
    -v "${GITHUB_BACKUP_DIR}:/backup" \
    --entrypoint sh \
    "$GIT_IMAGE" \
    -c "git clone --mirror '${AUTH_URL}' '/backup/${REPO_NAME}.git'" \
    2>>"$LOG_FILE"
  then
    :
  else
    log "ERROR: git clone --mirror 失敗"
    exit 1
  fi
fi

SIZE=$(du -sh "$MIRROR_DIR" 2>/dev/null | cut -f1)
BRANCH_COUNT=$(find "$MIRROR_DIR/refs/heads" -type f 2>/dev/null | wc -l || echo 0)
TAG_COUNT=$(find "$MIRROR_DIR/refs/tags" -type f 2>/dev/null | wc -l || echo 0)
log "GitHub 備份完成: ${MIRROR_DIR}"
log "  大小: ${SIZE} / 分支: ${BRANCH_COUNT} / Tags: ${TAG_COUNT}"
log "===== GitHub repo 備份完成 ====="
echo ""
