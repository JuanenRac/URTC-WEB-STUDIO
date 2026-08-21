#!/bin/bash
# =============================================================================
# URTC Web Studio - Development Server Start Script
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0 - see LICENSE
# =============================================================================

echo "========================================"
echo " URTC Web Studio"
echo " Development Server Start Script - installs dependencies and starts the dev server"
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
echo " Starting URTC Web Studio (Dev Mode) "
echo "========================================"
npm run dev
echo ""
read -p "Press Enter to close this window..."
