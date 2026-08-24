# Wishlist Backend Development Plan

## Goal

Deliver one complete product path before expanding infrastructure:

1. a User signs up and creates a Wishlist;
2. the User adds Wishlist Items and shares the Wishlist;
3. another User or an email-verified Guest opens it;
4. that holder reserves and later cancels one Item without exposing their identity;
5. concurrent requests and process failure cannot create duplicate reservations or lose required email work.

The target is a production-grade modular monolith used as an iterative scale lab. Correctness, security, observability, and explicit failure handling are required from the relevant slice; microservices, caches, brokers, and search infrastructure enter only when a later milestone supplies a concrete boundary for them.

## Current repository state

Observed in the working code:

- `apps/api` uses Effect Platform, Effect Schema, PostgreSQL, Kysely, and Effect SQL;
- the running `AppApi` and live Layers expose only health and unauthenticated Users CRUD;
- auth request/response contracts, auth tables, validation tests, migration tests, and password-hash format parsing exist;
- production auth handlers, `AuthService`, repositories, hashing, cookie issuance, and Layer composition are not implemented or wired into `AppApi`;
- the generated database model contains only Users, Password Credentials, and Sessions;
- Wishlists, Wishlist Items, Sharing Links, Reservations, Guest Sessions, outbox jobs, images, notifications, and URL import are absent.

The `docs/auth/implementation-plan.md` “Current state” section predates migration `0002_auth.ts`; code is authoritative. Its Session contracts and hardening backlog remain useful, but every phase must re-check the installed Effect 4 RC APIs and current code before editing.

The old product sketch is not the technical plan. Fastify, Zod, JWT/refresh tokens, and nanoid are removed from the roadmap: the repository already chose Effect Platform/Schema, PostgreSQL-backed opaque Sessions in [ADR-0001](../adr/0001-postgresql-backed-sessions.md), and UUID internal IDs. Sharing Links receive their own cryptographically random public keys because they have a different lifecycle from internal entity IDs.

## Product model and invariants

The canonical vocabulary lives in [`CONTEXT.md`](../../CONTEXT.md).

### User and Public Profile

- A User has one required Display Name; the existing `firstName`/`middleName`/`lastName` shape is migrated through a clean cutover rather than retained beside it.
- Login email is private. It never appears in Public Profile or public Wishlist responses.
- Public Profile exposes Display Name and Public Wishlists.
- Birthday is removed from User. A Wishlist may instead have one optional, non-recurring, date-only Occasion Date.

### Wishlist

A Wishlist belongs to exactly one User and contains:

- required title;
- optional description;
- optional Occasion Date;
- visibility: `private`, `unlisted`, or `public`;
- one ISO currency shared by all optional Item prices;
- timestamps and a current Sharing Link key when direct sharing is enabled.

Visibility semantics:

- `private`: owner only;
- `unlisted`: anyone with the current Sharing Link;
- `public`: accessible directly and discoverable through the owner's Public Profile;
- changing to a less visible mode invalidates the current Sharing Link; the owner can rotate it explicitly as well;
- a future public catalog indexes only opt-in Public Wishlists. Unlisted and Private Wishlists never enter discovery.

There is no Archived Wishlist in the core model. Deletion is explicit and, when active Reservations exist, atomically ends them and schedules holder notifications after UI confirmation.

### Wishlist Item

A Wishlist Item is a user-owned snapshot with:

- required title;
- optional source URL;
- optional price in the Wishlist Currency, stored without floating-point arithmetic;
- priority `low | medium | high`, defaulting to `medium`;
- optional comment;
- optional service-owned image after the image milestone;
- timestamps.

Default order is priority descending, then stable creation order. Explicit price sorting supports ascending and descending order with missing prices last. No quantity, subtype hierarchy, manual rank, live marketplace dependency, or image is required in the core release.

### Reservation

- A holder is exactly one authenticated User or one Guest verified for that Wishlist.
- A logged-in User reserves with the existing User Session; no email link is required.
- A Guest requests an email magic link for one Wishlist. The link establishes a time-limited, Wishlist-scoped Guest Session and then attempts the Reservation atomically.
- If the email belongs to a User who is not logged in, the holder remains a Guest. Reservation magic links never become passwordless User login.
- At most one Reservation is active for a Wishlist Item. PostgreSQL, not an in-process check, owns this invariant.
- Holder identity is absent from owner and visitor projections. Only the holder and internal delivery code may access it.
- Active Reservations have no automatic expiry. They end when the holder cancels, the owner force-releases with confirmation, the Item/Wishlist is deleted, or the holder User is deleted.
- Ending a Reservation records a terminal reason instead of deleting history. Terminal records must be stripped of no-longer-needed personal data according to retention policy.
- Owner release and deletion schedule neutral Guest emails without revealing Guest identity to the owner.

See [ADR-0002](../adr/0002-user-and-guest-reservation-access.md).

### Durable background work

Required email and Import Preview work is persisted in PostgreSQL and claimed by separate worker processes. Handlers are idempotent because delivery is at least once. A message broker is a later gated migration, not an assumed improvement; see [ADR-0003](../adr/0003-postgresql-outbox-before-message-broker.md).

## Delivery roadmap

Each milestone is a complete vertical slice. Do not start the next milestone with known failures in the current one.

### Milestone 1 — Complete thin Session authentication

Purpose: replace public `userId` trust with an authenticated principal before adding ownership.

Work:

- replace structured nullable name fields with required Display Name across migration, schemas, contracts, tests, and public projection;
- keep internal authenticated User and Public Profile response schemas separate so email cannot leak into public endpoints;
- implement password hashing/verification behind an Effect service with bounded concurrency;
- implement credential and Session repositories;
- implement `AuthService` transactions for signup and login;
- implement signup, login, `me`, and idempotent logout handlers;
- issue the existing opaque Session credential through the agreed HTTP-only cookie;
- wire auth contracts, handlers, services, repositories, configuration, and Layers into the live application;
- remove credential-free public User creation and public cross-User CRUD; allow a User to read/update only their own private profile until an explicit admin use case exists.

Acceptance:

- signup atomically creates User, Password Credential, and Session;
- login creates a fresh concurrent Session;
- `me` authenticates only a valid unexpired cookie;
- logout revokes only the presented Session and expires the cookie;
- User A cannot read, update, or delete User B;
- a real Node HTTP cookie-jar scenario passes, not only an in-memory contract test.

### Milestone 2 — Owner-only Wishlists

Purpose: establish the aggregate and authorization boundary before sharing.

Work:

- add Wishlist persistence and runtime schemas for title, description, Occasion Date, visibility, and Wishlist Currency;
- implement owner-only create, list, read, update, and delete use cases;
- scope every repository mutation by both Wishlist ID and authenticated owner ID;
- keep list pagination and stable ordering explicit; add only visibility filtering needed by the current screen;
- return typed not-found, conflict, validation, and persistence failures through the existing Problem Details convention.

Acceptance:

- a User may own multiple Wishlists;
- another User cannot infer, read, update, or delete a Private Wishlist;
- date-only and money invariants are validated at HTTP and persistence boundaries;
- deletion is idempotent only if that is made explicit in the HTTP contract; do not accidentally conflate forbidden with absent.

### Milestone 3 — Sharing and Public Profiles

Purpose: add read access without weakening owner authorization.

Work:

- add Public Profile projection containing Display Name and Public Wishlists only;
- issue a high-entropy, URL-safe Sharing Link key distinct from the internal UUID;
- implement public read projection for Public and Unlisted Wishlists;
- enforce `private`, `unlisted`, and `public` visibility in one authorization policy;
- rotate/invalidate the Sharing Link on every transition to a less visible mode and through an explicit owner command;
- keep Sharing Link credentials out of logs, metrics, and error details.

Acceptance:

- Private is owner-only even with an old key;
- Unlisted is absent from Public Profile and readable only through its current key;
- Public appears on Public Profile and is readable directly;
- `public → unlisted` and either shared mode → `private` make the previous link unusable;
- public responses contain no email or reservation-holder data.

### Milestone 4 — Wishlist Items without enrichment

Purpose: complete the manually authored gift-list experience before external integrations.

Work:

- add Wishlist Item persistence and owner CRUD;
- validate optional HTTPS source URL independently of import support;
- model optional price in minor units or an equivalent exact decimal representation under the Wishlist Currency;
- implement priority-first default order and explicit priority/price sorting;
- expose owner and visitor projections without image or remote metadata dependencies.

Acceptance:

- a manual Item can be created with title only;
- owner authorization is enforced through the parent Wishlist;
- changing Wishlist Currency with priced Items is rejected until the User explicitly removes or converts those prices;
- price sorting is deterministic in both directions and places missing prices last;
- visitor reads never trigger outbound network requests.

### Milestone 5 — Reservation state machine for Users

Purpose: prove the concurrency invariant before introducing email identity.

Work:

- add Reservation state with exactly one holder type, active/terminal lifecycle, terminal reason, and timestamps;
- enforce one Active Reservation per Item with a PostgreSQL constraint/index suitable for concurrent API replicas;
- implement direct reserve/cancel for authenticated Users;
- implement owner force-release with confirmation;
- atomically end Active Reservations when an Item or Wishlist is deleted;
- expose only `free`, `reserved`, or `reservedByMe` in holder-aware projections.

Acceptance:

- two concurrent reserve attempts produce one success and one domain conflict;
- retrying a successful command cannot create a second Reservation;
- only the holder can cancel;
- the owner can release but cannot retrieve holder identity;
- terminal history no longer blocks a later Reservation.

### Milestone 6 — Guest access and transactional email

Purpose: complete the “open by link without registration” journey without losing email work.

Work:

- add short-lived, single-use Guest verification challenges with digest-only credentials;
- add Wishlist-scoped Guest Sessions with digest-only cookie credentials and fixed expiry;
- add PostgreSQL outbox/job persistence and a separate worker entry point;
- provide a local email adapter such as a capture inbox and a production provider behind the same Effect service;
- request a magic link without reserving or temporarily holding the Item;
- on link use, consume the challenge, establish the Guest Session, and atomically attempt the Reservation;
- add Guest cancellation, owner release email, and Item/Wishlist deletion email;
- purge short-lived raw delivery payloads and never log credentials or recipient addresses.

Acceptance:

- requesting a link never blocks an Item;
- if another holder reserves first, clicking the link establishes Guest access but reports a Reservation conflict;
- a Guest sees `reservedByMe` only inside the verified Wishlist and can cancel only their Reservations;
- a Guest Session for Wishlist A grants no access in Wishlist B;
- an address belonging to a User still produces Guest access when no User Session is presented;
- committing a lifecycle transition and its required outbox row is atomic;
- worker crash/retry cannot send a logically different command or duplicate a terminal transition.

This milestone completes the first product path.

### Milestone 7 — External-user security gate

Purpose: make the completed path safe for users outside a controlled development group.

Work, in dependency order:

- CSRF/origin policy for cookie-authenticated unsafe methods and explicit credentialed CORS;
- rate limits and enumeration-resistant responses for signup, login, Guest links, and password reset;
- Session expiry cleanup, revoke-all, and safe operational metrics;
- password change and single-use password reset;
- verified email ownership for recovery and email change; changing login email requires verification of the new address and an explicit Session-revocation policy;
- User deletion: end active holder Reservations, delete owned Wishlists through their notification lifecycle, erase profile/credentials/Sessions/email, and retain only anonymized terminal audit data;
- TLS/Secure-cookie deployment checks, security headers, backup/restore exercise, and PII-safe structured audit events.

Acceptance:

- the security scenarios in `docs/auth/implementation-plan.md` pass against the live topology;
- abuse controls execute before expensive hashing or outbound email;
- deleting a User leaves no usable Session, credential, public profile, active Reservation, or retained email outside a documented short delivery/backup window;
- required cancellation emails survive a worker restart.

### Milestone 8 — Service-owned images

Purpose: add one trusted image boundary before importing remote images.

Work:

- add S3-compatible object storage with MinIO for local development and a production-compatible provider;
- implement manual upload with byte, dimension, content-type, and magic-byte limits;
- strip unsafe metadata and generate controlled variants if the UI needs them;
- store immutable asset keys and serve through a controlled URL/cache policy;
- delete or retain orphaned assets through an explicit lifecycle job.

Acceptance:

- disguised or oversized files are rejected before persistence;
- replacing/deleting an Item cannot leak orphaned private assets indefinitely;
- public image reads do not disclose storage credentials;
- two API replicas observe the same asset state.

### Milestone 9 — Asynchronous URL Import Preview

Purpose: add convenient enrichment without making marketplaces part of the Item read/write availability path.

Use [ADR-0004](../adr/0004-asynchronous-best-effort-url-import.md) and the [marketplace research](./research/marketplace-url-import.md).

Work:

- add a curated provider registry with exact HTTPS hosts and product-path rules;
- create short-lived Import Preview jobs returning `202 Accepted` and a polling contract; add SSE only if polling becomes a measured UX problem;
- run fetches in restricted workers with DNS/address validation, redirect revalidation, strict time/byte/decompression limits, and no ambient credentials;
- parse validated Open Graph/JSON-LD as untrusted suggestions;
- finish every unsupported, challenged, ambiguous, or failed fetch with manual-entry guidance rather than failing Item creation;
- let the User apply selected title, price, description, and image fields;
- copy an accepted remote image through the image pipeline instead of retaining a hotlink;
- implement explicit refresh as a new preview/diff; never silently overwrite the Item snapshot.

Acceptance:

- internal, loopback, metadata-service, redirect, DNS-rebinding, oversized, decompression-bomb, and non-HTML cases are rejected;
- provider timeout does not hold an Item transaction or make existing Items unreadable;
- applying a preview is authorized, idempotent, and cannot overwrite a newer User edit without an explicit version check;
- all provider failures preserve the normalized source URL and manual workflow;
- deterministic tests use controlled HTTP fixtures, not live marketplace pages.

## Scale-lab iterations

These are ordered experiments around the working product, not prerequisites for it.

### Iteration A — Multi-instance correctness

Run at least two API containers and two worker containers against one PostgreSQL database. Exercise concurrent Reservation, Sharing Link rotation, outbox claiming, and duplicate delivery. Database constraints and idempotency must remain the source of correctness; process-local locks are not acceptable.

### Iteration B — Observability and load model

Instrument request latency, error categories, database pool saturation, Reservation conflicts, outbox lag, worker attempts, email outcomes, import latency, and external-fetch failure classes without recording credentials or PII. Define a small workload from real journeys and establish a baseline before adding infrastructure.

### Iteration C — Read scaling only after evidence

Start with query plans, indexes, pagination, HTTP caching where visibility allows it, and bounded projections. Add Redis or another cache only when a measured read hotspot remains and write down invalidation ownership first. Cache must never turn a Private or rotated Unlisted Wishlist into publicly readable stale data.

### Iteration D — Opt-in public catalog

The future catalog indexes Public Wishlists and Public Profiles only. Start with PostgreSQL search if it satisfies the measured corpus and query shape. Before public launch, add reporting, moderation, blocking, abuse limits, and explicit removal from the index when visibility changes.

A dedicated search engine and event stream become justified when index workload, query capability, or independent consumers exceed the PostgreSQL approach. Visibility reduction is a high-priority deletion event; stale Public data must not remain discoverable.

### Iteration E — Broker and social graph gates

A broker becomes preferable when outbox contention, sustained throughput, fan-out, replay needs, or independent consumer isolation are measured. Migrate the transport behind idempotent event contracts; do not dual-write PostgreSQL and a broker outside one established delivery pattern.

Friends/followers are a later product, not a prerequisite for catalog search. Before adding them, define request, acceptance, removal, blocking, profile visibility, and feed rules. Do not overload Sharing Link authorization with social relationships.

## Explicit scope decisions

### Removed from the plan

- Fastify, Zod, JWT access/refresh tokens, and nanoid as required technologies;
- public login email;
- User birthday;
- public or owner-visible Reservation holder names;
- quantity and multiple active Reservations per Item;
- automatic Reservation expiry;
- marketplace-specific browser automation or undocumented private APIs;
- authoritative periodic overwriting of Item metadata;
- external image hotlinks in permanent Item reads.

### Deferred until after the first product path

- password reset/change, User deletion, and the full external-user security gate;
- images and manual upload;
- URL Import Preview and refresh;
- owner reserve/cancel emails, notification center, and Occasion reminders;
- Wishlist archive and rich personal-list filtering;
- price observations/alerts;
- public catalog, moderation, search engine, event streaming, and social graph;
- Kubernetes, microservices, and a separate broker.

Frontend landing, real-time form validation, clipboard interaction, and theme selection are independent UI work. They do not change the backend milestone order.

## Verification rule for every milestone

Start with the narrowest changed contract, then run only checks relevant to the slice:

```bash
pnpm --filter @wishlist/api check-types
pnpm --filter @wishlist/api lint
pnpm --filter @wishlist/api test
pnpm --filter @wishlist/api build
pnpm --filter @wishlist/api db:check
```

Database changes require migration/invariant tests. HTTP cookie, Sharing Link, email, object-storage, and multi-instance behavior require real process-level smoke scenarios because in-memory handler tests cannot prove transport or topology. Every permanent feature test must defend an observable invariant; generated tests are useful for broad invariants only when their generators remain simpler than the behavior.

## Learning checkpoint

After each vertical milestone, explain in plain language:

1. which state exists before and after the command;
2. which database constraint owns each invariant;
3. which Effect service and Layer own each side effect;
4. what happens on success, typed failure, defect, interruption, and retry;
5. which observable check would fail if the invariant were removed.
