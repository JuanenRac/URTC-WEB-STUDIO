<!-- =============================================================================
URTC-WEB-STUDIO - Integration contract
Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
GPL-3.0-or-later - see LICENSE
============================================================================= -->

# Integration Contract

The UI consumes versioned API responses and displays their stated connection
and execution status. A client must reject an unknown schema, missing target
identity, malformed result or absent authentication context. Retryable network
failure and an actual test/flash failure are separate states.

Real flash authority, signing and target confirmation remain server-side or in
the dedicated desktop tools; this browser client never treats a cached result
as a live operation.
