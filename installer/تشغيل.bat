@echo off
chcp 65001 >nul
title نظام القيود اليومية

cd /d "%~dp0server"
set PATH=C:\Program Files\nodejs;%PATH%

echo ╔══════════════════════════════════════════════════════════════╗
echo ║           نظام القيود اليومية المحاسبية                    ║
echo ║                    لؤي العليمي 774347342                    ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo جاري تشغيل السيرفر...
echo.

node src/index.js
pause
