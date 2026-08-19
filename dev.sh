#!/bin/bash
# =============================================================================
# URTC Web Studio - Development Server Start Script
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0 - see LICENSE
# =============================================================================

echo "========================================"
echo " Installing dependencies... "
echo "========================================"
npm install

echo "========================================"
echo " Starting URTC Web Studio (Dev Mode) "
echo "========================================"
npm run dev
