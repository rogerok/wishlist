# Roadmap от текущего состояния до законченного Wishlist

## Как проходить шаг

Каждая строка — одна учебная итерация. Агент сначала раскрывает только концепцию текущего шага, затем владелец проекта реализует задачу. Агент проверяет указанное наблюдаемое поведение и задаёт один вопрос из колонки «Проверка понимания». Следующий шаг не выдаётся, пока текущий не объяснён и не проверен.

Текущий шаг отмечен `→`.

## 0. Feedback loop и security primitives

| Шаг   | Практическая проблема                                            | Концепция                                                                  | Маленькая задача владельца                                                                         | Проверка агента                                                      | Проверка понимания                                                              |
| ----- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| → 0.1 | Vitest не собирает ни один из 8 suite: setup module не найден    | Разрешение ESM-пути `setupFiles`; collection failure против test failure   | Сопоставить `vitest.config.ts` с фактическим matcher-файлом и сделать минимальное исправление пути | Запустить один schema test, затем API test; оба должны быть собраны  | Почему `check-types` прошёл, хотя test runner не смог импортировать setup file? |
| 0.2   | Custom Result matcher пока не доказан на реальном тесте          | Declaration merging и runtime `expect.extend` — две части одного extension | Перевести один существующий Result assertion на matcher, не меняя contract теста                   | Typecheck и один целевой test                                        | Что сломается, если оставить только `.d.ts` или только `expect.extend`?         |
| 0.3   | `SessionTokenGeneratorLive` получает bytes во время сборки Layer | Lazy Effect и Layer lifetime                                               | Написать детерминированный test seam, вызывающий generator дважды с двумя наборами bytes           | Тест должен доказать два обращения по 32 bytes и разные результаты   | В какой момент должен выполняться `randomBytes.get(32)` и почему?               |
| 0.4   | Node random API может throw/fail вне typed channel               | Callback/sync boundary и typed infrastructure failure                      | Реализовать live `SecureRandomBytes` adapter с проверкой размера результата                        | Success test и injected failure test без утечки bytes                | Где заканчивается defect библиотеки и начинается typed failure сервиса?         |
| 0.5   | Клиенту нужен raw token, БД — только digest                      | Credential boundary, SHA-256, canonical base64url, `Redacted`              | Реализовать один `generate` без логирования/повторной генерации                                    | 43-char credential; digest ровно 32 bytes; known-vector check        | Почему digest считается от raw bytes, а не от base64url text?                   |
| 0.6   | Генератор может незаметно переиспользовать token                 | Freshness invariant                                                        | Добавить поведенческий тест двух последовательных generation                                       | Оба credential/digest различаются при разных injected bytes          | Какой тест поймает случайное вычисление token при Layer construction?           |
| 0.7   | Для PasswordHasher пока нет полного error/service contract       | Error algebra и маленький service interface                                | Зафиксировать signatures `hash`/`verify` и три класса failures без secret payload                  | Typecheck signatures; объяснение каждой ошибки                       | Почему malformed stored hash не равен неверному паролю?                         |
| 0.8   | Параметры scrypt требуют реального memory budget                 | libuv worker pool, RSS/latency benchmark                                   | Сделать локальный benchmark и записать измерения для 1/2/… concurrent calls                        | Повторяемая команда, latency и peak RSS                              | Почему `UV_THREADPOOL_SIZE` не задаёт допустимое число hash operations?         |
| 0.9   | Async scrypt нельзя отменить после native submission             | `Effect.callback`, interruption и resource lifetime                        | Реализовать одну hash/verify operation с permit до callback                                        | Interrupt experiment подтверждает отсутствие раннего release         | Что продолжает работать после interruption fiber?                               |
| 0.10  | Semaphore ограничивает active work, но очередь может расти       | Bounded admission и overload                                               | Добавить лимит admitted work и typed immediate overload                                            | Тест capacity: active, waiting, rejected                             | Чем execution capacity отличается от admission capacity?                        |
| 0.11  | Нужно доказать crypto contract целиком                           | Round-trip, mismatch и canonical parsing                                   | Завершить behavior tests PasswordHasher                                                            | hash→verify true; wrong password false; malformed hash typed failure | Какие inputs допускаются до вызова scrypt?                                      |

**Выход фазы:** `check-types`, crypto tests и узкий interruption/overload experiment проходят; в `docs/auth/NOTES.md` не остаётся нерешённых решений Phase 3.

## 1. PostgreSQL Session authentication

| Шаг  | Практическая проблема                                | Концепция                                     | Маленькая задача владельца                                           | Проверка агента                                                             | Проверка понимания                                         |
| ---- | ---------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1.1  | Auth use cases не могут сохранять credentials        | Repository boundary для чувствительных данных | Реализовать insert/load Password Credential с точной error mapping   | Testcontainers: insert, duplicate, invalid record                           | Почему обычный User query не выбирает password hash?       |
| 1.2  | Sessions ещё нельзя создать/разрешить/удалить        | Digest lookup и expiration predicate          | Реализовать минимальный SessionsRepository                           | create, valid lookup, expired miss, delete current                          | Где авторитетно решается валидность Session?               |
| 1.3  | Signup состоит из трёх зависимых writes              | Transaction boundary                          | Реализовать signup transaction в `AuthService`                       | Fault после каждого insert оставляет 0 частичных строк                      | Почему transaction принадлежит use case?                   |
| 1.4  | Signup должен вернуть cookie и public User           | HTTP adapter responsibility                   | Подключить signup handler и cookie issuance                          | HTTP integration: 201, body, cookie attributes                              | Какие данные не должны перейти из service в response/logs? |
| 1.5  | Login не должен раскрывать, что именно неверно       | Enumeration-resistant error contract          | Реализовать password lookup/verify и fresh Session                   | Unknown email и wrong password дают один 401; success создаёт новую Session | Почему нельзя вернуть разные ошибки для email и password?  |
| 1.6  | `/me` пока не получает principal                     | HttpApi security middleware и Context         | Разрешить required cookie в `AuthenticatedSession`                   | missing/malformed/unknown/expired одинаково 401                             | Почему пустой decoded credential нужно проверить явно?     |
| 1.7  | Logout имеет другую optional credential semantics    | Идемпотентность и optional authentication     | Реализовать delete current Session и expire cookie                   | No cookie/unknown cookie 204; DB failure 503                                | Почему logout не должен ослаблять middleware `/me`?        |
| 1.8  | Auth contracts существуют только в isolated tests    | Live Layer composition                        | Добавить auth group/handlers/services в `AppApi` и `AppServicesLive` | App boots; dependency graph без missing services                            | Что предоставляет Layer и что он требует?                  |
| 1.9  | Старый `POST /api/users` обходит Password Credential | Clean cutover                                 | Удалить credential-free public creation и мигрировать callers/tests  | Публичного обходного endpoint нет                                           | Какой security invariant ломает старый endpoint?           |
| 1.10 | In-memory test не доказывает browser transport       | Process-level smoke test                      | Запустить signup→me→login→logout через cookie jar                    | Реальный Node server и PostgreSQL проходят сценарий                         | Что этот smoke test доказывает сверх HttpApi handler test? |
| 1.11 | Auth slice должен иметь понятную failure map         | Feynman checkpoint                            | Нарисовать state transitions и dependency graph                      | Устное/текстовое объяснение без подсказки                                   | Какие строки остаются после failed signup и почему?        |

## 2. Identity и authorization

1. **2.1 — Display Name contract.** Проблема: текущие nullable `firstName/middleName/lastName` расходятся с доменной моделью. Концепция: clean schema cutover. Задача: сначала изменить runtime/HTTP contract и boundary tests. Проверка: old shape rejected, required Display Name accepted. Вопрос: почему два параллельных name-моделя опаснее одной миграции?
2. **2.2 — Data migration.** Задача: мигрировать PostgreSQL schema/data и regenerated Kysely types. Проверка: migration from existing schema и `db:check`. Вопрос: где находится необратимый риск?
3. **2.3 — Authenticated private profile.** Задача: заменить arbitrary `:id` на current principal для read/update. Проверка: User A не может выбрать User B. Вопрос: почему проверка только в handler недостаточна?
4. **2.4 — Public Profile projection.** Задача: создать отдельный response без email. Проверка: schema и HTTP response не содержат private fields. Вопрос: почему `Omit` TypeScript не является runtime boundary?
5. **2.5 — Remove public CRUD.** Задача: удалить неразрешённые list/get/update/delete routes и callers. Проверка: route inventory и HTTP 404/contract absence. Вопрос: чем clean cutover безопаснее deprecated alias?
6. **2.6 — Authorization matrix.** Задача: записать и проверить owner/other/anonymous cases. Проверка: конечная table-driven matrix. Вопрос: когда `404` безопаснее `403`?

## 3. Owner-only Wishlists

1. **3.1 — Минимальный aggregate contract.** Определить title, description, Occasion Date, visibility, Wishlist Currency. Проверка: boundary matrix Schema. Вопрос: какие поля нужны текущему product path?
2. **3.2 — Persistence invariant.** Добавить migration/FK/indexes и generated types. Проверка: migration test. Вопрос: что гарантирует FK при удалении owner?
3. **3.3 — Create/read one.** Реализовать два use case с owner ID. Проверка: integration test owner/other. Вопрос: где должен участвовать owner ID?
4. **3.4 — List and pagination.** Добавить stable `(createdAt,id)` ordering и ограниченный page size. Проверка: ties и page boundary. Вопрос: почему order только по timestamp нестабилен?
5. **3.5 — Update.** Scope SQL mutation по `wishlistId + ownerId`. Проверка: affected row semantics. Вопрос: какую утечку создаёт отдельная предварительная ownership query?
6. **3.6 — Delete semantics.** Явно выбрать idempotent/not-found contract и реализовать его. Проверка: repeated delete. Вопрос: где этот выбор видит HTTP consumer?
7. **3.7 — Vertical smoke.** Signup→create→list→update→delete. Проверка: real server/PostgreSQL. Вопрос: какие boundary пересёк сценарий?

## 4. Sharing и Public Profiles

1. **4.1 — Visibility state table.** До кода выписать actor × visibility × credential. Проверка: исчерпывающая таблица. Вопрос: где одна policy уменьшает расхождения?
2. **4.2 — Sharing credential.** Добавить high-entropy URL-safe key/digest отдельно от UUID. Проверка: generation/lookup без логирования raw key. Вопрос: почему UUID не capability secret?
3. **4.3 — Unlisted read.** Реализовать доступ только по current key. Проверка: wrong/old key denied. Вопрос: кто является principal этого запроса?
4. **4.4 — Public Profile read.** Выдать Display Name и только Public Wishlists. Проверка: Private/Unlisted absent. Вопрос: чем discoverability отличается от readability?
5. **4.5 — Visibility transitions.** Атомарно rotate/invalidate при снижении visibility. Проверка: вся transition matrix. Вопрос: почему update и invalidation должны commit вместе?
6. **4.6 — Leakage audit.** Проверить responses/logs/metrics. Проверка: нет email, holder или key. Вопрос: какие данные являются credentials?

## 5. Wishlist Items

1. **5.1 — Item contract.** Title-only success; optional URL/price/priority/comment. Проверка: Schema boundaries. Вопрос: почему remote metadata не является обязательной частью Item?
2. **5.2 — Exact money.** Выбрать minor units или exact decimal и написать invariant. Проверка: значения, которые ломают float. Вопрос: какой trade-off у выбранного представления?
3. **5.3 — Parent-scoped persistence.** Migration и queries через parent Wishlist ownership. Проверка: cross-owner matrix. Вопрос: почему Item authorization начинается с Wishlist?
4. **5.4 — Owner CRUD.** По одной операции с узкой integration проверкой. Проверка: create/update/delete. Вопрос: какие failures domain, а какие persistence?
5. **5.5 — Sorting.** Priority-first default и price asc/desc с missing last. Проверка: ties/nulls. Вопрос: какой последний tie-breaker делает порядок стабильным?
6. **5.6 — Visitor projection.** Public read без outbound fetch. Проверка: controlled network spy и response shape. Вопрос: почему read availability не должна зависеть от marketplace?

## 6. User Reservations

1. **6.1 — State machine.** Записать active/terminal transitions, commands, events и actors. Проверка: запрещённые переходы видимы до кода. Вопрос: почему terminal history не удаляется?
2. **6.2 — Pure ReservationDecider.** Реализовать маленький чистый module с `decide(state, command) → events | domain error` и `evolve(state, event) → state`, без Effect, SQL и HTTP. Проверка: table-driven tests всей transition matrix. Вопрос: какую сложность Decider скрывает от caller?
3. **6.3 — Adoption gate.** Сравнить Decider с прямыми conditional transitions по interface, локальности правил и tests. Оставить Decider только для Reservation lifecycle; current state продолжить хранить в PostgreSQL. Проверка: events воспроизводят новое state, event store отсутствует. Вопрос: почему Command–Decider–Event не требует Event Sourcing?
4. **6.4 — Database constraint.** Добавить single-active invariant. Проверка: две concurrent transactions. Вопрос: почему чистый Decider и process lock не подходят двум replicas?
5. **6.5 — Reserve integration.** Загрузить state, вызвать Decider и атомарно сохранить transition с conflict mapping. Проверка: one success/one conflict. Вопрос: где рождается окончательная truth о конкурентном конфликте?
6. **6.6 — Cancel and owner release.** Провести holder/other/owner commands через тот же Decider без раскрытия identity. Проверка: allowed/forbidden/retry matrix. Вопрос: что делает повтор команды идемпотентным?
7. **6.7 — Delete lifecycle.** End active Reservations атомарно с Item/Wishlist deletion и сохранить terminal reason. Проверка: delete transition и последующая история. Вопрос: почему cascade delete может быть недостаточен?
8. **6.8 — Holder-aware projection.** `free/reserved/reservedByMe`. Проверка: owner/holder/other. Вопрос: почему domain event и public projection не должны иметь одну shape?

## 7. Guest Sessions и outbox

1. **7.1 — Guest challenge model.** Digest-only, single-use, expiry, Wishlist scope. Проверка: replay/expiry/scope. Вопрос: чем challenge отличается от Session?
2. **7.2 — Request magic link.** Persist challenge + outbox; Item не блокируется. Проверка: crash-safe commit. Вопрос: где находится crash window без outbox?
3. **7.3 — Worker claim loop.** `SKIP LOCKED`/lease и bounded batch. Проверка: два workers не обрабатывают одну claim одновременно. Вопрос: почему at-least-once всё равно допускает duplicate delivery attempt?
4. **7.4 — Email adapter.** Local capture implementation за Effect service. Проверка: observable captured message без real provider. Вопрос: какая часть является domain command, а какая transport?
5. **7.5 — Consume link.** Атомарно consume challenge, создать Guest Session, попытаться reserve. Проверка: concurrent prior reservation. Вопрос: почему Session можно создать даже при Reservation conflict?
6. **7.6 — Guest cancel.** Scope по Guest Session + Wishlist. Проверка: cross-Wishlist denied. Вопрос: почему verified email не создаёт global Guest identity?
7. **7.7 — Retry/idempotency.** Сделать worker handler устойчивым к crash. Проверка: restart between send/ack. Вопрос: какую duplicate границу невозможно убрать без provider idempotency?
8. **7.8 — Retention.** Purge raw recipient payload/expired credentials. Проверка: cleanup query и audit. Вопрос: какие данные нужно сохранить, а какие удалить?
9. **7.9 — Graceful worker shutdown.** Остановить новые claims, дать текущей job bounded drain и закрыть resources через Effect Scope. Проверка: `SIGTERM` во время job приводит либо к завершённой обработке, либо к recoverable lease после restart. Вопрос: какое состояние делает незавершённую job безопасной для повторного claim?

## 8. External-user security gate

1. **8.1:** CSRF/origin policy и explicit credentialed CORS; проверить malicious origin.
2. **8.2:** Rate limits до password hashing и email; проверить overload path.
3. **8.3:** Session cleanup, revoke-all и safe metrics; проверить concurrent Sessions.
4. **8.4:** Password change/reset и email verification; проверить single-use/revocation policy.
5. **8.5:** User deletion lifecycle и anonymized terminal history; проверить отсутствие usable credentials/PII.
6. **8.6:** TLS/cookie/security headers, backup и restore exercise; проверить live topology.

После каждого шага владелец объясняет threat → control → residual risk → observable proof.

## 9. Service-owned images

1. **9.1:** Ввести S3-compatible local adapter после определения object lifecycle.
2. **9.2:** Ограничить bytes/content type/magic bytes до persistence.
3. **9.3:** Проверить dimensions, metadata и controlled variants.
4. **9.4:** Реализовать immutable keys и безопасную read policy.
5. **9.5:** Реализовать replace/delete/orphan lifecycle job и multi-replica test.

## 10. Asynchronous Import Preview

1. **10.1:** Контракт create job → `202` → polling состояния.
2. **10.2:** Curated HTTPS provider registry и URL normalization.
3. **10.3:** Restricted fetch с DNS/address/redirect revalidation и лимитами.
4. **10.4:** Parse OG/JSON-LD как untrusted suggestions с manual fallback.
5. **10.5:** Apply selected fields с authorization/idempotency/version check.
6. **10.6:** Refresh как новый preview/diff; accepted image проходит image pipeline.

Проверка фазы — детерминированные controlled fixtures для SSRF, redirect, timeout, oversized, non-HTML, challenge и stale-write cases; live marketplace не используется как test dependency.

## 11. Scale lab

1. **11.1:** Запустить 2 API + 2 workers против одной PostgreSQL и повторить Reservation/outbox races.
2. **11.2:** Определить workload из реальных journeys и baseline latency/saturation.
3. **11.3:** Изучить query plans/indexes/pagination до cache.
4. **11.4:** Ввести cache/search только при измеримом gate и сначала записать invalidation ownership.
5. **11.5:** Сравнить PostgreSQL outbox с broker только при measured contention/fan-out/isolation need.

## Необязательные лаборатории после появления gate

Источник, момент применения и ограничения каждой лаборатории зафиксированы в [`platform-materials.md`](./platform-materials.md). Эти шаги не блокируют продуктовый roadmap.

1. **L1 — Property-based invariant.** После стабильного money contract или Reservation transition matrix выбрать одно свойство и проверить generated cases с воспроизводимым seed и shrinking. Не заменять конечную boundary matrix генератором.
2. **L2 — Mutation probe.** После стабилизации чистого `ReservationDecider` запустить mutation testing только для этого module и разобрать meaningful surviving mutants. Не вводить project-wide threshold.
3. **L3 — Effect Request batching.** Только если trace/query counter показывает `1 + N`, сначала сравнить обычный SQL `JOIN/IN`, затем локальный `RequestResolver` prototype. Cache и batching оценивать отдельно.
4. **L4 — PostgreSQL Event Store + CQRS projection.** После завершённого product path в throwaway module проверить append/version conflict, replay и rebuild одной idempotent projection. Production schema не менять; adoption допустим только при реальной потребности в time-travel, audit или нескольких rebuildable read models. Страница BatSchool про Event Store при исследовании возвращала HTTP 500, поэтому детали API перед экспериментом нужно проверить повторно и по установленным типам.

## Конечный критерий проекта

Закончен первый продуктовый путь из `docs/product/implementation-plan.md`: signup → Wishlist → Items → share → User/Guest Reservation → cancel, включая concurrent correctness и durable required email. Владелец может самостоятельно спроектировать изменение, назвать trade-offs, реализовать, протестировать, отладить и объяснить, почему проверка защищает наблюдаемый инвариант.
