@echo off
setlocal
title Trader News Cockpit
cd /d "%~dp0"

set NODE_OPTIONS=--use-system-ca

node scripts/launch.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Startup failed. See messages above.
    echo.
    pause
    exit /b 1
)

pause
