# PostgreSQL Session Authentication with Effect Resources

Этот каталог поддерживает миссию из `MISSION.md`: самостоятельно реализовать Session-аутентификацию в wishlist, а не скопировать чужой auth stack.

## Рекомендуемый маршрут чтения

Не читай всё заранее. Открывай один блок перед соответствующей фазой из `reference/implementation-roadmap.html`.

1. **Effect v4 Quickstart — 45–60 минут**  
   [Quickstart](https://effect.plants.sh/introduction/quickstart/) → service, typed error, Layer. Нужен перед фазами 1, 4 и 9.
2. **Pilcrow Auth Book — 75–90 минут**  
   [Sessions](https://auth.pilcrowonpaper.com/sessions) → [Auth sessions](https://auth.pilcrowonpaper.com/auth-sessions) → [CSRF](https://auth.pilcrowonpaper.com/csrf). Нужен перед фазами 3 и 5–8.
3. **Kysely + PostgreSQL schema — 45–60 минут**  
   [Kysely migrations](https://www.kysely.dev/docs/migrations) и [PostgreSQL 16 constraints](https://www.postgresql.org/docs/16/ddl-constraints.html). Нужен перед фазой 2.
4. **Транзакции — 45 минут**  
   [PostgreSQL transactions](https://www.postgresql.org/docs/16/tutorial-transactions.html) и [Kysely simple transaction](https://www.kysely.dev/docs/examples/transactions/simple-transaction). Нужен перед фазами 4–5; ownership транзакции всё равно задаёт Effect `SqlClient.withTransaction`.
5. **Password hashing — 75–120 минут плюс benchmark**  
   Сначала пройди локальный урок [`lessons/0002-bounded-password-hashing.html`](./lessons/0002-bounded-password-hashing.html), затем читай [Node 25 async scrypt](https://nodejs.org/docs/latest-v25.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [Node libuv thread pool](https://nodejs.org/docs/latest-v25.x/api/cli.html#uv_threadpool_sizesize) и [OWASP scrypt/work factors](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#using-work-factors). Нужен перед фазами 3 и 6.
6. **Effect HTTP — 45–60 минут**  
   [Middleware and auth](https://effect.plants.sh/http-api/middleware-and-auth/) и [Serving and clients](https://effect.plants.sh/http-api/serving-and-clients/). Нужен перед фазами 7 и 9.
7. **Cookies и CSRF — 30–45 минут**  
   [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) и [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Нужен перед фазами 7–9 и P0 hardening.
8. **Effect testing — 60–90 минут**  
   [Integration testing](https://effect.plants.sh/testing/integration-testing/). Нужен перед фазами 3, 7–9.

## Knowledge

### Основной manual по Session-аутентификации

- [Pilcrow Auth Book](https://auth.pilcrowonpaper.com/)
  Автор — Pilcrow, создатель Lucia. Это актуальная замена The Copenhagen Book и старой Lucia documentation. Читать конкретно:
  - [Sessions](https://auth.pilcrowonpaper.com/sessions) — Session ID, secret, hashing и expiration;
  - [Auth sessions](https://auth.pilcrowonpaper.com/auth-sessions) — создание и проверка Session после login;
  - [Passwords](https://auth.pilcrowonpaper.com/passwords) — password lifecycle;
  - [CSRF](https://auth.pilcrowonpaper.com/csrf) — почему cookie требует отдельной CSRF-модели.

  Использовать для threat model и переходов состояния. Не копировать предлагаемые `id.secret` и rolling expiration: wishlist использует один opaque token, отдельный внутренний UUID и фиксированные семь дней.

- [The Copenhagen Book](https://thecopenhagenbook.com/)
  Архивный предшественник Auth Book. Сам сайт сообщает, что книга заменена и больше не поддерживается. Использовать только для дополнительного объяснения threat model; при противоречии читать Auth Book.

- [Lucia: current replacement notice](https://lucia-auth.com/)
  Пакет Lucia deprecated с марта 2025. Сайт теперь ведёт к учебным материалам и single-file примерам, а не к auth library. Это полезная история архитектурного перехода, но не зависимость для wishlist.

### Effect

- [Effect v4 Quickstart](https://effect.plants.sh/introduction/quickstart/)
  Лучший короткий маршрут для `Effect<A, E, R>`, service и Layer перед проектированием AuthService. Документация v4 развивается; сигнатуры unstable HTTP/SQL всегда сверять с установленным `4.0.0-rc.108`.

- [Effect v4 Services](https://effect.plants.sh/services-and-layers/services/)
  Читать перед PasswordHasher, SessionTokenGenerator, repositories и AuthService. Цель — понять явную зависимость, а не автоматически создавать интерфейс для каждой функции.

- [Effect v4 HttpApi handlers](https://effect.plants.sh/http-api/handlers/)
  Читать перед signup/login handlers. Сопоставить с локальным `apps/api/src/modules/users/handlers/users.handlers.ts`.

- [Effect v4 Middleware and Auth](https://effect.plants.sh/http-api/middleware-and-auth/)
  Читать перед `/me`. Перенять middleware-provided Context. Cookie decoding и empty `Redacted` проверять по source `rc.108`.

- [Effect v4 Serving and Clients](https://effect.plants.sh/http-api/serving-and-clients/)
  Читать перед финальной Layer composition и HTTP smoke test.

- [Effect v4 Integration Testing](https://effect.plants.sh/testing/integration-testing/)
  Читать перед test Layers и `HttpApiTest`. In-memory test не доказывает реальное сохранение браузерной cookie.

- [Effect Solutions: Services and Layers — Kit Langton](https://www.effect.solutions/services-and-layers)
  Качественное объяснение service-driven design и Layer как constructor/resource boundary. Использовать для фаз 3–6 и 9. Это не auth tutorial и не reference установленной RC-сигнатуры.

- [Effect Solutions: Testing — Kit Langton](https://www.effect.solutions/testing)
  Практическое объяснение test implementations. Использовать для deterministic Clock и TokenGenerator.

- [Learn Effect — Tony Tang](https://learn-effect-ts.tonytang.dev/)
  Последовательный учебник по Effect mental model, Services, Layers, Redacted, Testing и Schema. Он закреплён на Effect `v3.12.0`; переносить идеи, но не импорты и HTTP API.

### PostgreSQL и Kysely

- [Kysely migrations](https://www.kysely.dev/docs/migrations)
  Читать перед миграцией auth. Ключевой принцип: migration должна быть frozen in time и не зависеть от текущих application types.

- [Kysely simple transaction](https://www.kysely.dev/docs/examples/transactions/simple-transaction)
  Использовать для понимания commit/rollback на уровне query builder. В wishlist owner транзакции — `AuthService.signup`, а механизм — установленный Effect `SqlClient.withTransaction`, не Promise callback в handler.

- [PostgreSQL 16: Constraints](https://www.postgresql.org/docs/16/ddl-constraints.html)
  Практический manual для PK, UNIQUE, FK и `ON DELETE CASCADE`. Версия 16 соответствует dev image проекта.

- [PostgreSQL 16: Transactions](https://www.postgresql.org/docs/16/tutorial-transactions.html)
  Короткий tutorial по атомарности signup и savepoints.

- [PostgreSQL 16: Transaction Isolation](https://www.postgresql.org/docs/16/transaction-iso.html)
  Не читать до появления конкретной concurrent anomaly. Использовать как справочник, а не добавлять isolation complexity заранее.

### Crypto, cookies и безопасность

- [Node 25 `crypto.scrypt`](https://nodejs.org/docs/latest-v25.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)
  Exact API для асинхронного scrypt, `N/r/p/maxmem` и соли. Не использовать `scryptSync` в request path.

- [Node 25 `UV_THREADPOOL_SIZE`](https://nodejs.org/docs/latest-v25.x/api/cli.html#uv_threadpool_sizesize)
  Подтверждает, что async `crypto.scrypt()` использует фиксированный libuv thread pool вместе с частью filesystem, DNS, zlib и других crypto API. Увеличение pool size не является лимитом памяти и может повысить число одновременно работающих hashes.

- [Node 25 `randomBytes`](https://nodejs.org/docs/latest-v25.x/api/crypto.html#cryptorandombytessize-callback)
  Exact API для 32-byte Session credential.

- [Node 25 `timingSafeEqual`](https://nodejs.org/docs/latest-v25.x/api/crypto.html#cryptotimingsafeequala-b)
  Читать ограничение одинаковой длины buffers. Функция не делает окружающий parsing автоматически timing-safe.

- [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
  Security policy для соли, scrypt floor и обновления work factor. Раздел Using Work Factors требует балансировать защиту и производительность: слишком дорогой hash может использоваться для DoS. Это не Node implementation manual.

- [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
  Читать Authentication Responses и Login Throttling перед login/P0: account-associated counters, threshold/window/duration и риск превратить lockout в DoS. Конкретный token bucket `5 + 1/min` — локальная стартовая гипотеза, не значение OWASP.

- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
  Browser manual для Domain, Path, Secure, HttpOnly, SameSite, Max-Age и Expires. Не источник сигнатур Effect.

- [MDN Fetch: Including credentials](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#including_credentials)
  Читать только если frontend обращается к API напрямую вместо dev proxy.

- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
  Origin verification, SameSite как defense-in-depth и CSRF token patterns. `HttpOnly` не решает CSRF.

## GitHub repositories

### Источники, которые надо читать рядом с кодом wishlist

1. [Effect `v4.0.0-rc.108`](https://github.com/Effect-TS/effect/tree/v4.0.0-rc.108)
   - Файлы: `packages/effect/src/unstable/httpapi/HttpApiSecurity.ts`, `HttpApiMiddleware.ts`, `HttpApiBuilder.ts`, `HttpApiTest.ts`, `unstable/sql/SqlClient.ts`, `Redacted.ts`.
   - Использовать: точные сигнатуры и поведение установленной версии для фаз 1 и 3–9.
   - Не копировать: `main` или Effect 3 imports.

2. [Auth Book, commit `f83054d`](https://github.com/pilcrowonpaper/auth.pilcrowonpaper.com/tree/f83054d8f8d73badf40508bf488e93b04657e7a3)
   - Файлы: `topics/sessions.html`, `auth_sessions.html`, `csrf.html`, `passwords.html`, `browser_client_side_storage.html`.
   - Использовать: reasoning и security invariants фаз 3 и 5–8.
   - Не копировать: это manual, а не Effect/PostgreSQL implementation.

3. [Lucia single-file Session example, commit `e1ef2bc`](https://github.com/lucia-auth/lucia/blob/e1ef2bc66a070f61813ed03d25c1ba8061c4d9f0/code/auth_session.ts)
   - Читать: `createAuthSession`, `validateAuthSessionToken`, `generateRandomId`, `constantTimeEqual` и CSRF sketch.
   - Использовать: CSPRNG, hashing, strict parsing, expiry и DB invalidation.
   - Не копировать: Web Crypto, SQLite placeholders, `id.secret`, handwritten comparison и rolling 10-day expiration.

4. [Kysely `v0.29.5`](https://github.com/kysely-org/kysely/tree/v0.29.5)
   - Файлы: `src/migration/migrator.ts`, `src/schema/schema.ts`, `src/kysely.ts`, `src/query-builder/on-conflict-builder.ts` и соседние tests.
   - Использовать: фазы 2, 4, 5; migration и query semantics.
   - Не копировать: direct Promise composition вместо локального Effect wrapper.

### Репозитории для сравнения, а не копирования

5. [Better Auth `1.7.1`, commit `6442317`](https://github.com/better-auth/better-auth/tree/6442317f55b041ca8e1f31ca0ace268cfe87671d)
   - Файлы: `docs/content/docs/concepts/session-management.mdx`, `packages/better-auth/src/api/routes/session.ts`, `sign-in.ts`, `sign-out.ts`, `cookies/index.ts`, `db/schema.ts` и session tests.
   - Использовать: test matrix, lifecycle vocabulary, сравнение sign-in/sign-out фаз 6–8.
   - Не копировать: usable token в БД, rolling refresh, cookie cache и swallowed delete failure. Wishlist требует digest-only storage и 503 при недоказанном отзыве.

6. [express-session, commit `96ebea4`](https://github.com/expressjs/session/tree/96ebea4b6cd805584fba04523773b1b918a836d7)
   - Файлы: `README.md`, `index.js`, tests по regenerate/destroy/cookie/store.
   - Использовать: зрелая operational vocabulary для фаз 7–9.
   - Не копировать: Express architecture, MemoryStore, signed SID и rolling defaults.

7. [connect-pg-simple, commit `c46daef`](https://github.com/voxpelli/node-connect-pg-simple/tree/c46daef6d06d257a0fb946ad90b9fb9a652bbe90)
   - Файлы: `table.sql`, `index.js`, `test/integration/main.spec.js`.
   - Использовать: сравнить index по expiration и cleanup tests на фазах 2, 4, 8.
   - Не копировать: generic `sid + sess JSON + expire` и callback API.

8. [Effect Days 2025 Workshop, commit `a0371c9`](https://github.com/Effect-TS/effect-days-2025-workshop/tree/a0371c9b3280662ae6426ab062cfeb308c7c787a)
   - Файлы: `slides.md`, exercises/solutions по services, errors, Layers и tests.
   - Использовать: практические упражнения перед фазами 3–6 и 9.
   - Не копировать: manifest использует Effect `3.14.8`.

### Проверены и сознательно исключены

- [EffectPatterns authentication pattern](https://github.com/PaulJPhilp/EffectPatterns/blob/f3a0da2299717cf31d31313c5661cebd2446d5a3/content/published/patterns/building-apis/api-authentication.mdx)
  Полезен только seam `middleware → authenticated Context`. Это Effect `3.19.19`, fake Bearer/JWT, без PostgreSQL Sessions и password hashing.

- `beep-effect`, проверенный commit `287ff0a`
  Auth/security slice или Better Auth integration не найден. Локальный документ о CRUD Provider — не auth example.

- Directus
  Session mode хранит access JWT в cookie и не соответствует opaque-token/digest PostgreSQL Session wishlist. Популярность не делает его подходящим precedent.

## Материалы по фазам

| Фаза            | Manual/tutorial                          | Репозиторий для чтения                            | Что должно стать понятным                           |
| --------------- | ---------------------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| 1. Contracts    | Effect Quickstart, Schema, Handlers      | Effect rc.108 + локальный users module            | Schema boundary, status/error contract              |
| 2. Persistence  | Kysely Migrations, PG Constraints        | Kysely, connect-pg-simple для сравнения           | FK, cascade, indexes, up/down                       |
| 3. Crypto       | Auth Book Sessions, Node scrypt, OWASP   | Lucia single-file example                         | slow password hash vs fast random-token digest      |
| 4. Repositories | Kysely transaction, PG error codes       | Kysely + локальный UsersRepository                | narrow operations, row decode, SQLSTATE mapping     |
| 5. Signup       | PG transaction tutorial, Effect handlers | Effect SqlClient source                           | один owner транзакции и cookie after commit         |
| 6. Login        | Auth Book Passwords, OWASP responses     | Better Auth sign-in tests как сравнение           | generic 401, fresh Session, typed integrity failure |
| 7. Middleware   | Effect Middleware/Auth, Auth Book CSRF   | Effect rc.108 HttpApi source                      | cookie → digest → Context → handler                 |
| 8. Logout       | Auth Sessions, MDN deletion              | Better Auth и express-session как counterexamples | idempotency, one-session revoke, expiry cookie      |
| 9. Runtime      | Effect Serving/Testing, MDN Fetch        | Effect + express-session operational tests        | Layer composition и real cookie transport           |

## Wisdom: где задавать вопросы

- [Effect Discord](https://discord.gg/effect-ts)
  Для вопроса всегда указывать `effect@4.0.0-rc.108`, unstable import и минимальный type error/reproduction.

- [Effect GitHub](https://github.com/Effect-TS/effect)
  Искать adjacent source/tests или заводить узкий issue только после проверки installed source.

- [Auth Book discussions](https://github.com/pilcrowonpaper/auth.pilcrowonpaper.com/discussions) и [Pilcrow Discord](https://discord.gg/zZqCfVUMnX)
  Для threat model, Session/CSRF/password lifecycle. Не для Effect API.

- [Kysely GitHub](https://github.com/kysely-org/kysely)
  Для exact `v0.29.5` builder/migration semantics после минимального SQL reproduction.

- [PostgreSQL mailing lists](https://www.postgresql.org/list/)
  Для SQLSTATE, locking и isolation после воспроизводимого SQL-сценария.

- [OWASP Cheat Sheet Series repository](https://github.com/OWASP/CheatSheetSeries)
  Для обсуждения security policy; не для framework signatures.

## Gaps

- Не найден end-to-end tutorial с тем же сочетанием Effect 4 RC, Kysely, PostgreSQL, opaque Sessions, HttpOnly cookie и Node scrypt.
- Не найден качественный practitioner tutorial, который полностью покрывает async Node 25 scrypt, versioned format, defensive parsing, `maxmem` и benchmark. Здесь первичные Node/OWASP материалы надёжнее SEO snippets.
- Effect v4 documentation развивается; установленный source `rc.108` остаётся API truth.
- Lucia deprecated; актуальный учебный путь — Auth Book и ограниченный single-file example.
- Better Auth, Express и Lucia полезны как сравнение, но имеют другую Session model и failure policy.
- Нет внешнего репозитория с тем же logout contract: idempotent 204, но 503 при недоказанном отзыве presented credential.
