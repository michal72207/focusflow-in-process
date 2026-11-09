@echo off
cd /d "%~dp0"
title FocusFlow - Stop
echo Stopping FocusFlow (database data is preserved)...
docker compose down
echo.
echo Done. Run start.bat to restart.
pause
