@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title FocusFlow - Start

echo.
echo  ================================================================
echo    FocusFlow ^| Power Tech 2026 ^| Full-Stack AI Learning Platform
echo  ================================================================
echo.

REM ── Step 1: Check Docker ─────────────────────────────────────────────────────
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running.
    echo.
    echo  Please:
    echo   1. Open Docker Desktop from the Start menu
    echo   2. Wait until the whale icon in the taskbar shows "Docker Desktop is running"
    echo   3. Run this script again
    echo.
    pause
    exit /b 1
)
echo [OK] Docker is running

REM ── Step 2: Check .env ───────────────────────────────────────────────────────
if not exist ".env" (
    echo [INFO] .env not found - copying from .env.example...
    copy ".env.example" ".env" >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Could not create .env file.
        pause
        exit /b 1
    )
    echo [OK] .env created from template
    echo [INFO] Edit .env to add GEMINI_API_KEY if you want AI questions
) else (
    echo [OK] .env found
)

REM ── Step 3: Build and start ───────────────────────────────────────────────────
echo.
echo Building and starting containers (this may take a few minutes on first run)...
echo.

docker compose up --build -d
if errorlevel 1 (
    echo.
    echo [ERROR] docker compose failed. See logs with: docker compose logs
    pause
    exit /b 1
)

echo.
echo Waiting for the backend to become healthy...
set /a tries=0

:wait_loop
REM Try health check
curl -s -f http://localhost:8000/health >nul 2>&1
if not errorlevel 1 goto :ready

set /a tries+=1
if !tries! geq 60 (
    echo.
    echo [WARN] Backend did not respond after ~2 minutes.
    echo        Check logs with: docker compose logs backend
    pause
    exit /b 1
)

REM Show progress every 10 tries
set /a mod=!tries! %% 10
if !mod! equ 0 (
    echo   ... still waiting (!tries!/60 attempts)
)
timeout /t 2 /nobreak >nul
goto :wait_loop

:ready
echo.
echo  ================================================================
echo    FocusFlow is RUNNING!
echo.
echo    Frontend (React app):  http://localhost:3000
echo    Backend (FastAPI):     http://localhost:8000
echo    Swagger UI:            http://localhost:8000/docs
echo    MongoDB:               localhost:27017 (internal to Docker)
echo.
echo    Run  stop.bat   to stop
echo    Run  logs.bat   to view logs
echo    Run  reset.bat  to wipe database (WARNING: deletes all data)
echo  ================================================================
echo.

start "" "http://localhost:3000"
timeout /t 3 /nobreak >nul
exit /b 0
