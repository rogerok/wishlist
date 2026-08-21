# Wishlist

Wishlist manages people who own personal wish lists and the authenticated relationships through which they use the application.

## Language

**User**:
A person registered in Wishlist and represented by a public profile.
_Avoid_: Account, identity record

**Password Credential**:
A secret proof associated with exactly one User that can establish the User's identity. It is distinct from the User's public profile.
_Avoid_: Password record, auth data

**Session**:
A time-limited authenticated relationship between a client and exactly one User. A Session may be created after a Password Credential proves identity, but it is not linked to that Credential; a User may have multiple concurrent Sessions.
_Avoid_: Token, login
