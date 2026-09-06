# BatSchool → Wishlist: gated-план экспериментов

## Как читать этот план

Это не второй curriculum и не каталог уроков «когда-нибудь». Порядок продукта остаётся в [curriculum](./curriculum.md), [roadmap](./roadmap.md) и [implementation plan](../docs/product/implementation-plan.md); здесь есть только материалы, которые отвечают уже наблюдаемой или заранее названной проблеме Wishlist.

Текущий checkpoint — Phase 0 / шаг `0.1`: test collection сломан, crypto adapters ещё не закончены; auth не подключён, а Wishlists, Reservations и outbox в коде ещё отсутствуют. Поэтому «прочитать урок» не считается прогрессом. Для каждой темы ниже нужен маленький запуск, наблюдаемый результат и gate, запрещающий преждевременное внедрение.

Все ссылки, кроме одной явно отмеченной, имеют локально извлечённую страницу с HTTP 200. Особый случай: [`/l/25-effect/16-event-store-pg`](https://school.bondiano.com/l/25-effect/16-event-store-pg) при извлечении вернул **HTTP 500**; в записи нет title, headings и text. Из карты курса известно только название «Event Store на `@effect/sql-pg`: append-only, optimistic concurrency». Содержание страницы **нельзя считать изученным** и нельзя пересказывать или использовать как основание реализации, пока страница недоступна.

## Использовать скоро

### 1. Node crypto через явный test seam

- **Source URL:** [Crypto, ошибки, graceful shutdown](https://school.bondiano.com/l/06-node/04-crypto-and-errors); [Рефакторинг под тестируемость: швы, ядро и оболочка](https://school.bondiano.com/l/29-testing/19-refactoring-for-testability).
- **Проблема Wishlist:** `SessionTokenGenerator` получает randomness при сборке Layer, live `SecureRandomBytes` отсутствует, а password hashing ещё не завершён. Уроки подтверждают подходящие Node primitives (`randomBytes`, `scrypt`, `timingSafeEqual`) и необходимость подавать randomness/time как явные зависимости, а не вызывать глобали внутри правила.
- **Фаза / момент:** Phase 0, шаги `0.3–0.7` и `0.11`, сразу после восстановления test collection.
- **Маленький эксперимент:** подать два заранее известных 32-byte значения через один fake `SecureRandomBytes`, дважды выполнить один и тот же service effect и отдельно проверить один `hash → verify` round-trip с неверным паролем.
- **Observable proof:** источник вызван два раза; credentials и digests различаются; credential имеет canonical base64url shape, digest совпадает с known vector; верный пароль даёт `true`, неверный — `false`, malformed stored value не запускает KDF.
- **Gate — не применять раньше:** не вводить random prefetch pool, универсальный crypto facade или новую token abstraction. Нужен только seam, защищающий текущие Session/Password contracts.

### 2. Измерить scrypt, а не угадать concurrency

- **Source URL:** [Performance hooks, профайлинг, телеметрия](https://school.bondiano.com/l/06-node/06-performance-and-telemetry); [Crypto, ошибки, graceful shutdown](https://school.bondiano.com/l/06-node/04-crypto-and-errors).
- **Проблема Wishlist:** async `scrypt` использует ограниченные native resources; число CPU и размер libuv pool сами по себе не задают безопасный memory/admission budget.
- **Фаза / момент:** Phase 0, шаги `0.8–0.10`, после корректного одиночного hash/verify.
- **Маленький эксперимент:** одним локальным harness прогнать фиксированное число hashes при concurrency `1/2/4/8`, записав wall latency, RSS/heap, CPU и event-loop delay; затем повторить overload и interruption case с выбранным пределом.
- **Observable proof:** есть воспроизводимая таблица, видна первая точка резкого роста latency/RSS или event-loop lag; active/waiting/rejected counts не превышают выбранный budget, permit не освобождается до native callback.
- **Gate — не применять раньше:** Semaphore и queue limit появляются только после измерения; OpenTelemetry, Clinic и постоянный profiler для этого не требуются.

### 3. Поведенческая проверка и правильный уровень integration

- **Source URL:** [Что тестировать: поведение, а не реализацию](https://school.bondiano.com/l/29-testing/03-what-to-test); [Интеграционные тесты: сколько настоящего в проверке](https://school.bondiano.com/l/29-testing/17-integration-tests).
- **Проблема Wishlist:** сейчас runner не собирает suites; дальше auth должен доказать PostgreSQL rollback и реальный cookie transport, которые mock repository не доказывает.
- **Фаза / момент:** сначала Phase 0 `0.1–0.2`; затем Phase 1 `1.3` и `1.10`.
- **Маленький эксперимент:** после ремонта collection внедрить failure после второго write signup и выполнить use case с настоящим PostgreSQL; транспорт отдельно пройти одним Node HTTP cookie-jar smoke scenario.
- **Observable proof:** при failure в `users`, `password_credentials` и `sessions` остаётся по ноль новых строк; process-level сценарий наблюдает реальные `Set-Cookie`, authenticated `me` и expiration после logout.
- **Gate — не применять раньше:** не строить browser E2E для серверного факта и не проверять private calls/mocks. Сначала вернуть зелёно-красный feedback loop; новый тест добавляется только если защищает observable invariant.

### 4. Effect debugging на реальном graph/failure

- **Source URL:** [Инструменты и отладка: LSP, диагностики в CI, layerinfo, Cause, файбер-дамп](https://school.bondiano.com/l/25-effect/25-tooling-and-debugging).
- **Проблема Wishlist:** composition `Context.Service`/`Layer`, missing requirements и различие typed failure/defect/interruption ещё не доказаны, а Phase 1 потребует собрать весь auth graph.
- **Фаза / момент:** Phase 1, прежде всего `1.8`; `Cause` — при первом непрозрачном runtime failure, fiber dump — только при реальном зависании.
- **Маленький эксперимент:** в изолированной composition намеренно убрать один auth Layer, получить diagnostic/`layerinfo`, назвать отсутствующее ребро и вернуть Layer; один injected failure посмотреть как полный `Cause`, а не как строку ошибки.
- **Observable proof:** инструмент называет именно отсутствующий service и показывает provides/requires; после восстановления graph приложение стартует, а failure классифицирован как expected error, defect или interruption без потери причины.
- **Gate — не применять раньше:** не включать весь набор CI diagnostics, profiling и fiber snapshots «на будущее»; брать ровно инструмент, отвечающий наблюдаемому симптому.

### 5. PostgreSQL transaction boundary для signup

- **Source URL:** [PostgreSQL Middle · транзакции, JSONB, блокировки](https://school.bondiano.com/l/10-databases/02-postgres-mid-and-acid).
- **Проблема Wishlist:** signup состоит из трёх зависимых writes; autocommit оставит частичное состояние при отказе.
- **Фаза / момент:** Phase 1, шаг `1.3`; тот же принцип позже применяется к Sharing Link transitions и domain state + outbox.
- **Маленький эксперимент:** по очереди инъектировать отказ после каждого signup insert в транзакционном use case.
- **Observable proof:** каждый отказ откатывает все три таблицы, success коммитит согласованный User/Credential/Session; transaction принадлежит use case, а не handler или одному repository method.
- **Gate — не применять раньше:** не повышать isolation level и не добавлять explicit locks без воспроизведённой concurrency anomaly; для этой задачи сначала достаточно короткой transaction.

## Использовать при появлении конкретной проблемы

### 6. Reservation Decider — без Event Sourcing

- **Source URL:** [Моделирование: домен, контракты и конечные автоматы](https://school.bondiano.com/l/02-cs/18-modeling-and-fsm); [Functional Core, Imperative Shell](https://school.bondiano.com/l/09-backend/02-functional-core-imperative-shell); [Decider pattern на Effect.gen](https://school.bondiano.com/l/25-effect/15-decider-effect); [CQRS и Event Sourcing: без фанатизма](https://school.bondiano.com/l/09-backend/15-cqrs-es-and-buses).
- **Проблема Wishlist:** в Phase 6 появятся reserve/cancel/release/delete, active/terminal states, actors и domain errors; conditional logic может расползтись по handler/repository. До этого такой сложности в CRUD нет.
- **Фаза / момент:** Phase 6, шаги `6.1–6.3`, после появления согласованной transition table и до SQL integration.
- **Маленький эксперимент:** реализовать один pure `ReservationDecider`: `decide(state, command) → events | domain error`, `evolve(state, event) → state`; оболочка читает **current state** из PostgreSQL, применяет события в памяти и сохраняет новое current state в обычной транзакции.
- **Observable proof:** разрешённые и запрещённые переходы проходят table-driven matrix; `events.reduce(evolve, state)` равен сохраняемому next state; в schema нет `event_store`, а concurrent invariant по-прежнему доказывает PostgreSQL constraint.
- **Gate — не применять раньше:** не переносить Decider в Users/Wishlists CRUD и не путать events как язык решения с Event Sourcing как способом хранения. Расширять паттерн только после отдельного сравнения с прямыми transitions на второй действительно сложной state machine.

### 7. Locks только там, где constraint/atomic SQL недостаточны

- **Source URL:** [PostgreSQL Middle · транзакции, JSONB, блокировки](https://school.bondiano.com/l/10-databases/02-postgres-mid-and-acid).
- **Проблема Wishlist:** две API replicas могут одновременно резервировать один Item; позже несколько workers должны разбирать очередь без одинаковых claims.
- **Фаза / момент:** Phase 6 `6.4–6.5` для Reservation; Phase 7 `7.3` для worker claiming.
- **Маленький эксперимент:** запустить две независимые transactions на один reserve и, отдельно для очереди, два claimers на одну pending batch.
- **Observable proof:** Reservation даёт ровно один success и один mapped conflict благодаря database invariant; `FOR UPDATE SKIP LOCKED` выдаёт workers непересекающиеся batches; при deadlock/serialization failure есть явный bounded retry contract.
- **Gate — не применять раньше:** сначала unique/partial constraint или один atomic `UPDATE`; `FOR UPDATE` нужен только для настоящего read–decide–write, `SKIP LOCKED` — только для конкурентного claim loop. Не включать Serializable глобально и не использовать process-local lock как источник истины.

### 8. Transactional outbox для обязательного email

- **Source URL:** [Надёжная доставка: outbox, inbox и саги](https://school.bondiano.com/l/09-backend/19-reliable-delivery); [Архитектура бэкенда на Effect: очередь на Postgres, outbox, воркер](https://school.bondiano.com/l/25-effect/26-backend-architecture).
- **Проблема Wishlist:** commit Reservation/Guest state и отправка email не имеют общей transaction; crash между ними либо теряет обязательную работу, либо приводит к повтору.
- **Фаза / момент:** Phase 7, начиная с `7.2`; не в ранних CRUD phases.
- **Маленький эксперимент:** остановить worker (а) после domain commit до send и (б) после send до ack/update, затем запустить снова.
- **Observable proof:** domain transition и outbox intent появляются атомарно; после restart незавершённая работа доставляется; повторная попытка сохраняет тот же logical command/idempotency key и не создаёт второй terminal transition. Наблюдаемая operational метрика — возраст самой старой pending записи.
- **Gate — не применять раньше:** outbox оправдан только required post-commit side effect. Не добавлять broker, saga или generic event bus; PostgreSQL queue остаётся первым транспортом.

### 9. Effect Request batching — только после измеренного N+1

- **Source URL:** [Batching: Request, RequestResolver, dataloader, кеш с TTL](https://school.bondiano.com/l/25-effect/10-batching).
- **Проблема Wishlist:** возможный будущий список Items/Public Profiles может вызвать по lookup на строку; сейчас такого query path и измерения нет.
- **Фаза / момент:** не ранее Phases 4–5; практически — Phase 11, если SQL/query telemetry покажет N+1 на реальном journey.
- **Маленький эксперимент:** на фиксированной странице из 50 Items сравнить baseline query count/latency с простым repository `JOIN/IN`; только если API composability мешает такому запросу, сделать локальный `RequestResolver` prototype.
- **Observable proof:** trace/query counter показывает прежние `1 + N` round trips и bounded batch после изменения; representative p95 улучшается без изменения authorization/visibility результата.
- **Gate — не применять раньше:** нет измеренного `1 + N` — нет `Effect.request`. Сначала обычный SQL. Не включать TTL cache вместе с batching: cache требует отдельного stale-data и invalidation contract, особенно для Private/rotated Unlisted data.

### 10. Money и date/time primitives на границе Items

- **Source URL:** [Стандартная библиотека Effect: равенство, коллекции, порядок, деньги, время](https://school.bondiano.com/l/25-effect/24-effect-stdlib).
- **Проблема Wishlist:** optional Item price нельзя хранить через binary float, а Occasion Date нельзя случайно сдвинуть timezone conversion.
- **Фаза / момент:** Phase 3 при Occasion Date contract и Phase 5 при выборе price representation.
- **Маленький эксперимент:** прогнать HTTP → domain → PostgreSQL → HTTP round-trip для `19.99` и date-only значения в двух process time zones; сравнить minor units с `BigDecimal` только на этой границе.
- **Observable proof:** цена возвращается без `19.989…/20.00` drift, sorting сохраняет точный order, date-only не меняет календарный день.
- **Gate — не применять раньше:** `BigDecimal` не становится обязательным только потому, что есть в stdlib; выбрать его или minor units после сравнения с DB/Schema contract. Не расширять задачу до календарей/recurrence, которых нет в продукте.

### 11. Threat model и policy matrix вместо смены auth-модели

- **Source URL:** [Auth модели и фронтенд: RBAC, ABAC, PBAC и CSRF](https://school.bondiano.com/l/12-security/04-auth-models-and-frontend); [Угрозы и SSDLC](https://school.bondiano.com/l/12-security/06-threat-modeling-and-ssdlc).
- **Проблема Wishlist:** Session отвечает «кто», но не ownership/visibility; cookie-authenticated unsafe methods позже потребуют CSRF/origin control.
- **Фаза / момент:** actor/resource matrix — Phases 2 и 4; полный external-user security gate — Phase 8.
- **Маленький эксперимент:** проверить одну таблицу `owner / other User / anonymous × private / unlisted-current-key / unlisted-old-key / public`; в Phase 8 повторить unsafe request с malicious `Origin` и валидной cookie.
- **Observable proof:** каждый доступ совпадает с одной central policy; old key и malicious origin отклонены; public projections/logs не содержат email, holder identity или credentials.
- **Gate — не применять раньше:** не приносить JWT/refresh flow: проект уже выбрал opaque PostgreSQL Sessions. Полный SSDLC/tooling не опережает работающий product path, но authorization boundary проверяется сразу при появлении ресурса.

### 12. Observability как измерительный прибор, не инфраструктурный milestone

- **Source URL:** [Observability: логи, спаны, метрики, OpenTelemetry](https://school.bondiano.com/l/25-effect/18-observability); [Performance hooks, профайлинг, телеметрия](https://school.bondiano.com/l/06-node/06-performance-and-telemetry).
- **Проблема Wishlist:** batching/cache/broker нельзя обосновать без query count, latency, pool saturation и outbox lag; одновременно credentials/PII нельзя записывать ради диагностики.
- **Фаза / момент:** узкая метрика появляется вместе с Phase 7 worker; полноценный baseline — Phase 11 до любой scale-инфраструктуры.
- **Маленький эксперимент:** для одного journey связать request span с DB query count и, если есть email, outbox age/attempt; прогнать controlled baseline и одну нагрузочную ступень.
- **Observable proof:** по одному trace видно, где ушло время, metric меняется предсказуемо под нагрузкой, а inspection payload не содержит token, sharing key, email или holder identity.
- **Gate — не применять раньше:** сначала сформулировать вопрос и минимальную metric; collector/backend и distributed tracing добавлять только когда локальных spans/counters недостаточно.

### 13. Graceful shutdown после появления долгоживущего процесса

- **Source URL:** [Crypto, ошибки, graceful shutdown](https://school.bondiano.com/l/06-node/04-crypto-and-errors).
- **Проблема Wishlist:** worker с claim/lease и API с in-flight requests могут потерять работу или удерживать DB pool при `SIGTERM`.
- **Фаза / момент:** Phase 7, когда появляется отдельный worker entrypoint; повторить в Phase 11 на multi-instance topology.
- **Маленький эксперимент:** послать `SIGTERM`, пока worker держит одну job, и одновременно попытаться выдать ему новую.
- **Observable proof:** новые claims прекращаются; текущая job либо завершается до deadline, либо остаётся recoverable по lease/reaper после restart; Scope закрывает pool/resources, hard timeout не оставляет процесс висеть.
- **Gate — не применять раньше:** не копировать глобальный Node shutdown boilerplate до появления процесса и списка owned resources; сначала использовать lifecycle/Scope существующего Effect runtime.

## Отдельные optional experiments

### 14. Property-based проверка только настоящего свойства

- **Source URL:** [Верификация: ящик инструментов от свойств до доказательств](https://school.bondiano.com/l/02-cs/19-verification-toolbox); [Property-based и snapshot](https://school.bondiano.com/l/29-testing/15-property-and-snapshot).
- **Проблема Wishlist:** ручные examples плохо покрывают пространство точных money values и последовательностей Reservation commands.
- **Фаза / момент:** после example-based contract в Phase 5 или полной transition table в Phase 6.
- **Маленький эксперимент:** выбрать **одно** свойство: `parse(format(minorUnits)) = minorUnits` либо «любая сгенерированная допустимая command sequence сохраняет single-active/terminal invariants».
- **Observable proof:** fixed seed даёт воспроизводимый run; намеренно внесённая пограничная ошибка находится и shrink превращает её в минимальный понятный counterexample.
- **Gate — не применять раньше:** generator и oracle должны быть проще production rule. Не генерировать CRUD ради количества runs и не заменять исчерпывающую transition matrix snapshots.

### 15. Mutation testing одного стабильного pure module

- **Source URL:** [Mutation testing: честный прибор и приёмка ИИ-тестов](https://school.bondiano.com/l/29-testing/10-mutation-testing).
- **Проблема Wishlist:** зелёная transition matrix может исполнять строки, но не замечать изменённую границу или удалённый branch.
- **Фаза / момент:** после стабилизации `ReservationDecider` в Phase 6, не сейчас при broken collection.
- **Маленький эксперимент:** запустить Stryker только на Decider и разобрать первые выжившие изменения comparison/branch.
- **Observable proof:** каждый meaningful mutant убит observable assertion; surviving mutant приводит либо к одному обоснованному test case, либо к удалению dead code — не к погоне за 100% числом.
- **Gate — не применять раньше:** не делать project-wide mutation job и CI threshold, пока suite не быстра и целевой module не стабилен; это разовый учебный прибор, пока повторная ценность не доказана.

### 16. PostgreSQL Event Store + CQRS projection — лаборатория, не архитектура Wishlist

- **Source URL:** [failed Event Store page — HTTP 500](https://school.bondiano.com/l/25-effect/16-event-store-pg); [CQRS-проекции](https://school.bondiano.com/l/25-effect/17-projections-cqrs); [CQRS и Event Sourcing: без фанатизма](https://school.bondiano.com/l/09-backend/15-cqrs-es-and-buses).
- **Проблема Wishlist:** обязательной продуктовой проблемы нет; это эксперимент для сравнения цены current-state persistence с replay, optimistic append и отдельной read-model.
- **Фаза / момент:** только после завершённого Phase 6 Decider, лучше как изолированный Phase 11 lab после первого product path.
- **Маленький эксперимент:** в throwaway module проиграть короткий Reservation сценарий в append-only stream и построить одну idempotent projection, затем пересобрать state/projection с нуля и столкнуть два append одного version. Детали `@effect/sql-pg` сначала сверить с доступной страницей/официальным API: failed lesson их не подтверждает.
- **Observable proof:** replay воспроизводит тот же Reservation state; rebuild даёт ту же projection; конкурентная запись имеет явный conflict; удаление лаборатории ничего не меняет в production path.
- **Gate — не применять раньше:** не менять production schema и не называть урок изученным, пока `/16-event-store-pg` возвращает 500. Даже успешная лаборатория не открывает adoption без реальной потребности в time-travel/audit/rebuild нескольких read-models и принятой цены event versioning/eventual consistency.

## Сознательно отложить

### Inbox, saga и broker

- **Source URL:** [Надёжная доставка: outbox, inbox и саги](https://school.bondiano.com/l/09-backend/19-reliable-delivery).
- **Проблема / момент:** inbox решает redelivery во входящем consumer, saga — длинный процесс из независимых transactions. В Phase 7 Wishlist сам создаёт PostgreSQL jobs; отдельной входящей broker boundary и multi-service saga ещё нет.
- **Маленький эксперимент при открытии gate:** дважды доставить один внешний `messageId` и атомарно записать processed marker + один domain effect.
- **Observable proof:** две deliveries дают один effect; crash до commit допускает безопасную повторную обработку.
- **Gate — не применять раньше:** inbox только после появления реального at-least-once consumer; saga только после процесса, который действительно пересекает независимые transaction owners; broker — после измеренных contention/fan-out/replay/isolation needs в Phase 11.

### Retry, circuit breaker и bulkhead как пакет «на всякий случай»

- **Source URL:** [Паттерны отказоустойчивости](https://school.bondiano.com/l/09-backend/18-resilience-patterns).
- **Проблема / момент:** до Phase 10 у core path нет обязательного remote marketplace call; без downstream failure data retries могут усилить нагрузку, а breaker/bulkhead добавят состояния без пользы.
- **Маленький эксперимент при открытии gate:** на controlled Import Preview fixture задать timeout, затем transient failure; сравнить один bounded retry с jitter и no-retry для non-idempotent apply.
- **Observable proof:** общий deadline не превышен, retry не создаёт duplicate apply, permanent failure быстро уходит в manual fallback и не влияет на чтение Items.
- **Gate — не применять раньше:** только реальный remote boundary с latency/failure distribution; retry разрешён лишь вместе с idempotency и budget. Circuit breaker/bulkhead — после наблюдаемого sustained failure или resource starvation, не как обязательный middleware.

### Production Event Sourcing/CQRS и TTL cache

- **Source URL:** [CQRS и Event Sourcing: без фанатизма](https://school.bondiano.com/l/09-backend/15-cqrs-es-and-buses); [Batching и кеш с TTL](https://school.bondiano.com/l/25-effect/10-batching).
- **Проблема / момент:** текущий modular monolith обслуживается одной PostgreSQL current-state model; нет time-travel/rebuild requirement и нет измеренного read hotspot.
- **Маленький эксперимент при открытии gate:** использовать optional lab выше для ES/CQRS; для cache — повторить один public read baseline с чёткой invalidation owner и visibility reduction.
- **Observable proof:** новая модель решает измеренную проблему лучше более простого SQL/index/projection; rotated Unlisted/Private data никогда не переживает invalidation window.
- **Gate — не применять раньше:** optional lab не становится migration plan. ES, separate CQRS store и cache остаются вне обязательного backlog до конкретного requirement и before/after evidence.

## Итоговый порядок

1. Сейчас: вернуть test collection, закончить crypto seam и измерить scrypt.
2. Следом: доказать auth transaction, integration boundary и собрать Effect Layer graph.
3. На Reservation: ввести FSM/Decider **без** Event Sourcing, затем доказать database concurrency.
4. На Guest email: ввести PostgreSQL outbox и lifecycle worker, после чего проверить crash/retry/shutdown.
5. После работающего product path: измерять N+1/load/lag; только затем пробовать batching, cache, broker или отдельные stores.
6. Event Store/CQRS projection и mutation/property testing остаются локальными учебными экспериментами, пока observable product problem не оправдает постоянную сложность.
