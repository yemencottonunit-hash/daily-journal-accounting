$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUILD_DIR = Join-Path $ROOT "dist-exe"
$SERVER_DIR = Join-Path $ROOT "server"
$CLIENT_DIR = Join-Path $ROOT "client"

Write-Host "  Building dist-exe..."

if (Test-Path $BUILD_DIR) { Remove-Item $BUILD_DIR -Recurse -Force }
New-Item -ItemType Directory -Path $BUILD_DIR -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BUILD_DIR "server\src") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BUILD_DIR "server\data") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $BUILD_DIR "client\dist") -Force | Out-Null

# Build Client
Write-Host "  [1/4] Building client..."
Push-Location $CLIENT_DIR
node node_modules/vite/bin/vite.js build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Client build failed!" }
Pop-Location

# Copy Server
Write-Host "  [2/4] Copying server..."
Copy-Item (Join-Path $SERVER_DIR "src\*") -Destination (Join-Path $BUILD_DIR "server\src") -Recurse -Force
Copy-Item (Join-Path $SERVER_DIR "node_modules") -Destination (Join-Path $BUILD_DIR "server\node_modules") -Recurse -Force
Copy-Item (Join-Path $SERVER_DIR "package.json") -Destination (Join-Path $BUILD_DIR "server\package.json") -Force

# Copy Client Dist
Write-Host "  [3/4] Copying client dist..."
Copy-Item (Join-Path $CLIENT_DIR "dist\*") -Destination (Join-Path $BUILD_DIR "client\dist") -Recurse -Force

# Config
Write-Host "  [4/4] Creating config..."
$config = @{ port = 4357; host = "0.0.0.0" } | ConvertTo-Json
Set-Content -Path (Join-Path $BUILD_DIR "config.json") -Value $config -Encoding UTF8

# Compile EXE
$launcherCs = Join-Path $ROOT "launcher.cs"
$launcherExe = Join-Path $BUILD_DIR "QiyoudAlYoumiya.exe"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (Test-Path $csc) {
    & $csc /nologo /out:$launcherExe /platform:x64 /target:winexe $launcherCs
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  EXE built: $launcherExe"
    } else {
        Write-Host "  EXE build failed"
    }
} else {
    Write-Host "  csc.exe not found"
}

# BAT backup
$bat = Join-Path $BUILD_DIR "QiyoudAlYoumiya.bat"
Set-Content -Path $bat -Value '@echo off
chcp 65001 >nul
title Qiyoud AlYoumiya
cd /d "%~dp0server"
set PATH=C:\Program Files\nodejs;%PATH%
node src/index.js
pause' -Encoding UTF8

$totalSize = (Get-ChildItem $BUILD_DIR -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "  Done! Size: $([math]::Round($totalSize, 1)) MB"
Write-Host "  Output: $BUILD_DIR"
