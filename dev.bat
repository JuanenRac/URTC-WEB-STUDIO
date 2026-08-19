@echo off
REM =============================================================================
REM URTC Web Studio - Development Server Start Script
REM Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
REM GPL-3.0 - see LICENSE
REM =============================================================================

echo ========================================
echo  Installing dependencies...
echo ========================================
call npm install

echo ========================================
echo  Starting URTC Web Studio (Dev Mode)
echo ========================================
call npm run dev
pause
