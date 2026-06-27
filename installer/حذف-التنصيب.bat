@echo off
chcp 65001 >nul
title إلغاء تنصيب نظام القيود اليومية

echo ╔══════════════════════════════════════════════════════════════╗
echo ║           إلغاء تنصيب نظام القيود اليومية                  ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

set INSTALL_DIR=%USERPROFILE%\QiyoudAlYoumiya

echo مسار التنصيب: %INSTALL_DIR%
echo.

set /p CONFIRM="هل أنت متأكد من إلغاء التنصيف؟ (Y/N): "
if /I not "%CONFIRM%"=="Y" (
    echo تم الإلغاء.
    pause
    exit /b
)

:: حذف اختصار سطح المكتب
echo [1/2] حذف اختصار سطح المكتب...
if exist "%USERPROFILE%\Desktop\نظام القيود اليومية.lnk" (
    del "%USERPROFILE%\Desktop\نظام القيود اليومية.lnk"
)

:: حذف مجلد التنصيب
echo [2/2] حذف ملفات التنصيب...
if exist "%INSTALL_DIR%" (
    rmdir /S /Q "%INSTALL_DIR%"
)

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║              تم إلغاء التنصيب بنجاح                        ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
pause
