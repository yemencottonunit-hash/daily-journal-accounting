@echo off
chcp 65001 >nul
echo ========================================
echo   نظام القيود اليومية المحاسبية
echo ========================================
echo.

set PATH=C:\Program Files\nodejs;%PATH%

echo [1] تشغيل السيرفر على المنفذ 3001...
start "Daily Journal Server" cmd /c "cd /d "%~dp0server" && node src/index.js"

timeout /t 3 /nobreak >nul

echo [2] تشغيل واجهة المستخدم على المنفذ 5173...
start "Daily Journal Client" cmd /c "cd /d "%~dp0client" && node node_modules/vite/bin/vite.js"

echo.
echo ========================================
echo   تم التشغيل بنجاح!
echo   واجهة المستخدم: http://localhost:5173
echo   السيرفر: http://localhost:3001
echo ========================================
echo.
echo   بيانات الدخول: admin / admin123
echo.
pause
