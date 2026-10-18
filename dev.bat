@echo off
cd /d "%~dp0"
rem Keep the window open for people, never in automation (CI / URTC_CI).
set "KEEP_OPEN=pause"
if defined CI set "KEEP_OPEN=ver >nul"
if "%URTC_CI%"=="1" set "KEEP_OPEN=ver >nul"
REM =============================================================================
REM URTC Web Studio - Development Server Start Script
REM Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
REM GPL-3.0-or-later - see LICENSE
REM =============================================================================

echo ========================================
echo  URTC Web Studio
echo  Development Server Start Script - installs dependencies and starts the dev server
echo  Author: JuanenRac (Electro Hobby 3D)
echo  E-mail: electrohobby3d@gmail.com
echo  License: GPL-3.0-or-later - see LICENSE
echo ========================================
echo.

echo ========================================
echo  Installing dependencies...
echo ========================================
call npm install

echo ========================================
echo  Starting URTC Web Studio (Dev Mode)
echo ========================================
call npm run dev
%KEEP_OPEN%
