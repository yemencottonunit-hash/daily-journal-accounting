@echo off
chcp 65001 >nul
echo ========================================
echo   نظام القيود اليومية المحاسبية
echo ========================================
echo.

set PATH=C:\Program Files\nodejs;%PATH%

echo جاري بناء المشروع للإنتاج...
echo.

echo [1] بناء واجهة المستخدم...
cd /d "%~dp0client"
node node_modules/vite/bin/vite.js build
if %errorlevel% neq 0 (
    echo خطأ في بناء الواجهة!
    pause
    exit /b 1
)

echo.
echo [2] تشغيل السيرفر في وضع الإنتاج...
cd /d "%~dp0server"
set NODE_ENV=production
node src/index.js

pause
