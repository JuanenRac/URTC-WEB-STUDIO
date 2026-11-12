# Contributing to URTC-WEB-STUDIO 🌐

## Technology Stack
- **Framework**: React + Vite.
- **Hardware**: Web Serial API.

## Guidelines
1. **Serial Stability**: Use bounded buffers for incoming CAN frames to avoid browser memory saturation.
2. **Secure Context**: Ensure all features are tested in HTTPS environments.
3. **Compatibility**: Document any feature that requires specific Chromium flags.
4. **Documentation language**: the files in `docs/` are written in English only, on purpose: they are technical reference for developers, kept in one language so that a change is made once and cannot drift between eight copies. The README of each repository is the part that is translated into the eight languages.
