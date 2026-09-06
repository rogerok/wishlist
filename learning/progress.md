# Learning progress

## Текущий checkpoint

- **Текущая фаза:** Curriculum Phase 0 — надёжный feedback loop и auth security primitives.
- **Текущий шаг:** `roadmap.md` → `0.1` — восстановить Vitest collection после перемещения custom matchers.
- **Следующая backend-цель:** завершить `SessionTokenGenerator`, затем `PasswordHasher` с bounded admission.
- **Ближайшая продуктовая цель:** закончить PostgreSQL Session authentication (`signup`, `login`, `me`, `logout`) и подключить её к live `AppApi`.

## Наблюдаемое состояние проекта

- Modular monolith в pnpm/Turborepo workspace.
- Live API сейчас подключает Health и публичный Users CRUD.
- Users уже проходят цепочку HttpApi/Schema → handlers → `UsersService` → `UsersRepository` → Effect-compatible Kysely/PostgreSQL.
- Auth HttpApi contracts, request schemas, Problem Details errors и isolated contract tests существуют, но auth group/handlers/services не подключены к live application.
- Migration `0002_auth.ts` и generated DB types уже содержат `password_credentials` и `sessions`.
- Canonical password-hash parser/serializer и тесты существуют.
- `SessionTokenGenerator` — незавершённая работа: `SecureRandomBytes` объявлен, live implementation отсутствует, `generate` содержит unsafe placeholder, random bytes сейчас запрашиваются при построении Layer.
- Wishlists, Items, Sharing Links, Reservations, Guest Sessions, outbox, images и Import Preview в коде отсутствуют.
- `docs/auth/implementation-plan.md` частично устарел: его раздел Current state утверждает, что auth tables отсутствуют. Текущий код и `docs/product/implementation-plan.md` подтверждают обратное.

## Наблюдаемые проверки на момент инициализации

- `pnpm --filter @wishlist/api check-types` — проходит.
- `pnpm --filter @wishlist/api test` — не собирает 8 suite: Vitest пытается импортировать `src/infra/lib/matchers.ts`, а фактический новый файл находится в `src/infra/lib/matchers/matchers.ts`.
- Это текущий blocker feedback loop, а не доказательство падения behavior tests: тестовые тела не запускались.
- В worktree уже есть пользовательские незавершённые изменения matcher setup; learning initialization их не меняет.

## Стек и обнаруженные версии

- Node.js: project engine `>=25`; strict ESM.
- pnpm `9.0.0`, Turborepo `2.10.9`.
- TypeScript `7.0.2+effect-tsgo.0.36.4`; `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, NodeNext.
- Effect, `@effect/platform-node`, `@effect/sql-pg`, `@effect/vitest`: `4.0.0-rc.108`.
- Kysely `0.29.5`, `pg` `8.23.0`, local `@repo/sql-kysely` adapter.
- PostgreSQL `16.3` в Docker Compose; Testcontainers PostgreSQL `12.1.0`.
- Vitest `4.1.10`, FastCheck через `effect/testing`, ESLint `9.39.1`, Prettier `3.7.4`.
- `ts-pattern` `5.9.0`, `kysely-codegen` `0.20.0`, `tsx` `4.23.11`.

## Предварительная mastery map

Шкала: 0 — не встречал; 1 — узнаю; 2 — могу объяснить с помощью; 3 — могу реализовать с помощью; 4 — самостоятельно; 5 — объясняю, реализую, отлаживаю и сравниваю альтернативы.

Наличие кода не доказывает mastery. Оценки `2–3` ниже — рабочие гипотезы по коду и git history; их нужно подтвердить самостоятельным объяснением и новой задачей.

| Концепция                                             |  Оценка | Основание                                         | Статус проверки                                            |
| ----------------------------------------------------- | ------: | ------------------------------------------------- | ---------------------------------------------------------- |
| strict TypeScript и ESM imports                       |       3 | строгие config, branded types, NodeNext imports   | Практика видна; самостоятельность не проверена             |
| pnpm workspace/Turborepo                              |       2 | scripts и внутренние packages используются        | Trade-offs не проверены                                    |
| Effect `Effect.gen`, combinators, typed error channel |       3 | services/repositories/handlers и tests            | Failure/defect/interruption model не проверен целиком      |
| `Context.Service` и `Layer` composition               |       2 | Users/Health/DB Layers собраны                    | Lifetime и requirement reasoning требует проверки          |
| Effect Schema boundary validation                     |       3 | transforms, brands, excess-property policy, tests | Encode/decode boundary требует проверки                    |
| HttpApi contracts и Problem Details                   |       3 | Users/Auth contracts и middleware                 | Live auth wiring ещё отсутствует                           |
| PostgreSQL DDL, FK, indexes, constraints              |       3 | две migrations и invariant tests                  | Concurrency design ещё не проверен                         |
| Kysely queries и repository error mapping             |       3 | полный Users CRUD                                 | Transaction ownership и authorization scoping не проверены |
| Vitest и example-based tests                          |       2 | несколько suites существуют                       | Текущий setup broken; test design объяснение не проверено  |
| Property-based testing                                |       2 | один FastCheck invariant для passwordConfirm      | Generator/shrinking trade-offs не проверены                |
| Session auth domain model                             |       2 | contracts, migration, docs                        | Use cases и live behavior не реализованы                   |
| Password hash format parsing                          |       3 | substantial parser/serializer + tests             | Full hasher и native boundary отсутствуют                  |
| Secure randomness и Session token digest              |       1 | начальная shape, implementation placeholder       | Текущая ближайшая практика                                 |
| Async native callback/interruption semantics          |       1 | проблема описана в docs                           | Реализации/эксперимента нет                                |
| Bounded concurrency/admission                         |       1 | решение ещё открыто в NOTES                       | Benchmark и код отсутствуют                                |
| Authentication vs authorization                       |       1 | auth ещё не защищает Users CRUD                   | Нужен вертикальный сценарий                                |
| Aggregate/ownership modeling                          |       1 | отражено в product docs                           | Wishlist кода нет                                          |
| Reservation concurrency/idempotency                   |       1 | ADR и plan                                        | Практики нет                                               |
| Guest Session/transactional outbox                    |       1 | ADR и plan                                        | Практики нет                                               |
| Object storage/SSRF/async import                      |       0 | только future plans                               | Не изучать до соответствующей проблемы                     |
| Multi-instance observability/scaling                  | unknown | код не даёт данных                                | Только после законченного product path                     |

## Концепции, которые ещё нельзя считать проверенными

- Разница между созданием Effect и выполнением Effect, особенно внутри Layer constructor.
- Полный failure model: typed failure, defect, interruption, retry.
- Resource safety вокруг native async work.
- Выбор memory/concurrency budget по измерениям.
- Transaction ownership для multi-write use case.
- Реальный cookie transport и middleware-provided principal.
- Authorization, projection privacy и side-channel semantics.
- PostgreSQL как владелец concurrent domain invariant.
- Idempotency и at-least-once delivery.
- Operational debugging: saturation, query plans, worker lag, backup/restore.

## Запланированный архитектурный эксперимент

Пользователь хочет попробовать Command–Decider–Event. Безопасная точка — Reservation lifecycle в Phase 6: там уже появятся реальные commands, terminal/active states, domain errors и события. План не включает переписывание всего проекта и не требует Event Sourcing. Сначала создаётся один чистый `ReservationDecider`, затем он сравнивается с прямыми transitions; PostgreSQL constraint остаётся владельцем конкурентного single-active invariant.

## Материалы платформы ментора

Авторизованная BatSchool изучена как источник будущих experiments. Релевантные материалы и прямые ссылки сопоставлены с фазами в [`platform-materials.md`](./platform-materials.md). Доступно 26 изученных lesson pages; страница Effect Event Store вернула HTTP 500, поэтому её содержание не считается изученным.

В обязательный маршрут добавлен только graceful shutdown будущего worker. Property-based test, mutation testing, Effect Request batching и PostgreSQL Event Store/CQRS оставлены gated laboratories: они открываются после соответствующего observable problem и не повышают mastery только по факту прочтения урока.

## Ближайшая учебная цель

Сначала вернуть красно-зелёный feedback loop: тест должен хотя бы собраться и упасть/пройти по поведению. Затем на `SessionTokenGenerator` проверить фундаментальную Effect-модель: случайное значение должно создаваться при каждом выполнении service effect, а не один раз при сборке Layer. Это маленькая граница, но от неё зависит безопасность всех Sessions.

## Допущения и открытые вопросы

### Допущения для начального маршрута

- Целевой продукт и порядок больших milestones берутся из `docs/product/implementation-plan.md`.
- Backend остаётся главным учебным контуром; frontend не определяет порядок curriculum.
- Пользовательские незавершённые изменения matcher setup намеренные и должны быть продолжены, а не перезаписаны агентом.
- Темп и доступное учебное время неизвестны, поэтому roadmap ограничивает размер технического шага, а не календарную длительность.
- Код показывает exposure и guided implementation, но не доказывает самостоятельный уровень 4–5.

### Вопросы, которые не блокируют старт

- Какой объём времени обычно доступен на одну учебную сессию?
- Какие части существующего Users/Auth кода были реализованы полностью самостоятельно, а где была существенная помощь?
- Есть ли практический опыт деплоя, production logs и PostgreSQL operations?

Ответы изменят темп и глубину объяснений, но не первый шаг: сначала нужен рабочий test feedback loop.
