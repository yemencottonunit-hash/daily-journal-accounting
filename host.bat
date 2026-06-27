@echo off
chcp 65001 >nul
echo ========================================
echo   نظام القيود اليومية المحاسبية
echo ========================================
echo.

set PATH=C:\Program Files\nodejs;%PATH%

echo [1] بناء الواجهة...
cd /d "%~dp0client"
node node_modules/vite/bin/vite.js build
echo.

echo [2] تشغيل السيرفر على المنفذ 4357...
cd /d "%~dp0server"
start "Daily Journal Server" cmd /k "node src/index.js"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   تم التشغيل بنجاح!
echo   رابط السيرفر: http://localhost:4357
echo   رابط الشبكة: http://<IP-جهازك>:4357
echo ========================================
echo.
echo   بيانات الدخول: admin / admin123
echo.
pause
