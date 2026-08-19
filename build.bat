@echo off
REM =============================================================================
REM URTC Web Studio - Build and Compile Script
REM Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
REM GPL-3.0 - see LICENSE
REM =============================================================================

echo ========================================
echo  Installing dependencies...
echo ========================================
call npm install

echo ========================================
echo  Compiling URTC Web Studio (Prod Mode)
echo ========================================
call npm run build
echo.
echo Build complete! The static output is in dist/ - preview it locally with:
echo npm run preview
pause
