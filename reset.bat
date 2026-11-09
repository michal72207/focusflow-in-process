@echo off
cd /d "%~dp0"
title FocusFlow - Reset

echo.
echo  ===================================================
echo    WARNING: This will DELETE all database data!
echo    Users, content, sessions — everything is wiped.
echo  ===================================================
echo.
set /p confirm=Type YES to continue (anything else cancels): 
if /i not "%confirm%"=="YES" (
    echo Cancelled. No data was deleted.
    pause
    exit /b 0
)

echo.
echo Stopping containers and removing volumes...
docker compose down -v
echo.
echo Database wiped. Run start.bat for a fresh start.
pause
