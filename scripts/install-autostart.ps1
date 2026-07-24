param(
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $PSScriptRoot 'start-live-game-animator.ps1'
$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir 'Live Game Animator.lnk'

if ($Remove) {
  if (Test-Path -LiteralPath $shortcutPath) {
    Remove-Item -LiteralPath $shortcutPath -Force
  }
  Write-Host 'Live Game Animator otomatik başlatmadan kaldırıldı.' -ForegroundColor Yellow
  exit 0
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Get-Command powershell.exe).Source
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`" -NoBrowser"
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'Live Game Animator yerel yayın otomasyonu'
$shortcut.Save()

Write-Host "Otomatik başlatma etkin: $shortcutPath" -ForegroundColor Green
Write-Host 'Kaldırmak için bu betiği -Remove parametresiyle çalıştırın.'
