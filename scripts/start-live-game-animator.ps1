param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.live-game-animator'
$dashboardUrl = 'http://127.0.0.1:5173/'
$healthUrl = 'http://127.0.0.1:8787/api/health'

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

function Test-LiveGameAnimator {
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
    $dashboard = Invoke-WebRequest -Uri $dashboardUrl -UseBasicParsing -TimeoutSec 1
    return $response.ok -eq $true -and $dashboard.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js bulunamadı. Önce Node.js 20 veya daha yeni bir sürümü kurun.'
}

$nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) {
  throw "Node.js 20 veya daha yeni bir sürüm gerekli. Kurulu sürüm: $(& node --version)"
}

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  throw 'npm bulunamadı. Node.js kurulumunu denetleyin.'
}

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
  $installOut = Join-Path $runtimeDir 'install-output.log'
  $installErr = Join-Path $runtimeDir 'install-error.log'
  $installArgs = if (Test-Path (Join-Path $projectRoot 'package-lock.json')) { @('ci') } else { @('install') }
  $install = Start-Process -FilePath $npmCommand.Source -ArgumentList $installArgs -WorkingDirectory $projectRoot -RedirectStandardOutput $installOut -RedirectStandardError $installErr -WindowStyle Hidden -Wait -PassThru
  if ($install.ExitCode -ne 0) {
    throw "Bağımlılıklar kurulamadı. Ayrıntı: $installErr"
  }
}

$distIndex = Join-Path $projectRoot 'dist\index.html'
if (-not (Test-Path $distIndex)) {
  $buildOut = Join-Path $runtimeDir 'build-output.log'
  $buildErr = Join-Path $runtimeDir 'build-error.log'
  $build = Start-Process -FilePath $npmCommand.Source -ArgumentList @('run', 'build') -WorkingDirectory $projectRoot -RedirectStandardOutput $buildOut -RedirectStandardError $buildErr -WindowStyle Hidden -Wait -PassThru
  if ($build.ExitCode -ne 0) {
    throw "Üretim paketi oluşturulamadı. Ayrıntı: $buildErr"
  }
}

if (-not (Test-LiveGameAnimator)) {
  $serverOut = Join-Path $runtimeDir 'server-output.log'
  $serverErr = Join-Path $runtimeDir 'server-error.log'
  Start-Process -FilePath $npmCommand.Source -ArgumentList @('run', 'start') -WorkingDirectory $projectRoot -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -WindowStyle Hidden | Out-Null

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Test-LiveGameAnimator) {
      $ready = $true
      break
    }
  }
  if (-not $ready) {
    throw "Uygulama 30 saniye içinde açılamadı. Ayrıntı: $serverErr"
  }
}

if (-not $NoBrowser) {
  Start-Process $dashboardUrl
}

Write-Host "Live Game Animator hazır: $dashboardUrl" -ForegroundColor Green
