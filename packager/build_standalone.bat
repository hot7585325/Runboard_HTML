@echo off
title CPE Tool Standalone Builder
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -Standalone
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Standalone build failed with error code %ERRORLEVEL%.
)
echo.
pause
