# Учебная карта: PostgreSQL session auth с Effect 4

## Рамки версий и способ чтения

Локально зафиксированы `effect`, `@effect/platform-node`, `@effect/sql-pg` **4.0.0-rc.108**, `kysely` **0.29.5**, Node **>=25** и PostgreSQL image **16.3**. Для Effect API источником истины служат установленные `node_modules` и эквивалентные URL unpkg с точной версией; документация или примеры Effect 3 не определяют API этого проекта. PostgreSQL-ссылки ниже закреплены на ветке 16, а не на `current`. Kysely source закреплён tag `v0.29.5`.

## Фазы 1–9

### 1. Freeze contracts with schemas

- **Изучить до кода:** разделение внешнего декодирования и доменных значений; strict/excess-property поведение; объявление payload/success/error в `HttpApiEndpoint`; как существующий Problem Details слой превращает schema errors в HTTP 400.
- **Primary sources (прямые разделы/API):**
  1. [`effect@4.0.0-rc.108/src/Schema.ts`](https://unpkg.com/effect@4.0.0-rc.108/src/Schema.ts) — `Schema.Struct`, `Schema.check`, `Schema.decodeUnknownEffect`, parse options.
  2. [`HttpApiEndpoint.ts` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/httpapi/HttpApiEndpoint.ts) — constructors `post`, `get` and endpoint options `payload`, `success`, `error`.
  3. [`HttpApiSchema.ts` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/httpapi/HttpApiSchema.ts) — status/body annotations and `NoContent`.
- **Точные локальные ориентиры:** `apps/api/src/modules/users/api/users.api.ts`; `apps/api/src/modules/users/schemas/create-user.schema.ts`; `apps/api/src/modules/users/schemas/user-response.schema.ts`; `apps/api/src/schemas/email.schema.ts`; `apps/api/src/schemas/utils.ts`; `apps/api/src/errors/request-validation.test.ts`.
- **Упражнение/наблюдение:** вручную декодировать три значения одним будущим password-schema: 7 символов → failure, 8 → success, строка с пробелами по краям → пробелы остаются; отдельно посмотреть, как excess field оформляется существующим Problem Details кодом.
- **Применимость/version note:** использовать только встроенный `effect/Schema` rc.108; старые примеры с `@effect/schema` и Effect 3 нельзя переносить по импортам или сигнатурам. Email, напротив, должен сохранить локальное `trim().toLowerCase()` из `apps/api/src/schemas/email.schema.ts`; это поведение не переносится на password.

### 2. Add persistence schema

- **Изучить до кода:** `PRIMARY KEY`, `UNIQUE`, `NOT NULL`, foreign key `ON DELETE CASCADE`; автоматически создаваемый unique B-tree index; обычные индексы для `user_id` и `expires_at`; миграционный `up/down` и generated types.
- **Primary sources:**
  1. [PostgreSQL 16 — 5.4 Constraints, Unique/Primary/Foreign Keys](https://www.postgresql.org/docs/16/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS).
  2. [PostgreSQL 16 — 11.2 Index Types / B-tree](https://www.postgresql.org/docs/16/indexes-types.html#INDEXES-TYPES-BTREE).
  3. [Kysely `v0.29.5` `SchemaModule`](https://github.com/kysely-org/kysely/blob/v0.29.5/src/schema/schema.ts) — schema builder entry points; сверять имена методов с установленными `.d.ts`.
  4. [Kysely `v0.29.5` `Migrator`](https://github.com/kysely-org/kysely/blob/v0.29.5/src/migration/migrator.ts) — migration ordering, apply/rollback behavior.
- **Локальные ориентиры:** `apps/api/src/db/migrations/0001_initial.ts`; `apps/api/src/db/generated/database.ts`; `apps/api/package.json` scripts `db:generate`, `db:check`, `db:migrate`; `packages/sql-kysely/tests/pg.test.ts`; `apps/api/docker-compose.dev.yml` (`postgres:16.3-alpine3.19`).
- **Упражнение:** на бумаге составить три операции и ожидаемые SQLSTATE/остаточное состояние: повторный `token_digest`, удаление user, rollback после вставки user до credential/session. Затем сопоставить их с проверками реального PostgreSQL, а не с mock.
- **Version note:** читать PostgreSQL 16, соответствующий image 16.3. Kysely API закреплён `v0.29.5`; `kysely-codegen 0.20.0` генерирует файл — его нельзя править вручную.

### 3. Implement security primitives

- **Изучить до кода:** callback-based async `crypto.scrypt`; явные `N/r/p/maxmem`; fresh salt >=16 bytes; self-describing versioned hash; одинаковая длина перед `timingSafeEqual`; libuv worker pool; process-local Effect Semaphore; bounded wait; CSPRNG token, base64url, SHA-256 digest; разница между redaction и cryptographic protection.
- **Primary sources:**
  1. [Node 25 `crypto.scrypt`](https://nodejs.org/docs/latest-v25.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) — async signature, option defaults, `128 * N * r > maxmem`, salt guidance.
  2. [Node 25 `UV_THREADPOOL_SIZE`](https://nodejs.org/docs/latest-v25.x/api/cli.html#uv_threadpool_sizesize) — `crypto.scrypt()` использует фиксированный libuv thread pool вместе с другими API.
  3. [Node 25 `crypto.randomBytes`](https://nodejs.org/docs/latest-v25.x/api/crypto.html#cryptorandombytessize-callback) и [`timingSafeEqual`](https://nodejs.org/docs/latest-v25.x/api/crypto.html#cryptotimingsafeequala-b).
  4. [OWASP Password Storage — scrypt/work factors](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#using-work-factors) — минимальные конфигурации, benchmarking и DoS trade-off.
  5. [`Semaphore.ts` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/Semaphore.ts) — `make`, `withPermits`, automatic permit release semantics.
  6. [`Redacted.ts` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/Redacted.ts) — `make`, `value`, inspect/equality behavior.
- **Локальные ориентиры:** `apps/api/package.json` (Node runtime assumptions and Effect versions); будущие сервисы должны следовать `Context.Service`/Layer форме из `apps/api/src/modules/users/service/users.service.ts`.
- **Упражнение:** посчитать память для `N=2^17,r=8`: приблизительно `128*N*r = 134217728` bytes на активную операцию; затем измерить latency/RSS для concurrency 1, 2 и выбранного Semaphore limit. Проверить, что permits освобождаются после success/failure/interruption, а bounded wait не позволяет бесконечно накапливать requests. Сравнить два hash одного password и убедиться, что salt/hash различны, а verify обоих успешен.
- **Version note:** Node 25 docs открылись как v25.9.0. Async scrypt не выполняется на event loop, но делит фиксированный libuv pool с другими API; увеличение `UV_THREADPOOL_SIZE` не является memory limit. `Redacted` предотвращает случайный вывод, но не шифрует и не хеширует. OWASP предпочитает Argon2id, но для явно выбранного планом built-in Node scrypt даёт минимальный floor.

### 4. Implement repositories

- **Изучить до кода:** узкие operation-specific repository contracts; schema decoding каждого DB row; SQLSTATE/constraint-name classification; почему broad `ON CONFLICT DO NOTHING` скрывает причину; lookup digest plus expiration; transaction context propagation.
- **Primary sources:**
  1. [`SqlClient.ts` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/sql/SqlClient.ts) — `withTransaction` and `SqlError` channel.
  2. [PostgreSQL 16 error codes](https://www.postgresql.org/docs/16/errcodes-appendix.html) — class 23 integrity constraint violations, including `23505` and `23503`.
  3. [Kysely `v0.29.5` `OnConflictBuilder`](https://github.com/kysely-org/kysely/blob/v0.29.5/src/query-builder/on-conflict-builder.ts) — exact conflict-builder behavior.
  4. [`Schema.decodeUnknownEffect` in rc.108 source](https://unpkg.com/effect@4.0.0-rc.108/src/Schema.ts) — typed row validation boundary.
- **Локальные ориентиры:** `apps/api/src/modules/users/repository/users.repository.ts`; `apps/api/src/modules/users/repository/users.repository.errors.ts`; `apps/api/src/db/db.service.ts`; `packages/sql-kysely/tests/pg.test.ts` transaction rollback example.
- **Упражнение:** проследить локальный `userSelection → decodeUser → InvalidUserRecord`; спроектировать эквивалентные минимальные selections для credential/session, исключив `password_hash` из profile path. Для каждой constraint error записать единственный constraint name, который можно безопасно преобразовать в domain error.
- **Version note:** проект использует Effect SQL transaction API, а не напрямую Promise transaction callback Kysely. Kysely source полезен для query-builder semantics, но Layer/error/cancellation semantics определяет Effect rc.108.

### 5. Implement signup vertically

- **Изучить до кода:** один owner транзакции на use case; all-or-nothing user + credential + session; cookie only after commit; duplicate email only as 409; handler-to-Problem-Details mapping without secrets.
- **Primary sources:**
  1. [PostgreSQL 16 — 3.4 Transactions](https://www.postgresql.org/docs/16/tutorial-transactions.html) — all-or-nothing and visibility.
  2. [`SqlClient.withTransaction` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/sql/SqlClient.ts).
  3. [`HttpApiBuilder.securitySetCookie` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/httpapi/HttpApiBuilder.ts) — pre-response cookie registration and actual defaults.
  4. [RFC 6265 §4.1 Set-Cookie](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1).
- **Локальные ориентиры:** `apps/api/src/modules/users/service/users.service.ts`; `apps/api/src/modules/users/handlers/users.handlers.ts`; `apps/api/src/errors/http-problem.ts`; `apps/api/src/modules/users/api/users.api.errors.ts`.
- **Упражнение:** нарисовать timeline `BEGIN → user → credential → induced failure → session → COMMIT → Set-Cookie` и отметить, что Set-Cookie не является частью DB transaction. Наблюдаемая проверка: после induced failure отсутствуют все три rows и заголовок cookie.
- **Version note:** в rc.108 `securitySetCookie` default добавляет только `secure:true,httpOnly:true`; `path`, `sameSite`, `maxAge`, `expires` — ответственность приложения.

### 6. Implement login vertically

- **Изучить до кода:** единый публичный 401 для unknown email/wrong password; внутреннее различие data-integrity/unavailable; async password verification; новая session при каждом успехе; email normalization уже задана локальной schema.
- **Primary sources:**
  1. [OWASP Authentication — Authentication Responses](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#authentication-responses) — generic errors против enumeration.
  2. [OWASP Password Storage — Using Work Factors / Upgrading](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#using-work-factors).
  3. [Node 25 async `scrypt`](https://nodejs.org/docs/latest-v25.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).
  4. [OWASP Session Management — renew after privilege change](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#renew-the-session-id-after-any-privilege-level-change).
- **Локальные ориентиры:** `apps/api/src/schemas/email.schema.ts` (`trim().toLowerCase()`); `apps/api/src/modules/users/service/users.service.errors.ts`; `apps/api/src/modules/users/handlers/users.handlers.ts` (`Effect.catchTags` mapping/logging).
- **Упражнение:** сравнить status, content-type и body unknown-email и wrong-password responses byte-for-byte; выполнить два успешных login и показать два разных digest rows, оба валидны независимо.
- **Version note:** dummy scrypt для unknown email относится к backlog P0 abuse resistance, не следует тайно расширять milestone. Generic response обязателен уже сейчас; timing equalization — отдельный hardening step.

### 7. Implement required Session middleware and `/me`

- **Изучить до кода:** cookie API-key security descriptor; middleware service providing authenticated context; empty `Redacted<string>` on missing/failed cookie decode; strict token format; absolute expiry using injected clock; limits in-memory HttpApiTest.
- **Primary sources:**
  1. [`HttpApiSecurity.apiKey` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/httpapi/HttpApiSecurity.ts).
  2. [`HttpApiBuilder.securityDecode` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/httpapi/HttpApiBuilder.ts) — cookie decode failure returns `Redacted.make("")`.
  3. [`HttpApiMiddleware.ts` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/httpapi/HttpApiMiddleware.ts) — security middleware service/error/context typing.
  4. [`HttpApiTest.groups` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/httpapi/HttpApiTest.ts) — in-memory generated client and what it exercises.
- **Локальные ориентиры:** `apps/api/src/api/api.ts`; `apps/api/src/api/api-live.ts`; `apps/api/src/errors/request-validation.test.ts`; existing `Context.Service` pattern in `apps/api/src/modules/users/service/users.service.ts`.
- **Упражнение:** составить truth table из missing/empty/non-base64url/wrong-length/unknown/expired/valid и для каждой строки записать: доходит ли запрос до DB, public result, internal typed error. Проверить `/me` только через `AuthenticatedSession` context, без повторного cookie parsing.
- **Version note:** empty-redacted behavior подтверждено именно rc.108 implementation и может измениться в следующем RC. `HttpApiTest.groups` не запускает TCP server, поэтому не доказывает реальное поведение browser/cookie jar.

### 8. Implement idempotent logout

- **Изучить до кода:** optional credential отдельно от required middleware; delete only digest match; idempotent 204 for absent/unknown/already deleted; DB failure on well-formed presented token remains 503; difference `removeCookie` vs emitting expiry cookie and attribute matching.
- **Primary sources:**
  1. [`HttpServerResponse.expireCookie` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/http/HttpServerResponse.ts) — emits expired cookie and excludes caller-supplied `expires/maxAge`.
  2. [`HttpServerResponse.removeCookie` rc.108](https://unpkg.com/effect@4.0.0-rc.108/src/unstable/http/HttpServerResponse.ts) — only changes response-under-construction cookie set.
  3. [RFC 6265 §4.1.2.2 Max-Age](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.2.2) and [§5.3 storage model](https://www.rfc-editor.org/rfc/rfc6265.html#section-5.3).
  4. [MDN Set-Cookie — Max-Age, Path, Domain](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#attributes).
- **Локальные ориентиры:** future handler should follow response/error mapping in `apps/api/src/modules/users/handlers/users.handlers.ts`; cookie configuration belongs with typed config in `apps/api/src/config/config.ts`.
- **Упражнение:** создать две sessions, logout первой, доказать 401 для первой и 200 для второй, повторить logout первой и получить 204; отдельно инспектировать `Set-Cookie` expiry line и совпадение `wishlist_session; Path=/api`.
- **Version note:** `expireCookie` signature и effectful `CookiesError` — rc.108; не заменять на `removeCookie`. Удаление server row без browser expiry оставляет бесполезный credential на клиенте и не выполняет контракт.

### 9. Compose and exercise the real server

- **Изучить до кода:** composition root and Layer dependency direction; PgClient configuration; same-origin cookie path; frontend dev proxy; actual browser/fetch credential rules and credentialed CORS; difference in-memory and transport tests.
- **Primary sources:**
  1. [`@effect/sql-pg@4.0.0-rc.108/PgClient.ts`](https://unpkg.com/@effect/sql-pg@4.0.0-rc.108/src/PgClient.ts) — PostgreSQL client Layer/config.
  2. [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) — host-only, Path, Secure, HttpOnly, SameSite and expiration behavior.
  3. [MDN Fetch — Including credentials](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#including_credentials).
  4. [Fetch Standard — CORS protocol and credentials](https://fetch.spec.whatwg.org/#http-cors-protocol).
  5. [MDN CORS — credentialed requests and wildcards](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#credentialed_requests_and_wildcards).
- **Локальные ориентиры:** `apps/api/src/app.ts`; `apps/api/src/api/api.ts`; `apps/api/src/api/api-live.ts`; `apps/api/src/server.ts`; `apps/api/src/bin/server.ts`; `apps/api/src/config/config.ts`; `apps/api/.env.example`. В `apps/api/src/server.ts` CORS `credentials` уже берётся из typed config.
- **Упражнение:** выполнить именно четырехшаговый cookie-jar smoke scenario из плана и записать `201 → 200 → 204 → 401`; отдельно проверить, что signup response содержит полный agreed Set-Cookie, а jar действительно отправляет cookie только на `/api`.
- **Version note:** production topology плана — same-origin; cross-origin режим не является бесплатной заменой proxy. Для credentialed CORS нельзя `Access-Control-Allow-Origin: *`; клиент должен opt in credentials, а server — вернуть explicit origin и credentials header.

## Hardening backlog: ровно семь направлений

### P0. Close existing authorization holes

- **Изучить:** authentication vs authorization; deny-by-default; every-request and object-level authorization; own-resource relation plus admin role; 401 vs 403; horizontal privilege escalation.
- **Primary sources:** [OWASP Authorization — Deny by Default](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#deny-by-default); [Validate Permissions on Every Request](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#validate-the-permissions-on-every-request); [OWASP IDOR Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html).
- **Локальные ориентиры:** `apps/api/src/modules/users/api/users.api.ts` (сейчас public CRUD); `apps/api/src/db/migrations/0001_initial.ts` (`users.role`); `apps/api/src/modules/users/repository/users.repository.ts`.
- **Упражнение:** таблица subject × object × action для anonymous/User A/User B/admin и автоматизированная проверка, что A не может GET/PUT/DELETE B.
- **Version note:** это product policy поверх Effect context, не готовая RBAC feature библиотеки. Сначала явно определить role semantics.

### P0. CSRF and browser boundary

- **Изучить:** почему cookies прикладываются browser автоматически; Origin validation на unsafe methods; strict JSON content type; SameSite как defense-in-depth; proxy trust; explicit origin with credentialed CORS.
- **Primary sources:** [OWASP CSRF Prevention — Origin/Referer verification](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#verifying-the-origin-with-standard-headers); [OWASP SameSite section](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#samesite-cookie-attribute); [Fetch CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol); [MDN SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value).
- **Локальные ориентиры:** `apps/api/src/server.ts`; `apps/api/src/config/config.ts`; request schemas/Problem Details path.
- **Упражнение:** послать unsafe request с correct Origin, foreign Origin, `Origin: null`, absent Origin and form-safelisted content type; заранее определить allow/deny and proxy assumptions.
- **Version note:** `HttpOnly` защищает чтение cookie, не CSRF; `SameSite=Lax` не заменяет explicit unsafe-method protection. `SameSite=None` требует Secure and prior CSRF design.

### P0. Abuse and enumeration resistance

- **Изучить:** per-account/IP token buckets; generic response including logs/metrics; dummy hash timing equalization; resource exhaustion from memory-hard KDF; concurrent login behavior; различие policy throttling и hashing-capacity overload.
- **Primary sources:** [OWASP Authentication — Login Throttling](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling); [Authentication Responses](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#authentication-responses); [OWASP Password Storage — work-factor DoS trade-off](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#using-work-factors); [NIST SP 800-63B §3.2.2 Rate Limiting](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#rate-limiting-throttling).
- **Локальные ориентиры:** future auth service/handlers, PasswordHasher Semaphore, typed config and logging convention in `apps/api/src/modules/users/handlers/users.handlers.ts`.
- **Упражнение:** реализовать модель token bucket с TestClock: capacity 5, refill 1/minute; доказать burst/refill и независимые account/IP keys. Затем измерить unknown-email vs wrong-password с одинаковым scrypt workload, задать concurrency cap и проверить `429` policy throttling отдельно от `503` hashing-capacity overload.
- **Version note:** `5 + 1/minute` — стартовая локальная гипотеза, не рекомендация OWASP и не гарантия стойкости пароля. Теоретические ~525,600 online admissions/year ничего не говорят об offline cracking и не учитывают распределённые IP/accounts. Dummy hash не должен создавать unbounded CPU/RAM amplification.

### P1. Session lifecycle

- **Изучить:** absolute vs inactivity timeout; cleanup that never defines validity; revoke-current/revoke-all/revoke-by-internal-id; safe metrics/metadata; longer `expires_at` for remember-me.
- **Primary sources:** [OWASP Session Management — Expiration](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-expiration); [NIST SP 800-63B §5 Session Management](https://pages.nist.gov/800-63-4/sp800-63b/session/); [PostgreSQL 16 DELETE](https://www.postgresql.org/docs/16/sql-delete.html).
- **Локальные ориентиры:** planned `sessions.expires_at`, `id`, `user_id`; generated DB types and repository convention.
- **Упражнение:** freeze Clock on exact boundary and prove `expires_at == now` is invalid; cleanup delayed by a day must not authenticate expired row; revoking one internal id must not reveal or require raw token.
- **Version note:** Lucia reference below uses rolling expiration; wishlist milestone explicitly uses absolute seven-day expiration, so that behavior cannot be copied.

### P1. Password lifecycle

- **Изучить:** current-password reauthentication; single-use short-lived reset credential distinct from session; breached-password blocklist; longer passphrases; rehash-on-login; pepper rotation consequences.
- **Primary sources:** [NIST SP 800-63B §3.1.1 Passwords](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#password); [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html); [OWASP Password Storage — upgrading work factor](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#upgrading-the-work-factor); [NIST password blocklist requirements](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#passwordver).
- **Локальные ориентиры:** planned `password_credentials` lifecycle and AuthService transaction/error boundaries.
- **Упражнение:** design reset-token state machine `issued → consumed|expired`, prove replay fails, and list which sessions are revoked after change/reset. Parse old parameters and decide whether successful login triggers atomic rehash.
- **Version note:** current NIST SP 800-63B-4 says 15 minimum for single-factor and at least 64 maximum support; milestone 8–128 is an explicit local first-step contract and should be revisited in this P1 item, not silently changed mid-implementation.

### P1. Operational security

- **Изучить:** structured security events without credentials; retention/privacy; TLS/Secure deployment checks; response headers; backup/restore; availability and login-failure alerts.
- **Primary sources:** [OWASP Logging — Data to exclude](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude); [OWASP HTTP Security Response Headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html); [OWASP TLS](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html); [PostgreSQL 16 Backup and Restore](https://www.postgresql.org/docs/16/backup.html).
- **Локальные ориентиры:** `apps/api/src/modules/users/handlers/users.handlers.ts` structured annotations; `apps/api/src/server.ts`; `apps/api/src/config/config.ts`; auth tables migration.
- **Упражнение:** draft an event catalog with allowed fields and forbidden fields; restore a backup into isolated PostgreSQL and prove credentials/sessions retain FK/unique constraints without ever snapshotting raw tokens.
- **Version note:** Effect log annotations are rc.108 application primitives, but retention/alerting/TLS termination are deployment responsibilities. Never use `Redacted` as permission to persist a secret in telemetry.

### P2. Stronger authentication

- **Изучить:** WebAuthn RP ceremonies and public-key credentials; verified-email/recovery policy; MFA assurance and phishing resistance; OAuth authorization vs OIDC authentication; provider threat model and account linking; credential cardinality when several methods exist.
- **Primary sources:** [W3C WebAuthn Level 3 — RP operations](https://www.w3.org/TR/webauthn-3/#sctn-rp-operations); [NIST SP 800-63B AAL2/phishing resistance](https://pages.nist.gov/800-63-4/sp800-63b/aal/#aal2); [OpenID Connect Core 1.0 §3 Authentication](https://openid.net/specs/openid-connect-core-1_0-final.html#Authentication); [RFC 9700 OAuth 2.0 Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html); [RFC 7636 PKCE](https://www.rfc-editor.org/rfc/rfc7636.html).
- **Локальные ориентиры:** planned singular `password_credentials.user_id` model and `AuthenticatedSession` context; no OAuth/OIDC/WebAuthn module currently exists.
- **Упражнение:** нарисовать отдельные state machines WebAuthn registration/authentication и OIDC authorization-code+PKCE; отметить RP ID/origin/nonce/state/code-verifier validation and account-linking decision points.
- **Version note:** WebAuthn Level 3 прочитан как Candidate Recommendation snapshot 2026-05-26; выбирать production browser baseline отдельно. OAuth не является login protocol сам по себе; для authentication нужен OIDC. Не добавлять federation без product requirement.

## GitHub-репозитории: что перенять и что не копировать

1. **Effect repository, tag `v4.0.0-rc.108`** — [`Effect-TS/effect`](https://github.com/Effect-TS/effect/tree/v4.0.0-rc.108).
   - Перенять: точные signatures/semantics `HttpApiBuilder`, `HttpApiSecurity`, `HttpApiMiddleware`, `HttpApiTest`, `Redacted`, `SqlClient`; тесты рядом с этими modules как executable specification.
   - Не копировать: main branch, Effect 3 imports, unrelated examples; RC APIs unstable and must remain pinned.
2. **Kysely, tag `v0.29.5`** — [`kysely-org/kysely`](https://github.com/kysely-org/kysely/tree/v0.29.5).
   - Перенять: query-builder and migration semantics, exact `onConflict` behavior, type modelling.
   - Не копировать: direct Promise-based composition/transaction ownership in place of the repository’s Effect SQL/Kysely wrapper.
3. **Lucia repository, commit `e1ef2bc66a070f61813ed03d25c1ba8061c4d9f0`** — [`code/auth_session.ts`](https://github.com/lucia-auth/lucia/blob/e1ef2bc66a070f61813ed03d25c1ba8061c4d9f0/code/auth_session.ts).
   - Перенять как учебное наблюдение: CSPRNG secret, server-side hash, strict parsing, expiry check, constant-time comparison, cookie/CSRF warning.
   - Нельзя копировать как wishlist implementation: repository deprecated March 2025; example is framework-neutral Web Crypto + placeholder DB functions, models token as `id.secret`, uses rolling `tokenLastVerifiedAt`/10 days, SQLite sketch, `Path=/`, and its hand-written comparison instead of Node `timingSafeEqual`. Wishlist stores digest of decoded opaque token, uses independent session UUID, PostgreSQL, absolute 7 days and Effect services.
4. **EffectPatterns, commit `f3a0da2299717cf31d31313c5661cebd2446d5a3`** — [`api-authentication.mdx`](https://github.com/PaulJPhilp/EffectPatterns/blob/f3a0da2299717cf31d31313c5661cebd2446d5a3/content/published/patterns/building-apis/api-authentication.mdx) and its pinned [`package.json`](https://github.com/PaulJPhilp/EffectPatterns/blob/f3a0da2299717cf31d31313c5661cebd2446d5a3/package.json).
   - Перенять только идею: middleware validates credential and provides authenticated context; authorization remains a separate check.
   - Нельзя называть реализацией PostgreSQL sessions и нельзя копировать imports/API: это **Effect 3.19.19**, `@effect/platform 0.94.5`; example — упрощённый Bearer/JWT with fake token parsing, без PostgreSQL, cookies, password hashing и реальной JWT verification.

## Итоговые version caveats

- Любая ссылка на current Effect docs или community example должна считаться пояснительной, пока signature не совпала с installed rc.108 source.
- PostgreSQL `current` уже указывает на 18, тогда как dev image — 16.3; поэтому все DB semantics в карте привязаны к docs 16.
- MDN объясняет interoperable browser behavior, но нормативный источник cookie/CORS — RFC 6265/Fetch; оба слоя указаны рядом.
- NIST SP 800-63B-4 новее первоначального milestone contract; расхождение minimum password length явно вынесено в P1, а не скрыто.
- Ни один внешний auth repository не является архитектурой wishlist; заимствуются проверяемые invariants и способы наблюдения, не whole implementation.
