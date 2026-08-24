# Wishlist

Wishlist manages User-owned Wishlists and private gift coordination through User or Wishlist-scoped Guest access.

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

**Public Profile**:
The externally visible representation of exactly one User and the discovery surface for that User's Public Wishlists.
_Avoid_: User record, account page

**Wishlist**:
A collection owned by exactly one User and shared according to its visibility.
_Avoid_: List, gift list

**Private Wishlist**:
A Wishlist visible only to its owner.
_Avoid_: Closed Wishlist

**Unlisted Wishlist**:
A Wishlist visible to anyone who possesses its current sharing link, but not exposed through its owner's Public Profile.
_Avoid_: Public-by-link Wishlist

**Public Wishlist**:
A Wishlist discoverable through its owner's Public Profile and visible without receiving a sharing link from the owner.
_Avoid_: Open Wishlist

**Occasion Date**:
An optional, non-recurring calendar date associated with one Wishlist rather than with its owner.
_Avoid_: Birthday, event timestamp

**Guest**:
A person who is not registered as a User and whose email address has been verified for access to one Wishlist.
_Avoid_: Friend, anonymous User

**Guest Session**:
A time-limited relationship between a client, one verified Guest email address, and exactly one Wishlist.
_Avoid_: Guest account, User Session

**Sharing Link**:
The current revocable URL for direct access to an Unlisted or Public Wishlist. It is invalidated whenever the Wishlist becomes less visible.
_Avoid_: Permalink, public link

**Wishlist Item**:
A user-owned snapshot of one gift idea within exactly one Wishlist. Imported external metadata may seed the snapshot but does not own it.
_Avoid_: Position, Product, Gift

**Wishlist Currency**:
The single currency in which all optional Wishlist Item prices in one Wishlist are expressed.
_Avoid_: Item currency

**Reservation**:
An exclusive intention by exactly one User or Guest to give one Wishlist Item. At most one Reservation is active for an Item, and the holder's identity is not exposed to the owner or other visitors.
_Avoid_: Order, booking

**Import Preview**:
A short-lived, untrusted proposal of metadata derived from a Wishlist Item source URL. Applying a preview copies only User-selected values into the user-owned Wishlist Item snapshot.
_Avoid_: Synced Product, live card

**Display Name**:
The User-chosen name shown on the User's Public Profile and Public or Unlisted Wishlists. It is not a structured or legal name.
_Avoid_: First name, full name

**Active Reservation**:
The sole Reservation currently blocking a Wishlist Item from other holders. It has no automatic expiry and ends only through an explicit lifecycle transition.
_Avoid_: Current order, reserved flag
