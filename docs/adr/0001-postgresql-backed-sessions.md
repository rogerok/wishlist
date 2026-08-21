# Store sessions server-side in PostgreSQL

Wishlist uses opaque, server-side Sessions stored in PostgreSQL instead of self-contained JWT access tokens. This makes logout, immediate revocation, fixed expiration, and multiple concurrent Sessions explicit and authoritative on the server; the trade-off is a database lookup during authenticated requests and periodic cleanup of expired Sessions. The client receives a random credential in an HTTP-only cookie, while PostgreSQL stores only its cryptographic digest so that disclosure of the Sessions table does not directly disclose active credentials.
