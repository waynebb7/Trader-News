@echo off
setlocal
title Trader News Cockpit
cd /d "%~dp0"

echo.
echo  ========================================
echo   TRADER NEWS COCKPIT - Starting...
echo  ========================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Download from https://nodejs.org/ ^(v18 or later, Windows 64-bit^)
    pause
    exit /b 1
)

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
