@echo off
REM Database Migration Batch Script for Windows
REM Usage: scripts\migrate.bat

echo.
echo =====================================================
echo   Pholio Database Migration Tool
echo =====================================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PowerShell is not available on this system
    echo Please run the Node.js version: node scripts/migrate.js
    exit /b 1
)

REM Run the PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0migrate.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Migration failed
    exit /b 1
)

echo.
echo [SUCCESS] Migration process completed
echo.
pause
