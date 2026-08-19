#!/bin/bash
# =============================================================================
# URTC Web Studio - Build and Compile Script
# Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
# GPL-3.0 - see LICENSE
# =============================================================================

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
