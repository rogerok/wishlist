# PostgreSQL Session Authentication Plan

## Goal

Implement a small, complete authentication slice in `apps/api` using Effect 4, PostgreSQL-backed Sessions, and HTTP-only cookies:

- `POST /api/auth/signup`;
- `POST /api/auth/login`;
- `GET /api/auth/me`;
- `POST /api/auth/logout`.

The first milestone is intentionally smaller than a production authentication system, but it must already preserve the core security invariants. Production hardening is an ordered backlog, not hidden scope inside the first milestone.

## Current state

Observed in the working code:

- `apps/api` uses `effect`, `@effect/platform-node`, and `@effect/sql-pg` `4.0.0-rc.108`;
- HttpApi, HTTP, and SQL APIs are imported from unstable Effect 4 entry points;
- only the `users` table exists; no password credential, Session, cookie, or hashing implementation exists;
- `POST /api/users` currently creates a User without a Password Credential;
- all existing users CRUD endpoints are public;
- `users.role` exists in PostgreSQL but is not selected or used for authorization;
- CORS credentials default to `false`;
- the existing module convention is Schema/HttpApi → handlers → `Context.Service` → repository → Kysely/Effect SQL;
- the existing HTTP error format is Problem Details;
- the workspace already contains a PostgreSQL Testcontainers pattern in `packages/sql-kysely/tests/pg.test.ts`.

Consequences:

1. `/api/auth/signup` becomes the canonical public operation for creating a User.
2. `POST /api/users` must not remain a public credential-free alternative. Preserve it only for a later administrative use case.
3. Session auth alone does not secure the existing users CRUD. Its authorization rules are the first hardening milestone after authentication.

## Agreed contracts

### Signup

```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.test",
  "password": "Password1!",
  "passwordConfirm": "Password1!",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "middleName": null
}
```

All seven JSON keys are required. `firstName`, `lastName`, and `middleName` accept `string | null`; a missing key is invalid rather than normalized to `null`. `passwordConfirm` must equal `password`, exists only at the HTTP boundary, and is never persisted or logged. Excess properties are rejected. `UserEmailSchema` preserves the existing email normalization behavior.

Success:

- `201 Created`;
- body: the existing public `UserResponse` shape;
- a new `wishlist_session` cookie.

The operation atomically creates a User, Password Credential, and Session. Any failed insert rolls back all three.

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.test",
  "password": "Password1!"
}
```

Success:

- `200 OK`;
- body: public `UserResponse`;
- a newly generated Session and `wishlist_session` cookie.

Every successful login creates a fresh Session. An existing cookie is never reused or upgraded.

### Me

```http
GET /api/auth/me
Cookie: wishlist_session=<opaque-token>
```

Success: `200 OK` with public `UserResponse`.

Missing, malformed, unknown, or expired Session credentials produce the same public `401` contract.

### Logout

```http
POST /api/auth/logout
Cookie: wishlist_session=<opaque-token>
```

Success: `204 No Content` and an expired `wishlist_session` cookie.

Logout is idempotent:

- an existing Session is physically deleted;
- only the current Session is deleted;
- a missing, unknown, or already expired Session still returns `204`;
- a PostgreSQL failure while resolving or deleting a presented well-formed credential returns `503` rather than claiming successful revocation.

Use Effect's `expireCookie` behavior. `removeCookie` only changes the response under construction and does not instruct a browser to delete its stored cookie.

## Public errors

Continue using the repository's Problem Details convention.

| Situation                                                | HTTP result                                    |
| -------------------------------------------------------- | ---------------------------------------------- |
| Invalid request body                                     | `400`                                          |
| Email already registered during signup                   | `409`                                          |
| Unknown email or wrong password during login             | one generic `401 Invalid credentials`          |
| Missing, malformed, unknown, or expired Session on `/me` | one generic `401`                              |
| PostgreSQL unavailable                                   | `503`                                          |
| Invalid internal database record/invariant violation     | generic `500`; details only in structured logs |

Never place passwords, raw Session tokens, Password Credential hashes, or cookie values in logs, error causes exposed to clients, tracing attributes, or test snapshots.

## Persistence model

Add a new migration after `apps/api/src/db/migrations/0001_initial.ts`, then regenerate `apps/api/src/db/generated/database.ts` using the project's generator. Do not edit the generated file by hand.

### `password_credentials`

| Column          | Constraint                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------ |
| `user_id`       | UUID primary key; FK → `users.id`; `ON DELETE CASCADE`                                     |
| `password_hash` | text, not null; contains algorithm, format version, cost parameters, salt, and derived key |
| `created_at`    | timestamp(3) with time zone, not null; `DEFAULT now()`                                     |
| `updated_at`    | timestamp(3) with time zone, not null; `DEFAULT now()`                                     |

There is exactly one Password Credential per User in the first version. Keeping it outside `users` prevents profile queries from accidentally selecting sensitive authentication material and gives password changes their own lifecycle.

### `sessions`

| Column         | Constraint                                                               |
| -------------- | ------------------------------------------------------------------------ |
| `id`           | UUID primary key; `DEFAULT gen_random_uuid()`                            |
| `user_id`      | UUID, not null; FK → `users.id`; `ON DELETE CASCADE`                     |
| `token_digest` | bytea, not null, unique; `CHECK (octet_length(token_digest) = 32)`       |
| `created_at`   | timestamp(3) with time zone, not null; `DEFAULT now()`                   |
| `expires_at`   | timestamp(3) with time zone, not null; `CHECK (expires_at > created_at)` |

PostgreSQL supplies the initial `created_at` and `updated_at` values. The application must provide `expires_at` and must update `password_credentials.updated_at` explicitly when the stored password hash changes; a default does not run on `UPDATE`. Because Session `created_at` and `expires_at` come from different clocks, clock skew between PostgreSQL and the application is possible. A sufficiently slow application clock can make an otherwise intended Session violate `expires_at > created_at`; deployment therefore assumes synchronized clocks and a Session lifetime much larger than plausible skew.

Indexes:

- unique index supplied by `token_digest` uniqueness for authentication lookup;
- index on `user_id` for listing/revoking a User's Sessions later;
- index on `expires_at` for cleanup.

A Session is valid only when its row exists and `expires_at` is later than the current application time. Expired rows never authenticate, even before the cleanup job removes them.

Do not add `last_seen_at`, `revoked_at`, user-agent metadata, IP addresses, or a `remember_me` flag in the first migration. Each Session already owns `expires_at`; future `remember me` only chooses a different expiration.

## Cryptographic invariants

### Passwords

Use asynchronous `node:crypto.scrypt`, never `scryptSync` on the request path.

- input length: 8–100 characters;
- require at least one lowercase ASCII letter, one uppercase ASCII letter, one digit, and one permitted special character;
- accept only ASCII letters, digits, and the punctuation whitelist encoded by `PasswordSchema`; reject whitespace and other characters;
- do not trim or silently truncate the password;
- generate a fresh 16-byte random salt for every Password Credential;
- derive a 32-byte key;
- store the exact canonical format `$scrypt$v=1$N=131072,r=8,p=1$<salt-base64url>$<derived-key-base64url>`;
- encode salt and derived key as unpadded canonical base64url; the encoded lengths are 22 and 43 characters respectively;
- accept only the exact algorithm, version, field order, `N/r/p`, encoding, and decoded byte lengths defined for `v=1`;
- reject missing or extra segments, unsupported versions or parameters, non-canonical encoding, and incorrect byte lengths before invoking scrypt;
- compare equal-length derived keys with `timingSafeEqual`;
- map every malformed or unsupported stored hash to a typed internal data-integrity failure; a well-formed hash with a password mismatch returns `false`.

This milestone policy is an explicit local learning contract, not a claim of alignment with current NIST password guidance. NIST SP 800-63B-4 recommends a 15-character minimum for passwords used as a single authentication factor, support for at least 64 characters, and no composition rules. Revisit the local 8–100 composition policy in the P1 password-lifecycle work before production use.

OWASP's current minimum for scrypt is `N = 2^17`, `r = 8`, `p = 1`. Treat this as a starting security floor, explicitly configure sufficient `maxmem`, and benchmark the asynchronous operation on the deployment hardware before freezing parameters. The stored format must permit later rehashing with stronger parameters.

`maxmem` is an execution guard rather than a KDF output parameter and is not stored in the password-hash string. Future parameter upgrades add another explicitly supported format/version or parameter allow-list entry; verification must never pass arbitrary database-controlled `N/r/p` values to scrypt.

### Hashing admission and concurrency

Asynchronous `crypto.scrypt` runs in Node's fixed libuv worker pool. This avoids executing the hash on the JavaScript event loop, but it does not make concurrency or memory usage unboundedly safe.

- estimate one scrypt workspace as approximately `128 * N * r` bytes before runtime overhead; with `N = 2^17` and `r = 8`, this is about 128 MiB per active operation;
- treat `maxmem` as a per-operation check, not a process-wide memory limit;
- choose `maxConcurrentHashes` from an explicit process memory budget and measured latency/RSS;
- construct the hashing Semaphore once in the live Layer and guard every hash and verify operation with that process-local instance;
- bound admitted work separately: a Semaphore limits active Effect work but can still accumulate waiting fibers, and a timeout alone does not cap their number;
- prefer an explicit total admission capacity with immediate typed overload when full; if a waiting queue is retained, its capacity must be `maxWaitingHashes`;
- keep capacity ownership aligned with the native scrypt lifetime. Public Node `crypto.scrypt` has no cancellation handle: interrupting `Effect.callback` does not stop the already submitted libuv job, so a naive interruptible wrapper can release a permit while native work still consumes memory;
- release permits automatically on success, typed failure, defect, interruption before native start, and only after the native callback for work that has already started;
- treat a dedicated worker process as optional isolation, not as a replacement for concurrency limits; never place plaintext passwords in a durable external queue;
- remember that horizontal replicas multiply the total active hashing limit.

Rate limiting is a separate admission control before hashing. It protects both online credential guessing and resource-exhaustion attacks; it does not protect offline cracking after a database leak.

SHA-256 is suitable for random Session tokens but not for human-chosen passwords.

### Session credential

- generate 32 random bytes with Node's cryptographically secure generator; Effect `Random` is based on `Math.random` and is not suitable;
- encode the client value as unpadded base64url, producing 43 characters for 32 bytes;
- compute SHA-256 over the original raw bytes, not over the base64url text;
- keep the digest as exactly 32 binary bytes for PostgreSQL;
- return the raw token only through `Set-Cookie`;
- wrap password and raw-token service boundaries in `Redacted`, understanding that `Redacted` prevents accidental display but is neither encryption nor hashing;
- reveal a redacted value only inside the smallest crypto or cookie boundary and never include secrets, stored hashes, salt, or derived keys in logs, error fields, tracing attributes, or snapshots.

Keep an internal Session `id` separate from the credential digest. The id supports future Session management without exposing the credential.

## Cookie policy

```text
Name:     wishlist_session
HttpOnly: true
Secure:   true in production
SameSite: Lax
Path:     /api
Domain:   omitted
Max-Age:  604800 seconds
Expires:  creation time + 7 days
```

Omitting `Domain` creates a more restrictive host-only cookie. `Secure` is selected by typed application configuration; business logic must not inspect `process.env` directly.

The intended production topology is same-origin. Local frontend development should use a dev proxy. If direct cross-origin browser access is introduced instead, configure an explicit allowed origin, credentialed CORS on both client and server, and revisit the CSRF model. Never combine credentialed CORS with wildcard `Access-Control-Allow-Origin`.

Effect's `securitySetCookie` defaults only `secure` and `httpOnly`; the path, SameSite policy, and expiration remain application decisions and must be supplied explicitly.

## Effect design

### Dependency graph

```text
HttpApi contract
    ↓
Auth handlers
    ↓
AuthService
    ├── UsersRepository
    ├── PasswordCredentialsRepository
    ├── SessionsRepository
    ├── PasswordHasher
    ├── SessionTokenGenerator
    └── Clock
```

Recommended responsibilities:

- **HttpApi schemas**: decode external input and encode success/error contracts.
- **Handlers**: adapt HTTP to use cases, set/expire cookies, and translate typed use-case errors into Problem Details.
- **AuthService**: own signup, login, Session resolution, and logout use cases; own the signup transaction boundary.
- **UsersRepository**: persist and load the public User profile; it must not select Password Credential data in normal profile operations.
- **PasswordCredentialsRepository**: insert and load the sensitive credential record.
- **SessionsRepository**: insert, resolve by digest, and delete Sessions.
- **PasswordHasher**: hide scrypt format creation, parsing, derivation, and constant-time comparison behind a small Effect service.
- **SessionTokenGenerator**: generate the raw credential and digest as one value, avoiding repeated exposure of the raw token.
- **Clock**: supply the current time so expiration behavior is deterministic in tests.
- **security middleware**: resolve a cookie credential and provide `AuthenticatedSession` through Effect Context to protected handlers.

`AuthenticatedSession` contains the safe User representation, internal Session id, and expiration. It never contains the Password Credential or raw Session token.

Use `HttpApiSecurity.apiKey({ key: "wishlist_session", in: "cookie" })`. In the installed Effect version, missing or invalid cookie decoding becomes an empty `Redacted<string>`; the required middleware must explicitly reject that value with the typed unauthenticated error.

`/logout` needs an optional credential flow: no cookie is a successful no-op, while a presented token is digested and passed to `AuthService.logout`. Do not weaken the required middleware for `/me` merely to reuse it for logout.

### Layer composition

Follow existing composition rather than introduce a second dependency-injection convention:

1. live repositories depend on the existing DB services;
2. `PasswordHasherLive`, `SessionTokenGeneratorLive`, and cookie configuration are Layers;
3. `AuthServiceLive` is provided its repositories and security primitives;
4. auth handlers and security middleware depend on `AuthService`;
5. the auth module joins `AppServicesLive` in `apps/api/src/app.ts`;
6. its HttpApi group and handlers join `AppApi`/`AppApiLive`.

The entry point assembles live dependencies. Handlers, services, and repositories do not create global connections or read environment variables.

### Transaction boundary

`AuthService.signup` owns one `SqlClient.withTransaction` operation:

```text
BEGIN
  insert User
  insert Password Credential
  insert Session
COMMIT
```

Only after successful completion should the handler register the Session cookie in the response. Any failure rolls back the complete signup operation.

Do not put the transaction in the handler. Do not create one repository that knows all three tables merely to hide the transaction.

## Implementation sequence

Each phase ends in observable behavior. Do not build every interface first and postpone the vertical path until the end.

### 1. Freeze contracts with schemas

Study companion: [Phase 1 sources and exercise](./research/primary-sources.md#1-freeze-contracts-with-schemas).

- add auth path constants and an HttpApi group;
- add signup/login request schemas and public response/error schemas;
- reuse `UserEmailSchema` and `UserResponseSchema`;
- add the explicit 8–100 password boundary and composition validation without trimming;
- encode the four status/body contracts listed above.

Check: type-check the API contract and write focused encoding/decoding examples for 7/8/100/101-character passwords, missing character categories, whitespace, malformed email, required signup keys, password confirmation, and excess fields.

### 2. Add persistence schema

Study companion: [Phase 2 sources and exercise](./research/primary-sources.md#2-add-persistence-schema).

Migration policy for Phase 2: keep the current Effect `PgMigrator` forward-only. Verify the complete migration chain against a fresh disposable PostgreSQL database. `db:down` controls Docker Compose and is not a schema rollback command.

TODO (migration infrastructure, outside Phase 2): evaluate and implement first-class rollback support before any workflow claims to support `down` migrations.

- create the migration for `password_credentials` and `sessions`;
- add FK actions, uniqueness, and indexes;
- regenerate Kysely database types;
- verify the complete migration chain from zero using the existing forward-only database workflow.

Check against a fresh disposable PostgreSQL database: apply the complete migration chain, run `pnpm --filter @wishlist/api db:check`, and run a migration-backed test proving cascade and uniqueness behavior.

### 3. Implement security primitives

Study companion: [Phase 3 sources and exercise](./research/primary-sources.md#3-implement-security-primitives). Complete [bounded password hashing](./lessons/0002-bounded-password-hashing.html) before implementing the live hashing Layer.

#### Scope and stop boundary

Phase 3 owns only:

- canonical password-hash formatting and defensive parsing;
- asynchronous scrypt derivation and verification;
- process-local hashing admission and concurrency;
- secure Session-token generation and digesting;
- typed primitive-level failures;
- live and deterministic test Layers required by those primitives.

Do not add repositories, database access, HTTP handlers, signup/login behavior, cookies, middleware, schema migrations, rate limiting, dummy login hashing, or clock/expiration logic. `Clock` first becomes relevant when Session lifetime behavior is implemented.

#### Fixed contracts

Password hashing uses:

```text
algorithm:   scrypt
format:      v1
N:           131072 (2^17)
r:           8
p:           1
salt:        16 random bytes
derived key: 32 bytes
storage:     $scrypt$v=1$N=131072,r=8,p=1$<salt-base64url>$<derived-key-base64url>
```

Both binary fields use unpadded canonical base64url. The `v1` parser accepts only the fixed values above. A future upgrade must add an explicit supported case; it must not broaden parsing to arbitrary database-controlled resource parameters.

`PasswordHasher` receives the password through `Redacted`. Hash creation returns the canonical stored value. Verification returns `true` for a match and `false` for a well-formed hash with a mismatch. A malformed or unsupported stored value is a typed integrity failure, not `false` and not a defect.

`SessionTokenGenerator` returns one value containing:

- a raw credential represented at the service boundary as `Redacted<string>`;
- the SHA-256 digest of the original 32 random bytes as a 32-byte binary value.

The base64url representation is for the client; PostgreSQL receives only the binary digest. Decoding is strict and canonical where a public token is later accepted: Node's base64url decoder is intentionally permissive and cannot be the only validator.

#### Dependency and Layer shape

Follow the existing `Context.Service` plus `Layer.effect` convention:

- construct process-local state once while building the live Layer;
- do not create a Semaphore inside each `hash` or `verify` call;
- do not read `process.env` inside security services;
- validate configured capacities as positive integers before passing them to the rc.108 Semaphore, which does not enforce that invariant itself;
- use Node crypto for production random bytes; never use the default Effect `Random` for secrets;
- provide deterministic random bytes in tests through one minimal dependency used by salt and Session-token generation;
- keep the low-level native derivation seam small enough to test failure, interruption, and active-operation counts without replacing the public service behavior with mocks.

The entry point will compose the completed live Layers in a later integration step. Phase 3 tests provide the primitive Layers directly and do not require PostgreSQL or HTTP.

#### Typed failure boundaries

Keep these observable cases distinct:

1. malformed or unsupported stored hash — internal integrity failure;
2. well-formed hash and wrong password — successful `false`;
3. native scrypt or secure-random operational failure — typed primitive-unavailable failure;
4. full admission capacity — typed hashing-overload failure;
5. interruption before admission or before native start — interruption, with no leaked capacity;
6. interruption after native start — capacity remains owned until the native callback because public Node scrypt cannot be cancelled.

Error values may carry an opaque `cause: unknown`, but must never contain password, stored hash, raw Session token, salt, or derived key.

#### Interruption invariant

`Effect.callback` can stop waiting and ignore a late callback, but it cannot cancel `crypto.scrypt`. Therefore the implementation must not equate requester-fiber lifetime with native-job lifetime.

Before the concurrency implementation, resolve the exact ownership strategy recorded in `NOTES.md`. The recommended first implementation keeps the admitted native region uninterruptible until its callback completes: admission waiting remains interruptible, interruption after native start is deferred, and permits are released only after memory-intensive work has actually ended. A supervised detached native-job lifetime is an alternative only if prompt requester interruption is required and its extra ownership complexity is justified.

#### Bounded admission invariant

A single execution Semaphore is insufficient because its waiter set is unbounded. The recommended design uses:

1. an admission Semaphore with `maxConcurrentHashes + maxWaitingHashes` permits, acquired through `withPermitsIfAvailable`;
2. an execution Semaphore with `maxConcurrentHashes` permits around native scrypt;
3. immediate typed overload when the admission Semaphore returns `Option.none`.

The admission permit covers both waiting and execution. A waiting-time timeout may be added for latency policy, but it is not a substitute for the capacity bound. Final capacity values remain unset until benchmark evidence is recorded.

#### Small implementation iterations

Implement and review one observable invariant at a time:

1. **Stored format.** Add the canonical serializer/parser and typed integrity error. Test round trip, missing/extra segments, algorithm/version/parameter rejection, canonical base64url, and exact decoded lengths. Do not invoke crypto on malformed input.
2. **Secure bytes and Session token.** Add the minimal secure-random dependency, live Node implementation, deterministic test Layer, 32-byte token generation, base64url encoding, and SHA-256 of raw bytes. Test byte/string/digest lengths, deterministic digest, and production non-determinism without asserting a fixed production value.
3. **Async scrypt adapter.** Wrap callback-based `crypto.scrypt` with `Effect.callback`; capture both synchronous argument throws and callback errors in the typed channel. Do not use `scryptSync` or a Promise wrapper that hides cancellation semantics.
4. **PasswordHasher behavior.** Compose fresh salt, fixed production parameters, serializer/parser, derivation, and `timingSafeEqual`. Test success, mismatch, same-password/different-salt behavior, and malformed format.
5. **Benchmark decision gate.** Measure latency and RSS for one hash and verify, then concurrency 2 and any candidate limit. Record the process memory budget, chosen `maxmem`, `maxConcurrentHashes`, and `maxWaitingHashes` before freezing live configuration.
6. **Admission and interruption.** Add shared admission/execution Semaphores and typed overload. Prove active native operations never exceed permits; admitted work never exceeds total capacity; permits return after success/failure; waiting interruption removes the waiter; interruption after native start cannot allow replacement work before the native callback.
7. **Layer and regression check.** Assemble live/test Layers, run narrow behavior tests, then API type-check, relevant lint, and the complete API test suite.

Do not combine two iterations merely because their files are adjacent. After every iteration, inspect semantic errors before formatting concerns and run only the narrow check that proves its invariant.

#### Required behavior tests

- one password hashed twice produces different stored values; both verify;
- wrong password returns `false`;
- malformed/unsupported stored values fail with the exact integrity tag;
- equal-length comparison is enforced before `timingSafeEqual`;
- production salts and Session tokens are not deterministic;
- deterministic random test Layer produces stable token digest without logging the raw token;
- Session token decodes to 32 bytes, its text is canonical 43-character base64url without padding, and its digest is 32 bytes;
- active native scrypt operations never exceed `maxConcurrentHashes`;
- total admitted operations never exceed `maxConcurrentHashes + maxWaitingHashes`;
- overload is a typed failure and rejected work never starts;
- permits return after success and typed/native failure;
- interrupted waiters do not leak admission capacity;
- interruption after native start does not release execution capacity before callback completion.

Tests must not log or snapshot password, stored hash, raw Session token, cookie value, salt, or derived key. Synthetic byte fixtures may be asserted only where the value itself is necessary to prove encoding or digest behavior.

#### Benchmark record

The benchmark must record:

- Node version and relevant libuv pool configuration;
- `N/r/p`, candidate `maxmem`, salt/key lengths;
- baseline RSS;
- latency and peak/observed RSS for hash and verify at concurrency 1;
- the same observations at concurrency 2 and the selected limit;
- the explicit memory budget available to hashing;
- the resulting live `maxConcurrentHashes` and `maxWaitingHashes`.

Do not infer safe concurrency from `UV_THREADPOOL_SIZE`: increasing the worker pool is not a process memory limit.

#### Phase 3 definition of done

Phase 3 is complete only when:

- every fixed contract and behavior test above is implemented;
- benchmark evidence justifies `maxmem` and both admission capacities;
- native scrypt lifetime, Effect interruption, and permit lifetime agree;
- all secret-bearing boundaries use `Redacted` as specified;
- primitives run without PostgreSQL and HTTP;
- `pnpm --filter @wishlist/api check-types` passes;
- relevant API lint passes;
- narrow security tests and the complete API test suite pass;
- no unresolved Phase 3 decision remains in `NOTES.md`.

### 4. Implement repositories

Study companion: [Phase 4 sources and exercise](./research/primary-sources.md#4-implement-repositories).

- add narrow Password Credential and Session repository interfaces;
- preserve operation-specific tagged errors;
- decode database rows through Schema before returning domain values;
- distinguish known constraint violations from generic repository failures;
- avoid broad `onConflict(...doNothing())` handling when more than one constraint can fail.

Check against real PostgreSQL: insert/load credential; insert/resolve/delete Session; unknown digest; expired row; FK cascade; transaction rollback.

### 5. Implement signup vertically

Study companion: [Phase 5 sources and exercise](./research/primary-sources.md#5-implement-signup-vertically).

- `AuthService.signup` normalizes input, hashes the password, creates User/Credential/Session transactionally, and returns public User plus the newly issued redacted cookie value;
- map duplicate email to the existing-style `409` error;
- handler sets the cookie only after success.

Check: real database integration proving success and full rollback after an induced failure between inserts.

### 6. Implement login vertically

Study companion: [Phase 6 sources and exercise](./research/primary-sources.md#6-implement-login-vertically).

- normalize email with the existing `EmailSchema` behavior;
- load Password Credential without exposing its existence publicly;
- verify with asynchronous scrypt;
- create a fresh Session on success;
- collapse unknown email and wrong password to the same public `401`.

Check: success, unknown email, wrong password, malformed stored hash, and two logins producing two independently valid Sessions.

### 7. Implement required Session middleware and `/me`

Study companion: [Phase 7 sources and exercise](./research/primary-sources.md#7-implement-required-session-middleware-and-me).

- decode the cookie security credential;
- reject empty/malformed tokens explicitly;
- digest and resolve the Session with its User;
- enforce absolute expiration using the injected clock;
- provide `AuthenticatedSession` through Effect Context;
- make `/me` consume only that context.

Check with `HttpApiTest.groups`: missing, malformed, unknown, expired, and valid cookie behavior. Also cover service-unavailable and data-integrity mappings.

### 8. Implement idempotent logout

Study companion: [Phase 8 sources and exercise](./research/primary-sources.md#8-implement-idempotent-logout).

- accept the cookie optionally;
- digest a presented valid-format token;
- delete only its matching Session;
- expire the browser cookie with exactly the same name/path attributes;
- return `204` for missing/unknown/already deleted credentials;
- return `503` when resolving or deleting a presented well-formed credential fails because PostgreSQL is unavailable.

Check: logout one of two Sessions, verify the other remains valid, repeat logout, and inspect the emitted expiry cookie.

### 9. Compose and exercise the real server

Study companion: [Phase 9 sources and exercise](./research/primary-sources.md#9-compose-and-exercise-the-real-server).

- add auth service and handler Layers to existing application composition;
- add typed cookie/security configuration and `.env.example` values without secrets;
- keep production same-origin and use the frontend dev proxy locally;
- ensure no public handler logs secret-bearing values.

Run the narrow checks first:

```bash
pnpm --filter @wishlist/api check-types
pnpm --filter @wishlist/api test
pnpm --filter @wishlist/api lint
pnpm --filter @wishlist/api build
```

Run `db:check` when migrations or generated DB types change.

Manual smoke scenario with a temporary cookie jar:

```bash
COOKIE_JAR="$(mktemp)"

curl --fail-with-body -i -c "$COOKIE_JAR"   -H 'content-type: application/json'   --data '{"email":"learner@example.test","password":"correct-horse","firstName":"Ada","lastName":"Lovelace"}'   http://localhost:3000/api/auth/signup

curl --fail-with-body -i -b "$COOKIE_JAR"   http://localhost:3000/api/auth/me

curl --fail-with-body -i -b "$COOKIE_JAR" -c "$COOKIE_JAR"   -X POST http://localhost:3000/api/auth/logout

curl -i -b "$COOKIE_JAR"   http://localhost:3000/api/auth/me
```

Expected sequence: `201 → 200 → 204 → 401`. Use the actual configured port if it differs.

## Required test scenarios

### Contract and validation

- signup accepts exactly 8 and 100 password characters and rejects 7 and 101;
- passwords missing lowercase, uppercase, digit, or special-character categories are rejected;
- whitespace is rejected without trimming or otherwise mutating the password;
- missing signup name keys, mismatched password confirmation, malformed email, and excess JSON fields produce existing validation Problem Details;
- no success response contains credential or Session fields.

### Persistence and transactions

- duplicate email is `409`;
- duplicate token digest is rejected;
- deleting a User cascades to both authentication tables;
- a failed signup leaves no partial User, Password Credential, or Session.

### Authentication

- valid login creates a Session;
- unknown email and wrong password expose the same status and public body;
- two logins create two concurrent Sessions;
- logout revokes only the presented Session;
- expired Sessions never authenticate;
- missing, malformed, and random cookies produce `401` on `/me`;
- logout is idempotent.

### Cookie transport

At least one real HTTP test or smoke scenario must prove:

1. signup emits `Set-Cookie` with the agreed attributes;
2. a cookie jar sends it to `/api/auth/me`;
3. logout emits an expiry cookie;
4. the jar no longer authenticates afterward.

`HttpApiTest.groups` exercises normal request encoding, routing, middleware, response encoding, and client decoding in memory. It does not replace this transport-level cookie test.

## Production-hardening backlog

Implement in dependency order after the first milestone.

### P0 — close existing authorization holes

Study companion: [authorization sources and exercise](./research/primary-sources.md#p0-close-existing-authorization-holes).

- remove public access to credential-free `POST /api/users`;
- define role semantics explicitly;
- ordinary Users may read/update/delete only their own profile;
- administrators may list and manage other Users;
- return `401` for missing authentication and `403` for insufficient permission;
- test horizontal privilege escalation: User A cannot read, update, or delete User B.

The API is not production-ready until this phase is complete.

### P0 — CSRF and browser boundary

Study companion: [CSRF sources and exercise](./research/primary-sources.md#p0-csrf-and-browser-boundary).

- validate `Origin` on unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`);
- keep JSON-only request contracts and strict content type handling;
- review reverse-proxy handling of host/protocol headers;
- if cross-site cookies become necessary, design an explicit CSRF token mechanism before selecting `SameSite=None`;
- verify credentialed CORS uses explicit origins, never `*`.

### P0 — abuse and enumeration resistance

Study companion: [abuse-resistance sources and exercise](./research/primary-sources.md#p0-abuse-and-enumeration-resistance).

- rate-limit every endpoint that performs password hashing: signup, login, password change, and password-reset submission;
- combine an account/normalized-identifier bucket with an IP/network bucket where applicable; signup cannot rely on an existing account key;
- evaluate an initial login token bucket of capacity 5 and refill 1 token/minute through load/security tests; do not treat its roughly 525,600 sustained yearly admissions as proof that a password is uncrackable;
- avoid account-lockout DoS: keep public responses generic, use bounded delays/temporary throttling, and observe abuse rather than permanently locking an account after a small threshold;
- place rate limiting before expensive hashing and keep rate-limit behavior equivalent for known and unknown identifiers;
- compute a dummy scrypt hash when the login email is unknown to reduce timing-based account enumeration;
- ensure logs and metrics do not reintroduce public distinctions;
- define behavior under concurrent repeated login attempts and when the hashing queue is saturated (`429` for policy throttling; an explicit overload error such as `503` for unavailable hashing capacity).

### P1 — Session lifecycle

Study companion: [Session lifecycle sources and exercise](./research/primary-sources.md#p1-session-lifecycle).

- periodic deletion of rows where `expires_at <= now`;
- metrics for active, created, expired, and revoked Sessions without recording tokens;
- revoke all Sessions after password change or account compromise;
- add `remember me` by choosing a longer `expires_at`, not by changing Session validity rules;
- list a User's Sessions with safe metadata;
- revoke another Session by internal Session id;
- decide whether user-agent/device labels are worth storing before collecting them.

### P1 — password lifecycle

Study companion: [password lifecycle sources and exercise](./research/primary-sources.md#p1-password-lifecycle).

- password change requiring the current password;
- password reset with separate single-use, short-lived credentials;
- check candidate passwords against a breached-password service without disclosing the password;
- revisit the minimum length and support longer passphrases;
- rehash on successful login when stored scrypt parameters are obsolete;
- document secret rotation if a pepper is introduced later.

### P1 — operational security

Study companion: [operational-security sources and exercise](./research/primary-sources.md#p1-operational-security).

- structured audit events for signup, login success/failure, logout, password changes, and Session revocation;
- retention and privacy policy for audit data;
- security response headers;
- deployment check for TLS and `Secure` cookies;
- backup/restore test for authentication tables;
- alerting for elevated login failures and repository unavailability.

### P2 — stronger authentication

Study companion: [stronger-authentication sources and exercise](./research/primary-sources.md#p2-stronger-authentication).

- MFA/WebAuthn;
- verified email ownership;
- account recovery policy;
- OAuth/OIDC only when a real product requirement appears;
- reconsider whether Password Credential remains singular when multiple authentication methods exist.

## Learning checkpoints

After each vertical phase, be able to explain:

1. which state is stored before and after the operation;
2. which Effect changes that state;
3. the normal, typed error, defect, and cancellation paths;
4. which Layer supplies each dependency;
5. which observable test would fail if the invariant were removed.

Useful self-checks:

- Why is SHA-256 appropriate for a random Session token but not a password?
- Why must signup own one transaction across three repositories?
- Why does `HttpOnly` not solve CSRF?
- Why is a Session id separate from its raw credential?
- Why must `/logout` expire the browser cookie as well as delete the database row?

## Sources

All Effect links below are pinned to the installed `4.0.0-rc.108` package where possible. Do not copy Effect 3 imports or current-main signatures into this RC project without checking installed source/types.

1. [Effect HttpApiMiddleware source, rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/httpapi/HttpApiMiddleware.ts) — `HttpApiMiddleware.Service`, typed security errors, and services provided to downstream handlers.
2. [Effect HttpApiBuilder source, rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/httpapi/HttpApiBuilder.ts) — `securityDecode`, `securitySetCookie`, and the empty-redacted credential behavior.
3. [Effect HttpApiTest source, rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/httpapi/HttpApiTest.ts) — typed in-memory endpoint/middleware testing and its transport limitation.
4. [Effect Schema source, rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/Schema.ts) — installed v4 Schema API; avoid old `@effect/schema` examples.
5. [Effect Redacted source, rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/Redacted.ts) — protection against accidental display and its non-cryptographic limitation.
6. [Effect PostgreSQL adapter, rc.108](https://unpkg.com/@effect/sql-pg@4.0.0-rc.108/src/PgClient.ts) — PostgreSQL Layer and redacted connection configuration.
7. [Node.js 25 `crypto.scrypt`](https://nodejs.org/docs/latest-v25.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) — asynchronous API, options, and salt guidance.
8. [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — current scrypt floor, salts, work-factor upgrading, and password-storage threat model.
9. [MDN `Set-Cookie`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) — exact browser behavior for `HttpOnly`, `Secure`, `SameSite`, `Domain`, `Path`, and expiration.
10. [EffectPatterns authentication pattern, pinned commit](https://github.com/PaulJPhilp/EffectPatterns/blob/f3a0da2299717cf31d31313c5661cebd2446d5a3/content/published/patterns/building-apis/api-authentication.mdx) — useful only for the general middleware-provides-authenticated-context pattern. It implements simplified Bearer/JWT auth on Effect 3.19.19, not PostgreSQL cookie Sessions, and its imports are not authoritative for this project.

Additional local examples:

- `apps/api/src/errors/request-validation.test.ts` — current HttpApi handler/test composition;
- `packages/sql-kysely/tests/pg.test.ts` — PostgreSQL Testcontainers and transaction rollback;
- `apps/api/src/modules/users/` — current Schema/handler/service/repository/Layer and tagged-error conventions;
- `docs/BEEP_EFFECT_CRUD_PROVIDER_INSTANCE.md` — external Effect architecture study; useful for Layer/error-boundary thinking, not an auth specification.
