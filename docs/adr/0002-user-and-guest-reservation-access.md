# Authenticate reservation holders as Users or wishlist-scoped Guests

Wishlist accepts a Reservation from either an authenticated User or a Guest whose email address was verified for exactly one Wishlist. A User's existing Session is sufficient; a Guest receives a separate, time-limited Guest Session through an email magic link, and remains a Guest even when the verified address belongs to a User. This preserves reservation without registration without turning a magic link into passwordless User authentication or creating a global Guest account.

A Reservation has exactly one holder type, but holder identity is never exposed to the Wishlist owner or other visitors. At most one Reservation is active for a Wishlist Item; cancellation, owner release, and deletion move it to a terminal state rather than erasing its history. PostgreSQL must enforce the single-active-reservation invariant so concurrent API instances cannot reserve the same Item twice.
