# Curriculum проекта Wishlist

## Назначение

Wishlist — учебный транспорт для освоения backend-разработки. Маршрут строится не вокруг каталога технологий, а вокруг законченного продуктового пути: зарегистрированный User создаёт Wishlist, делится им, другой User или Guest резервирует Wishlist Item, а конкурентные запросы и сбои не нарушают инварианты.

Для каждого шага действует один цикл:

1. появляется наблюдаемая проблема;
2. изучается минимально необходимая концепция;
3. владелец проекта выполняет одну небольшую backend-задачу;
4. агент проверяет поведение узким сценарием;
5. владелец простыми словами объясняет состояние, ошибку и границу ответственности;
6. только после этого открывается следующий шаг.

Код и конфигурация — источник истины. Документы задают намерение, но при расхождении сначала фиксируется расхождение. Оценки mastery в `progress.md` предварительные, пока навык не подтверждён практикой.

## Фаза 0 — Надёжный цикл проверки и security primitives

**Цель:** восстановить быстрый тестовый feedback loop и закончить криптографические примитивы, без которых Session-аутентификация небезопасна.

**Функциональность:** приложение ещё не получает новый endpoint; появляются корректные `SecureRandomBytes`, `SessionTokenGenerator` и `PasswordHasher`, готовые к использованию в auth use cases.

**Предыдущие знания:** strict TypeScript, ESM imports, Effect basics, Schema, Vitest, существующие auth-контракты и миграция `0002_auth.ts`.

**Knowledge**

- Различать создание `Effect`, его выполнение и время жизни значения внутри `Layer`.
- Понимать разницу между raw credential, SHA-256 digest и `Redacted`.
- Понимать canonical base64url и версионированный формат password hash.
- Понимать, что async `crypto.scrypt` уходит в libuv worker pool, но всё равно расходует ограниченную память.
- Различать typed failure, defect и interruption.

**Implementation**

- Исправить setup тестов и довести типизированные Result matchers до одного подтверждённого сценария.
- Создать минимальный test seam для детерминированных secure random bytes.
- Реализовать выдачу нового Session credential и digest на каждый запуск `generate`.
- Реализовать hash/verify для пароля с точным локальным форматом.
- Ограничить активные и ожидающие scrypt-операции после измерения memory/latency budget.

**Reasoning**

- Обосновать, почему random bytes запрашиваются внутри эффекта операции, а не при сборке `Layer`.
- Обосновать границы `SecureRandomBytes`, не превращая его в абстракцию «на будущее».
- Выбрать concurrency budget по памяти и измерениям, а не по числу CPU.
- Объяснить, почему `Redacted` снижает риск случайного вывода, но не заменяет hashing/encryption.

**Debugging**

- Отличать ошибку test collection/setup от падения конкретного теста.
- Находить повторное использование случайного значения из-за неверного lifetime.
- Диагностировать malformed/non-canonical stored hash до запуска scrypt.
- Проверять, что permit удерживается до native callback даже при interruption.

**Практические задачи:** шаги `0.1–0.11` в `roadmap.md`.

**Mastery:** фаза завершена, когда владелец сам реализует и объясняет оба сервиса, тесты доказывают свежесть credential, точность digest, round-trip password verification, malformed hash, overload и interruption semantics, а выбранный budget записан вместе с измерениями.

**Открывает:** credential/session repositories и транзакционные auth use cases.

## Фаза 1 — Полный срез PostgreSQL Session authentication

**Цель:** заменить доверие к публичному `userId` на аутентифицированную Session.

**Функциональность:** `signup`, `login`, `me`, `logout` работают через PostgreSQL Sessions и HTTP-only cookie.

**Предыдущие знания:** фаза 0; auth HttpApi/Schema-контракты и таблицы уже существуют.

**Knowledge**

- Session, Password Credential и User как разные состояния и жизненные циклы.
- Transaction boundary для signup.
- Cookie attributes, required/optional credential flows и generic public auth errors.
- Dependency requirements и композиция `Context.Service`/`Layer`.

**Implementation**

- Реализовать Password Credential и Session repositories только с нужными запросами.
- Реализовать `AuthService` для четырёх use cases.
- Реализовать auth handlers, security middleware и cookie issuance/expiration.
- Подключить auth group, handlers и Layers к live application.
- Провести clean cutover от credential-free `POST /api/users`.

**Reasoning**

- Выбрать владельца транзакции: use case, а не HTTP handler и не отдельный insert.
- Обосновать одинаковый `401` для unknown email/wrong password и invalid Session.
- Объяснить, почему logout удаляет только представленную Session и остаётся идемпотентным.

**Debugging**

- Разделять validation, domain, persistence и data-integrity failures.
- Диагностировать missing Layer requirement.
- Проверять cookie реально через Node HTTP client/cookie jar, а не только fake handlers.
- Доказывать rollback при каждом неуспешном insert signup.

**Практические задачи:** шаги `1.1–1.11`.

**Mastery:** владелец без готового решения собирает dependency graph, реализует use cases и объясняет success/failure/interruption paths; contract, PostgreSQL integration и реальный cookie-jar сценарий проходят.

**Открывает:** ownership и защищённый private profile.

## Фаза 2 — User identity, Public Profile и authorization boundary

**Цель:** отделить внутреннего User от публичной проекции и убрать публичный cross-User CRUD.

**Функциональность:** User читает и изменяет только свой private profile; наружу готова безопасная Public Profile shape без login email.

**Предыдущие знания:** authenticated principal из фазы 1.

**Knowledge**

- Authentication против authorization.
- Internal model против response projection.
- Clean schema/data migration с nullable structured names на required Display Name.
- Information disclosure через `403`, `404`, logs и response shapes.

**Implementation**

- Провести миграцию Display Name через schema, persistence, contracts и tests.
- Передавать principal из middleware в protected handlers.
- Удалить/заменить публичные User endpoints, не оставляя обходной alias.
- Создать Public Profile response без email.

**Reasoning**

- Обосновать, где проверяется ownership и почему одного route parameter недостаточно.
- Выбрать безопасную семантику absent/forbidden.

**Debugging**

- Воспроизводить попытку User A обратиться к данным User B.
- Искать утечки private fields в projection, logs и errors.

**Практические задачи:** шаги `2.1–2.6`.

**Mastery:** User A не может читать/менять User B, public response не содержит email, а владелец объясняет путь principal от cookie до SQL predicate.

**Открывает:** owner-only Wishlist aggregate.

## Фаза 3 — Owner-only Wishlists

**Цель:** ввести первый настоящий aggregate и его ownership invariant.

**Функциональность:** authenticated User создаёт, перечисляет, читает, обновляет и удаляет собственные Wishlists.

**Предыдущие знания:** authorization boundary, migrations, Schema, repositories и typed errors.

**Knowledge**

- Aggregate boundary и invariant ownership.
- Date-only Occasion Date, ISO currency и runtime validation.
- Stable ordering, pagination и scoped mutations.

**Implementation**

- Добавить минимальную Wishlist migration и generated DB types.
- Реализовать owner-scoped CRUD и pagination.
- Проверять `wishlistId + ownerId` одним persistence predicate.
- Вернуть typed validation/not-found/conflict/persistence errors.

**Reasoning**

- Обосновать поля текущим UI/product path, не будущей универсальностью.
- Решить идемпотентность delete явно в HTTP contract.

**Debugging**

- Диагностировать off-by-one/cursor bugs и нестабильную сортировку.
- Проверять, что другой User не может даже косвенно определить Private Wishlist.

**Практические задачи:** шаги `3.1–3.7`.

**Mastery:** owner CRUD и boundary matrix доказаны интеграционно; владелец объясняет, какой SQL predicate обеспечивает ownership.

**Открывает:** sharing policy и Public Profile reads.

## Фаза 4 — Sharing Links и Public Profiles

**Цель:** добавить чтение без ослабления owner authorization.

**Функциональность:** Private, Unlisted и Public Wishlists имеют разные способы обнаружения и доступа; sharing link можно ротировать и инвалидировать.

**Предыдущие знания:** Wishlist aggregate и Session authorization.

**Knowledge**

- Capability credential и отличие public key от internal UUID.
- Central authorization policy для visibility states.
- Credential leakage и stale-read risks.

**Implementation**

- Хранить digest/ключ Sharing Link с собственным lifecycle.
- Реализовать public/unlisted projections и Public Profile lookup.
- Атомарно инвалидировать старую ссылку при снижении visibility.

**Reasoning**

- Обосновать одну policy вместо разбросанных boolean checks.
- Объяснить, почему UUID сущности не является sharing credential.

**Debugging**

- Проверять старые ссылки после каждого state transition.
- Искать email, holder identity и sharing credentials в ответах/логах.

**Практические задачи:** шаги `4.1–4.6`.

**Mastery:** вся visibility matrix и rotation проходят; владелец объясняет каждый переход состояния и его транзакционную границу.

**Открывает:** visitor projection для Wishlist Items.

## Фаза 5 — Wishlist Items и точные значения

**Цель:** завершить ручное наполнение Wishlist до внешних интеграций.

**Функциональность:** owner управляет Wishlist Items; owner и visitors получают безопасные projections и детерминированную сортировку.

**Предыдущие знания:** aggregate ownership, visibility policy, Schema и SQL ordering.

**Knowledge**

- Money representation без floating point.
- Parent-scoped authorization.
- Deterministic sorting и `NULLS LAST` semantics.
- User-owned snapshot против live external Product.

**Implementation**

- Добавить item persistence, owner CRUD и projections.
- Реализовать HTTPS source URL только как данные.
- Реализовать priority/price ordering и currency invariant.

**Reasoning**

- Выбрать minor units или точный decimal и обосновать trade-off.
- Не связывать чтение Item с доступностью marketplace.

**Debugging**

- Проверять округление, currency changes и ties в сортировке.
- Доказывать отсутствие outbound request на visitor read.

**Практические задачи:** шаги `5.1–5.6`.

**Mastery:** title-only Item работает, цены точны, сортировка стабильна, а смена currency при priced Items имеет явный контракт.

**Открывает:** Reservation state machine.

## Фаза 6 — Concurrent Reservations для Users

**Цель:** доказать главный concurrency invariant до добавления email identity.

**Функциональность:** authenticated User резервирует/cancel Item; owner force-releases; identity holder не раскрывается.

**Предыдущие знания:** transactions, PostgreSQL constraints, owner/visitor projections.

**Knowledge**

- State machine, active/terminal states и idempotency.
- Database-enforced uniqueness при нескольких API replicas.
- Race conditions и conflict mapping.
- Command–Decider–Event как чистый domain module: `decide(state, command)` возвращает события или domain error, `evolve(state, event)` строит следующее состояние.
- Отличие Decider от Event Sourcing: события можно использовать для принятия решения, продолжая хранить current state в PostgreSQL.

**Implementation**

- Добавить Reservation lifecycle и partial unique constraint/index.
- Реализовать reserve/cancel/release/delete transitions.
- Добавить holder-aware projection `free | reserved | reservedByMe`.
- Сначала реализовать чистый `ReservationDecider` без Effect, SQL и HTTP, затем подключить его внутри транзакционного use case.

**Reasoning**

- Обосновать PostgreSQL как владельца single-active invariant.
- Отличить idempotent retry от скрытого подавления конфликта.
- Сравнить прямую реализацию переходов с Decider по размеру interface, локальности правил и простоте тестов.
- Не распространять паттерн на Users CRUD или весь проект, пока там нет state-transition complexity, которая окупает новый interface.

**Debugging**

- Запускать два конкурентных reserve request и читать фактический DB result.
- Проверять terminal history и последующую новую Reservation.

**Практические задачи:** шаги `6.1–6.8`.

**Mastery:** чистый Decider исчерпывающе проверяет допустимые переходы, конкурентный сценарий даёт ровно один success и один domain conflict, identity нигде не протекает; владелец объясняет, почему Decider не заменяет PostgreSQL constraint и не требует Event Sourcing.

**Открывает:** Guest identity и durable email work.

## Фаза 7 — Guest access и PostgreSQL outbox

**Цель:** закончить product path «открыть по ссылке без регистрации», не теряя email work.

**Функциональность:** Guest получает Wishlist-scoped Session через magic link, резервирует Item; worker доставляет email из PostgreSQL outbox.

**Предыдущие знания:** Session model, Reservation state machine, transactions.

**Knowledge**

- Single-use challenge, digest-only credentials и scoped principal.
- Transactional outbox, at-least-once delivery, claim/retry и idempotent handler.
- API process против worker process.
- Worker claim/lease lifecycle, graceful shutdown и восстановимость in-flight job после `SIGTERM`.

**Implementation**

- Добавить challenge, Guest Session и outbox persistence.
- Реализовать request/consume magic link без временной блокировки Item.
- Создать worker entrypoint и local capture email adapter.
- Очистить raw delivery payload по retention policy.
- Реализовать остановку новых claims, bounded drain текущей job и освобождение DB/runtime resources через Effect Scope.

**Reasoning**

- Обосновать, почему Guest не становится User даже при совпадении email.
- Обосновать outbox конкретным crash window, а не модой на messaging.

**Debugging**

- Воспроизводить crash после commit и до send.
- Проверять duplicate delivery/retry и cross-Wishlist isolation.
- Послать `SIGTERM` во время обработки job и отличить корректное завершение от recoverable lease после restart.

**Практические задачи:** шаги `7.1–7.9`.

**Mastery:** worker restart не теряет committed work, retry безопасен, Guest Session A не работает для Wishlist B; при `SIGTERM` новые claims прекращаются, а текущая job завершается либо остаётся восстановимой.

**Открывает:** запуск для внешних пользователей.

## Фаза 8 — Security и operational hardening

**Цель:** закрыть реальные угрозы перед внешним доступом.

**Функциональность:** CSRF/origin policy, rate limits, password lifecycle, Session cleanup/revoke-all, backup/restore и PII-safe audit.

**Предыдущие знания:** полный auth и email path, наблюдаемые abuse boundaries.

**Knowledge**

- CSRF, credentialed CORS, rate limiting и enumeration resistance.
- Password reset/change, Session revocation policy и data retention.
- Backup/restore как проверяемое свойство.

**Implementation**

- Вводить controls в risk order из product plan.
- Добавить metrics/audit без credential и PII leakage.
- Реализовать User deletion lifecycle.

**Reasoning**

- Разделять core correctness и production hardening.
- Ставить abuse control до дорогого hashing/email.

**Debugging**

- Проверять bypass paths, proxy/origin configuration и cleanup races.
- Проводить restore exercise, а не только создавать backup.

**Практические задачи:** шаги `8.1–8.6`.

**Mastery:** security scenarios выполняются на live topology; владелец может назвать threat, control, остаточный риск и проверку.

**Открывает:** безопасные внешние media/import boundaries.

## Фаза 9 — Service-owned images

**Цель:** освоить file/object-storage boundary до удалённого импорта.

**Функциональность:** безопасная ручная загрузка и lifecycle изображений в S3-compatible storage.

**Knowledge:** magic bytes, content type, size/dimension limits, metadata stripping, immutable object keys, orphan cleanup.

**Implementation:** MinIO/S3 adapter как Effect service, upload pipeline, controlled read URLs, lifecycle job.

**Reasoning:** отделить DB metadata от object bytes; выбрать consistency и cleanup policy.

**Debugging:** disguised files, oversized/decompression cases, orphan leaks, multi-replica visibility.

**Практические задачи:** шаги `9.1–9.5`.

**Mastery:** hostile fixture rejected до persistence; replace/delete не оставляет бесконтрольные private objects.

**Открывает:** безопасное копирование accepted remote image.

## Фаза 10 — Асинхронный Import Preview

**Цель:** добавить URL enrichment, не делая marketplace частью write/read availability.

**Функциональность:** `202 Accepted` preview job, polling, безопасный fetch, untrusted suggestions и явное применение выбранных полей.

**Knowledge:** SSRF, DNS/redirect revalidation, time/byte/decompression bounds, Open Graph/JSON-LD trust boundary, optimistic version check.

**Implementation:** curated provider registry, restricted worker fetch, preview lifecycle, apply/diff/refresh.

**Reasoning:** обосновать async boundary и manual fallback; не обещать поддержку недокументированных marketplace APIs.

**Debugging:** loopback/metadata redirects, DNS rebinding, challenge pages, stale preview overwrite.

**Практические задачи:** шаги `10.1–10.6`.

**Mastery:** security fixture matrix проходит; provider failure не ломает manual workflow и существующие Items.

**Открывает:** измеряемые scale experiments.

## Фаза 11 — Scale lab по измерениям

**Цель:** изучать distributed systems только после появления работающего пути и измеримой проблемы.

**Функциональность:** multi-instance correctness, observability baseline, query/index tuning; cache, Request batching, search engine, broker или отдельное event storage появляются только при доказанном gate.

**Knowledge:** topology, saturation, backpressure, N+1, cache invalidation ownership, delivery contracts, цена Event Sourcing/CQRS и operational trade-offs.

**Implementation:** запуск нескольких API/workers, workload model, metrics, query plans и failure experiments; optional laboratories выполняются изолированно и не меняют production path.

**Reasoning:** по данным решить, оставаться на простом PostgreSQL current-state design или вводить новую инфраструктуру; отдельно объяснить, какую новую проблему решает каждый дополнительный interface.

**Debugging:** race между replicas, outbox contention, stale authorization cache, retry storms, projection lag и replay/version conflicts.

**Практические задачи:** шаги `11.1–11.5`; необязательные лаборатории `L1–L4` из `roadmap.md` не блокируют завершение продукта.

**Mastery:** владелец формулирует bottleneck по наблюдениям, сравнивает минимум две альтернативы и доказывает результат повторяемым экспериментом; успешный учебный prototype не считается основанием для production adoption без отдельного requirement.

## Общий критерий перехода

Фаза не завершается по наличию файлов. Для перехода нужны одновременно:

- работающий observable contract;
- узкая проверка, которая падала бы при удалении инварианта;
- объяснение состояния до/после операции;
- объяснение success, typed failure, defect, interruption и retry там, где они применимы;
- самостоятельная реализация с помощью не выше заявленного mastery.
