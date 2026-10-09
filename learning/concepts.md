# Concepts

Добавлены только концепции, которые нужны текущему product path или конкретному позднему milestone. `Expected mastery` — уровень к завершению соответствующей фазы, а не текущая оценка.

## Concept: Lazy Effect execution и Layer lifetime

- **Why it matters:** значение, вычисленное при построении Layer, может случайно стать singleton; security operation должна получать fresh randomness при каждом запуске.
- **Where it appears in this project:** `SessionTokenGeneratorLive`, все `Context.Service`/`Layer.effect`, DB/config Layers.
- **Prerequisites:** функции, promises, базовый `Effect.gen`.
- **Expected mastery:** 4 к окончанию Phase 0.
- **How mastery will be verified:** два запуска одной service operation дают два source calls; пользователь объясняет время construction, provision и execution.

## Concept: Typed Effect failure model

- **Why it matters:** backend должен различать ожидаемый отказ, defect, interruption и retry, иначе HTTP contract и cleanup становятся ложными.
- **Where it appears in this project:** repository/service/handler error mapping, `Effect.catchTags`, crypto callbacks, workers.
- **Prerequisites:** discriminated unions и async control flow.
- **Expected mastery:** 4 после Session auth; 5 после worker/retry phase.
- **How mastery will be verified:** для одного use case пользователь рисует все exits и демонстрирует отдельные tests/experiments для typed failure и interruption.

## Concept: Context.Service, Layer и dependency graph

- **Why it matters:** side effects и configuration должны иметь явных владельцев и заменяемые test implementations.
- **Where it appears in this project:** `AppServicesLive`, DB, UsersService/Repository, будущие AuthService/PasswordHasher/email/storage adapters.
- **Prerequisites:** Effect requirements и module imports.
- **Expected mastery:** 4 после live auth wiring.
- **How mastery will be verified:** пользователь самостоятельно собирает auth graph без global connection/process.env access и объясняет provides/requires каждого Layer.

## Concept: Runtime boundary validation with Effect Schema

- **Why it matters:** TypeScript исчезает в runtime; HTTP, config и DB rows остаются `unknown`, пока не декодированы.
- **Where it appears in this project:** request schemas, branded IDs/emails, response encoding, config, repository row decoding.
- **Prerequisites:** TypeScript types и JSON.
- **Expected mastery:** 4 после Wishlist contracts.
- **How mastery will be verified:** boundary tests для valid/invalid/excess inputs и объяснение encoded/type distinction.

## Concept: HttpApi contract и Problem Details

- **Why it matters:** status, body и error shape являются публичным observable contract, независимым от handler implementation.
- **Where it appears in this project:** Users/Auth groups, request-validation middleware, `Schema.Error` classes.
- **Prerequisites:** HTTP methods/statuses и Schema.
- **Expected mastery:** 4 после auth phase.
- **How mastery will be verified:** новый endpoint проектируется contract-first и проверяется через Web `Request/Response`, включая error content type.

## Concept: Error translation by boundary

- **Why it matters:** SQL details нельзя выдавать клиенту, а domain conflict нельзя превращать в generic 500.
- **Where it appears in this project:** UsersRepository → UsersService → UsersHandlers; будущий auth/reservation mapping.
- **Prerequisites:** typed Effect failures, Problem Details.
- **Expected mastery:** 4 после auth; 5 после Reservations.
- **How mastery will be verified:** пользователь классифицирует validation/domain/unavailable/integrity failures и показывает, где каждая переводится.

## Concept: PostgreSQL migrations и generated DB model

- **Why it matters:** schema changes должны быть воспроизводимыми, forward-only и согласованными с compile-time Kysely types.
- **Where it appears in this project:** `0001_initial.ts`, `0002_auth.ts`, `kysely-codegen`, Testcontainers migration tests.
- **Prerequisites:** SQL DDL, TypeScript types.
- **Expected mastery:** 4 после Wishlist migration.
- **How mastery will be verified:** migration применяется к чистой и предыдущей schema, инварианты проверены SQL, generated file создаётся командой.

## Concept: Database constraints as invariant owners

- **Why it matters:** только БД видит конкурентные writes всех replicas; in-process check имеет race window.
- **Where it appears in this project:** unique email/token digest, Session checks, будущий single-active Reservation.
- **Prerequisites:** transactions, indexes, concurrent requests.
- **Expected mastery:** 5 после Reservation phase.
- **How mastery will be verified:** два одновременных reserve получают один success и один conflict благодаря constraint, не process lock.

## Concept: Transaction boundary и atomic use case

- **Why it matters:** signup и lifecycle commands состоят из нескольких writes, которые должны либо все commit, либо все rollback.
- **Where it appears in this project:** `db.withTransaction`, будущие signup, Sharing Link transition, Reservation deletion, outbox writes.
- **Prerequisites:** SQL transactions и typed failures.
- **Expected mastery:** 4 после auth; 5 после outbox.
- **How mastery will be verified:** fault injection после каждого write не оставляет partial state; пользователь объясняет владельца transaction.

## Concept: Session authentication model

- **Why it matters:** User, Password Credential и Session имеют разные состояния; смешение ломает logout, revocation и multiple Sessions.
- **Where it appears in this project:** auth tables/contracts, ADR-0001, future AuthService/security middleware.
- **Prerequisites:** HTTP cookies, hashing, DB lookup.
- **Expected mastery:** 5 после Session auth.
- **How mastery will be verified:** signup/login/me/logout state diagram и real cookie-jar scenario с двумя concurrent Sessions.

## Concept: Secure password hashing

- **Why it matters:** password — low-entropy secret; его нельзя хранить или обрабатывать как Session token.
- **Where it appears in this project:** `PasswordSchema`, password-hash format, future PasswordHasher with scrypt.
- **Prerequisites:** bytes/encoding, typed failures, native async API.
- **Expected mastery:** 4 после Phase 0; 5 после password lifecycle hardening.
- **How mastery will be verified:** hash/verify/mismatch/malformed tests, benchmark и объяснение salt, work factor, versioning и constant-time compare.

## Concept: Opaque credential, digest и Redacted

- **Why it matters:** утечка DB не должна сразу раскрывать активные Session credentials; accidental rendering тоже нужно ограничить.
- **Where it appears in this project:** `GeneratedSessionTokenSchema`, Sessions `token_digest`, cookies, Guest/Sharing credentials.
- **Prerequisites:** secure random bytes, SHA-256, base64url.
- **Expected mastery:** 5 после Guest Sessions.
- **How mastery will be verified:** known-vector digest test, raw token существует только у transport boundary, logs/errors/snapshots не содержат secret.

## Concept: Bounded concurrency и admission control

- **Why it matters:** async scrypt не блокирует event loop, но способен исчерпать memory и worker pool; Semaphore без bounded queue не ограничивает admitted work.
- **Where it appears in this project:** будущий PasswordHasher, email/import workers.
- **Prerequisites:** fibers, interruption, resource lifetime, measurement.
- **Expected mastery:** 4 после Phase 0; 5 после worker phase.
- **How mastery will be verified:** measured budget и test active/waiting/rejected states, включая interruption after native submission.

## Concept: Authentication, authorization и ownership

- **Why it matters:** валидная Session отвечает «кто», но не даёт права читать/менять любую сущность.
- **Where it appears in this project:** текущий публичный Users CRUD, будущие private profile/Wishlist/Item queries.
- **Prerequisites:** authenticated principal и SQL predicates.
- **Expected mastery:** 5 после owner-only Wishlists.
- **How mastery will be verified:** actor/resource matrix и queries scoped одновременно entity ID + owner ID.

## Concept: Internal model и public projection

- **Why it matters:** повторное использование DB row как response легко раскрывает email, hashes или Reservation holder identity.
- **Where it appears in this project:** UserResponse, planned Public Profile, owner/visitor/holder projections.
- **Prerequisites:** Schema encoding и authorization.
- **Expected mastery:** 5 после Sharing phase.
- **How mastery will be verified:** response schemas по audience и negative assertions на sensitive fields.

## Concept: Aggregate boundary и domain invariant

- **Why it matters:** Wishlist владеет visibility/currency/Items rules; граница определяет transaction и authorization scope.
- **Where it appears in this project:** future Wishlist and Wishlist Items.
- **Prerequisites:** domain vocabulary из `CONTEXT.md`, transactions.
- **Expected mastery:** 4 после Items.
- **How mastery will be verified:** пользователь обосновывает, какие изменения атомарны внутри aggregate и какие данные не входят в него.

## Concept: Stable pagination, ordering, date и money

- **Why it matters:** backend должен выдавать повторяемые pages и точные domain values, а не случайный SQL order/floating-point price.
- **Where it appears in this project:** Wishlist lists, Item priority/price sorting, Occasion Date, Wishlist Currency.
- **Prerequisites:** SQL order/indexes и runtime Schema.
- **Expected mastery:** 4 после Items.
- **How mastery will be verified:** tie/null/boundary cases и объяснение выбранного money/date representation.

## Concept: State machine и idempotency

- **Why it matters:** reserve/cancel/release/retry должны иметь явные допустимые transitions и не создавать duplicate active state.
- **Where it appears in this project:** Reservation lifecycle, Session logout, challenge consumption, jobs.
- **Prerequisites:** domain errors, transactions, constraints.
- **Expected mastery:** 5 после Reservations.
- **How mastery will be verified:** transition table, repeated commands и concurrent requests с точными outcomes.

## Concept: Command–Decider–Event как чистый domain module

- **Why it matters:** lifecycle с несколькими commands, states, errors и events легко расползается по handlers и repositories; Decider концентрирует правила за маленьким interface.
- **Where it appears in this project:** сначала только Reservation lifecycle; повторное применение к Sharing Link transitions допустимо после отдельного сравнения, Users CRUD не является целью переписывания.
- **Prerequisites:** state machine, discriminated unions, domain errors и pure functions.
- **Expected mastery:** 4 после Reservations.
- **How mastery will be verified:** `decide` и `evolve` проходят полную transition matrix без Effect/SQL; PostgreSQL продолжает владеть concurrent invariant; пользователь сравнивает вариант с прямыми transitions и объясняет, почему Event Sourcing не обязателен.

## Concept: Scoped Guest identity и magic link

- **Why it matters:** verified email для одной Wishlist не должен становиться global User authentication.
- **Where it appears in this project:** ADR-0002, future challenges and Guest Sessions.
- **Prerequisites:** Session model, credential digests, authorization.
- **Expected mastery:** 5 после Guest phase.
- **How mastery will be verified:** replay/expiry/cross-Wishlist cases и объяснение challenge→Session transition.

## Concept: Transactional outbox и at-least-once worker

- **Why it matters:** commit domain state и отправка email не могут быть одной atomic operation без durable record; retries неизбежны.
- **Where it appears in this project:** required Guest/reservation emails и future Import Preview jobs; ADR-0003.
- **Prerequisites:** transactions, idempotency, process lifecycle.
- **Expected mastery:** 5 после Guest phase.
- **How mastery will be verified:** crash/restart experiments, two-worker claiming и duplicate-safe handler.

## Concept: Security boundaries for cookies and public endpoints

- **Why it matters:** working auth остаётся уязвимым без CSRF/origin policy, rate limits, secure cookie deployment и enumeration controls.
- **Where it appears in this project:** Session endpoints, CORS config, password/Guest email operations.
- **Prerequisites:** auth flow и threat model.
- **Expected mastery:** 4 после security gate.
- **How mastery will be verified:** malicious-origin, abuse and revocation scenarios на live topology.

## Concept: Object storage и hostile file validation

- **Why it matters:** uploaded bytes недоверенны, а DB transaction не управляет object lifecycle автоматически.
- **Where it appears in this project:** future service-owned images.
- **Prerequisites:** streaming/resource limits, worker cleanup.
- **Expected mastery:** 4 после Images.
- **How mastery will be verified:** hostile fixtures, orphan lifecycle и multi-replica read consistency.

## Concept: SSRF-safe asynchronous enrichment

- **Why it matters:** fetch user URL может атаковать internal network и удерживать request path; marketplace response не является trusted data.
- **Where it appears in this project:** future Import Preview, ADR-0004.
- **Prerequisites:** workers/outbox, object storage, network basics.
- **Expected mastery:** 4 после Import Preview.
- **How mastery will be verified:** controlled fixtures для DNS/redirect/size/timeout/content cases и version-safe apply.

## Concept: Observability and evidence-driven scaling

- **Why it matters:** cache, broker и microservices без измеренного bottleneck добавляют consistency/operations cost, но не решают доказанную проблему.
- **Where it appears in this project:** scale-lab iterations после полного product path.
- **Prerequisites:** live multi-process topology и workload model.
- **Expected mastery:** 5 в конце curriculum.
- **How mastery will be verified:** baseline, bottleneck evidence, сравнение альтернатив и повторяемый before/after experiment.

## Concept: Graceful shutdown и recoverable worker lifecycle

- **Why it matters:** `SIGTERM` не должен терять claimed job, принимать новую работу во время остановки или оставлять открытые DB resources.
- **Where it appears in this project:** отдельный email/outbox worker в Guest phase и multi-instance experiments.
- **Prerequisites:** Effect Scope, claim/lease semantics, idempotency и process signals.
- **Expected mastery:** 4 после Guest phase.
- **How mastery will be verified:** signal experiment прекращает новые claims; in-flight job завершается до deadline либо становится повторно доступной после lease; все scoped resources освобождаются.

## Concept: Evidence-gated Request batching и cache

- **Why it matters:** `Effect.request` решает повторяющиеся `1 + N` operations, но без измеренного N+1 добавляет новый interface; cache отдельно создаёт stale-data и invalidation risks.
- **Where it appears in this project:** возможные Item/Public Profile reads после появления реального query path, не текущие auth операции.
- **Prerequisites:** query counting, tracing, SQL `JOIN/IN`, authorization и cache invalidation ownership.
- **Expected mastery:** 3 после optional scale-lab experiment.
- **How mastery will be verified:** baseline показывает `1 + N`; сравниваются обычный SQL и `RequestResolver`; выбранный вариант уменьшает round trips/p95 без изменения visibility результата.

## Concept: Mutation testing как прибор силы тестов

- **Why it matters:** coverage показывает выполненные строки, но не доказывает, что assertion заметит сломанный branch или boundary.
- **Where it appears in this project:** optional experiment на стабильном чистом `ReservationDecider`.
- **Prerequisites:** быстрые deterministic behavior tests и понятные domain invariants.
- **Expected mastery:** 3 после optional experiment.
- **How mastery will be verified:** meaningful mutants погибают от observable assertions; surviving mutant приводит к обоснованному test case или удалению dead code, а не к погоне за 100%.

## Concept: Event Sourcing и CQRS как optional architecture lab

- **Why it matters:** append-only history, replay и rebuildable projections дают новые возможности, но требуют event versioning, optimistic concurrency и принятия eventual consistency.
- **Where it appears in this project:** только изолированный Reservation experiment после завершённого current-state product path.
- **Prerequisites:** Decider, PostgreSQL transactions, idempotent projections и observability.
- **Expected mastery:** 3 после optional lab; production adoption не является целью curriculum.
- **How mastery will be verified:** throwaway stream воспроизводит state через replay, version conflict наблюдаем, projection rebuild детерминирован; удаление лаборатории не меняет production behavior.
