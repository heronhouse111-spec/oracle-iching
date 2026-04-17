# push.ps1 - one-click commit + push
# Usage:
#   .\push.ps1 "your commit message"
#   .\push.ps1              <-- uses "update" as default message

param(
  [string]$Message = "update"
)

# cd to script's folder (repo root)
Set-Location -Path $PSScriptRoot

# Clear possible stale lock file
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Changed files ===" -ForegroundColor Cyan
git status --short

$changes = git status --porcelain
if (-not $changes) {
  Write-Host ""
  Write-Host "No changes to commit." -ForegroundColor Yellow
  exit 0
}

Write-Host ""
Write-Host "=== Commit + Push ===" -ForegroundColor Cyan
Write-Host "Message: $Message" -ForegroundColor Green
Write-Host ""

git add -A
if ($LASTEXITCODE -ne 0) { Write-Host "git add failed" -ForegroundColor Red; exit 1 }

git commit -m $Message
if ($LASTEXITCODE -ne 0) { Write-Host "git commit failed" -ForegroundColor Red; exit 1 }

git push
if ($LASTEXITCODE -ne 0) { Write-Host "git push failed" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== Done! Vercel will auto-deploy ===" -ForegroundColor Green
