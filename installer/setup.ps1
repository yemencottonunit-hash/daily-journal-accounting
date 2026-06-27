$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "  ============================================"
Write-Host "   تنصيب نظام القيود اليومية المحاسبية"
Write-Host "   لؤي العليمي 774347342"
Write-Host "  ============================================"
Write-Host ""

$HOST = Read-Host "  رقم الهوست (IP) [0.0.0.0]"
if ([string]::IsNullOrWhiteSpace($HOST)) { $HOST = "0.0.0.0" }

$PORT = Read-Host "  رقم المنفذ [4357]"
if ([string]::IsNullOrWhiteSpace($PORT)) { $PORT = "4357" }

Write-Host ""
Write-Host "  الهوست: $HOST"
Write-Host "  المنفذ: $PORT"
Write-Host ""

$confirm = Read-Host "  هل تريد المتابعة؟ (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") { exit }

$dst = Join-Path $env:USERPROFILE "QiyoudAlYoumiya"
$src = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  [1/4] إنشاء مجلد التنصيب..."
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dst "server\src") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dst "server\data") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dst "client") -Force | Out-Null

Write-Host "  [2/4] نسخ الملفات..."
Copy-Item (Join-Path $src "server\src\*") -Destination (Join-Path $dst "server\src") -Recurse -Force
Copy-Item (Join-Path $src "server\node_modules") -Destination (Join-Path $dst "server\node_modules") -Recurse -Force
Copy-Item (Join-Path $src "server\package.json") -Destination (Join-Path $dst "server\package.json") -Force
Copy-Item (Join-Path $src "client\dist") -Destination (Join-Path $dst "client\dist") -Recurse -Force

Write-Host "  [3/4] إعداد ملفات التكوين..."
$config = @{ port = [int]$PORT; host = $HOST } | ConvertTo-Json
Set-Content -Path (Join-Path $dst "config.json") -Value $config -Encoding UTF8

$batContent = @"
@echo off
chcp 65001 >nul
title نظام القيود اليومية
cd /d "$dst\server"
set PATH=C:\Program Files\nodejs;`%PATH`%
node src\index.js
pause
"@
Set-Content -Path (Join-Path $dst "تشغيل.bat") -Value $batContent -Encoding UTF8

Write-Host "  [4/4] إنشاء اختصار سطح المكتب..."
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut((Join-Path $env:USERPROFILE "Desktop\نظام القيود اليومية.lnk"))
$sc.TargetPath = Join-Path $dst "تشغيل.bat"
$sc.WorkingDirectory = $dst
$sc.Description = "نظام القيود اليومية المحاسبية"
$sc.Save()

Write-Host ""
Write-Host "  ============================================"
Write-Host "   تم التنصيب بنجاح!"
Write-Host "  ============================================"
Write-Host ""
Write-Host "  رابط السيرفر: http://${HOST}:${PORT}"
Write-Host ""
Write-Host "  بيانات الدخول:"
Write-Host "    المستخدم: admin"
Write-Host "    كلمة السر: admin123"
Write-Host "  ============================================"
Write-Host ""
Read-Host "  اضغط Enter للإنهاء"
