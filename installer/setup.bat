@echo off
chcp 65001 >nul
title تنصيب نظام القيود اليومية
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
pause
