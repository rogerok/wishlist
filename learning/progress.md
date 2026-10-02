# Learning progress

## Текущий checkpoint

- **Текущий приоритет (2026-10-02):** завершить проверку R.5 —
  [рефакторинг ошибок и логирования](../docs/product/error-handling-refactoring-plan.md).
  Производственные изменения выполнены: безопасные проекции users/auth, SQL-классификация и общий технический handler users.
  Auth handler покрыт девятью сценариями; check-types и целевой lint прошли.
  Полный Vitest suite, общий lint и Node/PostgreSQL smoke ещё не подтверждены.
- **Последний учебный checkpoint (2026-09-29):** `1.1` реализован, пять интеграционных сценариев credentials repository
  прошли в той сессии. Это исторический результат, не свежая проверка.
- **Следующий функциональный шаг:** `roadmap.md` → `R.5` — итоговые проверки и Node/PostgreSQL signup smoke.
  Ошибки, успешный signup, production-cookie и отказ на лишнее поле проверены с подставленным AuthService.
  В текущей сессии наставничество явно отключено владельцем; в новой включается по умолчанию.
- **Статус шагов 0.1–0.7:** реализация есть, feedback loop работает. Вопросы «Проверка понимания» из roadmap устно не
  пройдены, кроме частичного ответа к `0.4` (sync throw scrypt — ошибка в коде). Остаток `0.3` — нет детерминированного
  теста, доказывающего два обращения по 32 bytes; готовность hasher этот пробел не закрывает.
- **Phase 0 не объявлена полностью закрытой:** остаются этот token test и учебные проверки; production memory budget
  не определён. Локальные лимиты hasher не являются production approval.
- **`0.4` закрыт с отклонением от roadmap (решение владельца, 2026-09-26):** предусловие `total` (safe integer в
  `[min, max]`) → `Effect.die`, отказ `randomBytes` после предусловия → `SecurePrimitiveUnavailableError`; тест на 6
  неверных длин проверяет `Die`. Проверку длины результата не делаем: Node гарантирует длину, дробный `total` закрыт
  предусловием. Первоначально injected failure test был отложен. На 2026-09-28 он добавлен на уровне потребителя
  `PasswordHasher`: подмена Node `randomBytes` доказывает typed failure, отсутствие вызова scrypt и восстановление
  после отказа без введения production-фабрики. HTTP mapping 503 и безопасная диагностика signup реализованы;
  постоянные проверки настоящего auth handler проходят.
- **Следующая backend-цель:** проверить успешную регистрацию через Node server с отдельной тестовой БД.
- **Ближайшая продуктовая цель после блока R:** закончить PostgreSQL Session authentication (`signup`, `login`, `me`, `logout`).
  SessionsRepository, signup и live wiring уже есть; перед продолжением сверить оставшиеся критерии, не реализовывать их заново.

## Наблюдаемое состояние проекта

- Modular monolith в pnpm/Turborepo workspace.
- При ревью 2026-10-01 live API подключает Health, публичный Users CRUD и auth signup.
- Users уже проходят цепочку HttpApi/Schema → handlers → `UsersService` → `UsersRepository` → Effect-compatible
  Kysely/PostgreSQL.
- Credentials/Session repositories, signup transaction, handler, cookie issuance и auth live wiring уже есть.
  Login/me/logout routes пока закомментированы. Устаревший `auth.api.test.ts` удалён;
  полезный сценарий валидации перенесён в тест настоящего обработчика.
- Migration `0002_auth.ts` и generated DB types уже содержат `password_credentials` и `sessions`.
- Canonical password-hash parser/serializer и тесты существуют.
- `SessionTokenGenerator` реализован: `SecureRandomBytesLive`, lazy `generate` (bytes на каждый вызов), SHA-256 digest
  от raw bytes, `Redacted` credential; тесты known-vector и freshness.
- `PasswordHasherLive` реализует `hash`/`verify`, захватывает `SecureRandomBytes` при сборке Layer и сам предоставляет
  `SecureRandomBytesLive`. Native scrypt обёрнут в `Effect.callback` + `Effect.uninterruptible`; work permit
  удерживается до callback. Лимиты одного экземпляра: 2 work permits и 4 admission permits (2 active + 2 waiting),
  сверх capacity — immediate overload. Sync throw scrypt остаётся defect, callback failure —
  `SecurePrimitiveUnavailableError`.
- Тесты token generator и hasher находятся рядом с реализациями в `modules/auth/service/session/` и `password/`.
- `PasswordCredentialsRepository` реализован; `PasswordCredentialsSchema` проверяет даты и формат хеша через
  существующий парсер. Общая подготовка PostgreSQL и миграций вынесена в `infra/db/test-database.layer.ts`.
- Wishlists, Items, Sharing Links, Reservations, Guest Sessions, outbox, images и Import Preview в коде отсутствуют.

## Итоги сессии 2026-09-29

Владелец самостоятельно вносил правки при пошаговом сопровождении: credentials repository, схема записи,
общий слой Testcontainers и пять интеграционных тестов. До сессии сообщил, что не писал тесты с Testcontainers.
Практика с подсказками наблюдалась; самостоятельное объяснение и перенос на новую задачу ещё не проверялись,
поэтому оценки mastery не повышены.

Проверенные сценарии `PasswordCredentialsRepository`:

1. Сохранение и чтение возвращают исходные `userId` и хеш.
2. Пользователь без credentials даёт `Option.none`.
3. Повторное создание даёт `PasswordCredentialsAlreadyExists` и сохраняет первый хеш.
4. Прямая SQL-вставка повреждённого хеша приводит при чтении к `PasswordCredentialsInvalidRecord`.
5. Вставка для несуществующего пользователя даёт `PasswordCredentialsRepositoryError`.

Обычные `UsersRepository.getAll/getById` по коду выбирают только публичные поля `users`, без хеша.
Отдельный новый интеграционный тест публичного профиля в этой сессии не запускался.

Наблюдаемые проверки:

- `pnpm --filter @wishlist/api test src/modules/auth/repository/password-credentials.repository.test.ts` —
  последний запуск после всех правок: 5 passed.
- `pnpm --filter @wishlist/api test src/modules/auth/repository/password-credentials.repository.test.ts src/infra/db/migrations/migrations.test.ts` —
  2 файла / 9 passed; после него менялись только имя теста, импорт и UUID отсутствующего пользователя.
- `pnpm --filter @wishlist/api check-types` — pass до последних правок имени теста, импорта и UUID.
- `pnpm --filter @wishlist/api exec eslint src/modules/auth/repository/password-credentials.repository.test.ts` —
  без замечаний после удаления `Result`; после этого изменился только UUID последнего теста.
- Одноразовый запуск Schema на искусственных данных: корректный хеш сохраняется при decode/encode,
  повреждённый отвергается в обоих направлениях, `Invalid Date` отвергается.
- Полный API suite, build и db:check в этой сессии не запускались; результаты 2026-09-28 ниже исторические.

Разобранные границы:

- Прямой SQL подготавливает пользователя или повреждённую запись; проверяемое действие идёт через repository.
  Для корректного хеша достаточно сериализатора: криптографическое вычисление не является предметом этих тестов.
- `acquireRelease` регистрирует удаление пользователя в scope теста; credentials удаляются каскадно.
  `Effect.orDie` оставляет сбой очистки видимым. Установленный `it.effect` сам предоставляет scope.
- Причина `Missing key ["userId"]`: тестовый PgClient возвращал snake_case, в отличие от рабочего клиента.
  Исправлено добавлением одинаковых преобразований имён; Kysely-адаптер обходит обработку результата плагином.
- Проверяющая схема сохраняет строку `StoredPasswordHash`; `Effect.match` адаптирует результат существующего
  парсера к `SchemaGetter.checkEffect`. Исходная branded schema для сериализатора оставлена без преобразования.
- На Effect `4.0.0-rc.108` SchemaError не сохраняет вход по умолчанию; при `reportInput: true` сохраняет.
  Обе ветви проверены на искусственных данных. Предыдущее предупреждение агента о текущей утечке исправлено.
- FastCheck обсуждался, но для конечного набора исходов не добавлен. Генеративный тест оправдан полезным
  инвариантом и требует изоляции каждого примера, включая shrinking.

## Наблюдаемые проверки (2026-09-28)

- `pnpm --filter @wishlist/api test` — 10 файлов, 74 теста прошли.
- `pnpm --filter @wishlist/api check-types` — pass.
- Целевой ESLint для `src/modules/auth/service/test/password-hasher.concurrency.test.ts` — без замечаний.
- Hasher покрывают 10 concurrency tests и 3 behavior tests с реальным scrypt.
- Во временных копиях тесты поймали три мутации: execution capacity `2→3`, admission capacity `4→5` и удаление
  `uninterruptible`. Временные каталоги удалены.
- Проблема Vitest setup устранена; возвращаться к исправлению пути matcher не требуется.

## Исторические измерения scrypt (`0.8`, 2026-09-26)

Это сохранённые измерения предыдущей сессии, не результаты 2026-09-28. Единая актуальная таблица и условия измерений:
[benchmark record](../docs/auth/implementation-plan.md#benchmark-record).

Dev-машина 12 ядер, Node 25.2.1, N=131072 r=8 p=1. Одноразовый скрипт вне репозитория; один процесс на уровень K;
`maxRSS` из `process.resourceUsage()`.

| K   | UV_THREADPOOL_SIZE | Завершения, мс   | Peak RSS |
| --- | ------------------ | ---------------- | -------- |
| 1   | 4                  | 271              | 210 MB   |
| 4   | 4                  | 296–328          | 581 MB   |
| 8   | 4                  | 319–339, 654–669 | 581 MB   |
| 8   | 8                  | 315–481          | 1093 MB  |
| 12  | 12                 | 405–625          | 1588 MB  |

Выводы той сессии: RSS ≈ base (~68 MB) + active × 128 MB. Ожидание в очереди libuv не аллоцирует рабочие ~128 MiB
scrypt на каждую ожидающую операцию, но состояние очереди занимает память. Выше 4 параллельных хэшей latency растёт;
это было интерпретировано как влияние memory bandwidth (≈12 → 17 → 19 hash/s при 4/8/12). Предсказание владельца (две
волны, ~512 MB) подтвердилось.

Вопрос понимания `0.8` («почему UV_THREADPOOL_SIZE не лимит») владелец не смог ответить; агент объяснил: unbounded
очередь libuv без отказа/отмены + общий пул (fs, dns.lookup, zlib, crypto). Самостоятельное объяснение не подтверждено —
вернуться к нему при учебном разборе уже реализованного `0.10`; повторная реализация не требуется.

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

Шкала: 0 — не встречал; 1 — узнаю; 2 — могу объяснить с помощью; 3 — могу реализовать с помощью; 4 — самостоятельно; 5 —
объясняю, реализую, отлаживаю и сравниваю альтернативы.

Наличие кода не доказывает mastery. Оценки `2–3` ниже — рабочие гипотезы по коду и git history; их нужно подтвердить
самостоятельным объяснением и новой задачей.

| Концепция                                             |  Оценка | Основание                                          | Статус проверки                                                      |
| ----------------------------------------------------- | ------: | -------------------------------------------------- | -------------------------------------------------------------------- |
| strict TypeScript и ESM imports                       |       3 | строгие config, branded types, NodeNext imports    | Практика видна; самостоятельность не проверена                       |
| pnpm workspace/Turborepo                              |       2 | scripts и внутренние packages используются         | Trade-offs не проверены                                              |
| Effect `Effect.gen`, combinators, typed error channel |       3 | services/repositories/handlers и tests             | Failure/defect/interruption model не проверен целиком                |
| `Context.Service` и `Layer` composition               |       2 | Users/Health/DB Layers собраны                     | Lifetime и requirement reasoning требует проверки                    |
| Effect Schema boundary validation                     |       3 | transforms, brands, excess-property policy, tests  | Encode/decode boundary требует проверки                              |
| HttpApi contracts и Problem Details                   |       3 | Users/Auth contracts и middleware                  | Live auth wiring ещё отсутствует                                     |
| PostgreSQL DDL, FK, indexes, constraints              |       3 | две migrations и invariant tests                   | Concurrency design ещё не проверен                                   |
| Kysely queries и repository error mapping             |       3 | полный Users CRUD                                  | Transaction ownership и authorization scoping не проверены           |
| Vitest и example-based tests                          |       2 | 10 файлов / 74 теста проходят                      | Setup исправлен; самостоятельное объяснение test design не проверено |
| Property-based testing                                |       2 | один FastCheck invariant для passwordConfirm       | Generator/shrinking trade-offs не проверены                          |
| Session auth domain model                             |       2 | contracts, migration, docs                         | Use cases и live behavior не реализованы                             |
| Password hash format parsing                          |       3 | parser/serializer и полный hasher с tests          | Самостоятельное объяснение native boundary не подтверждено           |
| Secure randomness и Session token digest              |       1 | generator реализован, known-vector/freshness tests | Остаток `0.3`: deterministic test двух обращений по 32 bytes         |
| Async native callback/interruption semantics          |       1 | реализация, concurrency tests и mutation probe     | Самостоятельное понимание не проверено                               |
| Bounded concurrency/admission                         |       1 | локальные измерения, реализация и capacity tests   | Production budget и самостоятельное обоснование открыты              |
| Authentication vs authorization                       |       1 | auth ещё не защищает Users CRUD                    | Нужен вертикальный сценарий                                          |
| Aggregate/ownership modeling                          |       1 | отражено в product docs                            | Wishlist кода нет                                                    |
| Reservation concurrency/idempotency                   |       1 | ADR и plan                                         | Практики нет                                                         |
| Guest Session/transactional outbox                    |       1 | ADR и plan                                         | Практики нет                                                         |
| Object storage/SSRF/async import                      |       0 | только future plans                                | Не изучать до соответствующей проблемы                               |
| Multi-instance observability/scaling                  | unknown | код не даёт данных                                 | Только после законченного product path                               |

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

Пользователь хочет попробовать Command–Decider–Event. Безопасная точка — Reservation lifecycle в Phase 6: там уже
появятся реальные commands, terminal/active states, domain errors и события. План не включает переписывание всего
проекта и не требует Event Sourcing. Сначала создаётся один чистый `ReservationDecider`, затем он сравнивается с прямыми
transitions; PostgreSQL constraint остаётся владельцем конкурентного single-active invariant.

## Материалы платформы ментора

Авторизованная изучена как источник будущих experiments. Релевантные материалы и прямые ссылки сопоставлены с фазами в [
`platform-materials.md`](./platform-materials.md). Доступно 26 изученных lesson pages; страница Effect Event Store
вернула HTTP 500, поэтому её содержание не считается изученным.

В обязательный маршрут добавлен только graceful shutdown будущего worker. Property-based test, mutation testing, Effect
Request batching и PostgreSQL Event Store/CQRS оставлены gated laboratories: они открываются после соответствующего
observable problem и не повышают mastery только по факту прочтения урока.

## Ближайшая учебная цель

Отделить функциональную готовность от самостоятельного понимания: объяснить удержание permit до native callback,
разницу между execution/admission capacity и ограничениями общего пула libuv. Реализация AI и зелёные тесты не повышают
mastery. Учебный остаток `0.3` — детерминированно доказать два вызова `randomBytes.get(32)` при двух выполнениях
generator; known-vector и freshness tests уже есть. Следующий функциональный шаг — `R.5`,
итоговые проверки и Node/PostgreSQL smoke. Открытые учебные проверки Phase 0 сохраняются;
освоение Layer и ошибок отдельно не оценивалось.

## Допущения и открытые вопросы

### Допущения для начального маршрута

- Целевой продукт и порядок больших milestones берутся из `docs/product/implementation-plan.md`.
- Backend остаётся главным учебным контуром; frontend не определяет порядок curriculum.
- Feedback loop восстановлен; дальнейшие изменения опираются на рабочие API tests, а не повторяют ремонт setup.
- Темп и доступное учебное время неизвестны, поэтому roadmap ограничивает размер технического шага, а не календарную
  длительность.
- Код показывает exposure и guided implementation, но не доказывает самостоятельный уровень 4–5.

### Вопросы, которые не блокируют старт

- Какой объём времени обычно доступен на одну учебную сессию?
- Какие части существующего Users/Auth кода были реализованы полностью самостоятельно, а где была существенная помощь?
- Есть ли практический опыт деплоя, production logs и PostgreSQL operations?

Ответы изменят темп и глубину объяснений; следующий функциональный шаг остаётся `1.2`, а открытые учебные проверки
учитываются отдельно от готового кода.
