@echo off
cd /d "%~dp0"
title FocusFlow - Logs
echo Live logs for mongo, backend and frontend. Press Ctrl+C to stop watching.
echo.
docker compose logs -f --tail=100
pause
