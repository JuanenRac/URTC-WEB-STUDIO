#!/bin/bash
# =============================================================================
# URTC Web Studio - Build and Compile Script
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0 - see LICENSE
# =============================================================================
python3 "$(dirname "$0")/bump_manifest_version.py" || exit 1

echo "========================================"
echo " URTC Web Studio"
echo " Build and Compile Script - installs dependencies and compiles the app"
echo " Author: JuanenRac (Electro Hobby 3D)"
echo " E-mail: electrohobby3d@gmail.com"
echo " License: GPL-3.0 - see LICENSE"
echo "========================================"
echo ""

echo "========================================"
echo " Installing dependencies... "
echo "========================================"
npm install

echo "========================================"
echo " Compiling URTC Web Studio (Prod Mode) "
echo "========================================"
npm run build
echo ""
echo "Build complete! The static output is in dist/ - preview it locally with:"
echo "npm run preview"
echo ""
read -p "Press Enter to close this window..."
