@echo off
chcp 65001 >nul
title Qiyoud AlYoumiya
cd /d "%~dp0server"
set PATH=C:\Program Files\nodejs;%PATH%
node src/index.js
pause
