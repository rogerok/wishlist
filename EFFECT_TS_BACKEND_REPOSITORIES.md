# Репозитории backend-проектов на Effect

Актуальность обзора: 14 августа 2026 года.

## Короткий вывод

Публичных **enterprise-grade** репозиториев — систем, рассчитанных на длительную эксплуатацию, командную разработку, наблюдаемость и контролируемые отказы — на Effect пока мало. Большинство найденного относится к одной из категорий:

1. учебные примеры;
2. реальные, но молодые продукты;
3. крупные архитектурные лаборатории без подтверждённой эксплуатации;
4. production-код компаний, у которых сам backend закрыт.

Самые полезные источники сейчас: **Hazel**, **T3 Code**, официальный `http-server` и отдельные модули `beep-effect`. Но ни один репозиторий не стоит копировать целиком как «единственно правильную архитектуру».

## Лучшие найденные репозитории

### 1. HazelChat/hazel — наиболее похож на настоящий крупный backend

Репозиторий: [HazelChat/hazel](https://github.com/HazelChat/hazel)

Полноценная чат-платформа:

- отдельный [Effect backend](https://github.com/HazelChat/hazel/tree/main/apps/backend);
- PostgreSQL и Drizzle;
- Effect RPC;
- отдельный cluster/workflow service;
- десятки репозиториев;
- authentication, rate limiting, webhooks, outbox и integrations;
- unit- и integration-тесты;
- фоновые воркеры и распределённые workflow.

Что читать:

- [граница PostgreSQL и Effect](https://github.com/HazelChat/hazel/blob/main/packages/db/src/services/database.ts);
- [доменные и инфраструктурные ошибки](https://github.com/HazelChat/hazel/blob/main/packages/domain/src/errors.ts);
- [MessageRepo](https://github.com/HazelChat/hazel/blob/main/packages/backend-core/src/repositories/message-repo.ts);
- [RPC handlers](https://github.com/HazelChat/hazel/tree/main/apps/backend/src/rpc/handlers);
- [backend services](https://github.com/HazelChat/hazel/tree/main/apps/backend/src/services).

Хорошие решения:

- SQLSTATE `23505` и `23503` превращаются в типизированный `DatabaseError`;
- неожиданный database exception становится defect, а не маскируется под ожидаемую ошибку;
- используется scoped resource для connection pool;
- транзакционный контекст передаётся как Effect dependency;
- репозитории не создают собственные подключения;
- есть тесты для сложных фоновых сервисов.

Недостатки:

- используется **Effect 4 beta**, API заметно отличается от Effect 3;
- местами встречаются assertions и слишком общие `InternalServerError`;
- доменные ошибки содержат HTTP-аннотации;
- `InternalServerError` содержит `cause`, поэтому нужно проверять, не сериализуются ли внутренние детали клиенту;
- кодовая база всё ещё молодая.

**Вердикт:** лучший найденный репозиторий для изучения масштаба, транзакций, RPC, воркеров и композиции Layers. Обработку ошибок следует изучать критически, а не копировать вслепую.

### 2. pingdotgg/t3code — лучший для operational-кода

Репозиторий: [pingdotgg/t3code](https://github.com/pingdotgg/t3code)

Это реальный сервер, управляющий локальными AI-агентами. Не типичный CRUD/backend, но очень полезен для понимания эксплуатации:

- большое количество сервисов;
- authentication и authorization;
- persistence;
- background processes;
- трассировка и метрики;
- integration tests;
- управление subprocess и filesystem;
- типизированные ошибки на границах.

Особенно полезные файлы:

- [persistence errors](https://github.com/pingdotgg/t3code/blob/main/apps/server/src/persistence/Errors.ts);
- [orchestration errors](https://github.com/pingdotgg/t3code/blob/main/apps/server/src/orchestration/Errors.ts);
- [CheckpointStore service](https://github.com/pingdotgg/t3code/blob/main/apps/server/src/checkpointing/CheckpointStore.ts);
- [HTTP boundary](https://github.com/pingdotgg/t3code/blob/main/apps/server/src/http.ts);
- [observability](https://github.com/pingdotgg/t3code/tree/main/apps/server/src/observability);
- [server integration tests](https://github.com/pingdotgg/t3code/tree/main/apps/server/integration).

Что сделано хорошо:

- ошибки содержат operation/correlation context;
- parse, decode, invariant, persistence и callback failures разделены;
- публичные union-типы ошибок перечисляются явно;
- `Effect.fn` создаёт именованные spans;
- сервисные интерфейсы фиксируют точный error channel;
- HTTP-граница использует `catchTags`, а не общий `catchAll`;
- много тестов отказов, а не только happy path.

Ограничения:

- Effect 4 beta;
- это local/server orchestration, а не REST и PostgreSQL;
- README прямо предупреждает, что проект ещё ранний.

**Вердикт:** наиболее полезный пример обработки реальных инфраструктурных отказов, observability — наблюдаемости системы — и сервисных контрактов.

### 3. Effect-TS/examples/http-server — основная база для wishlist

Репозиторий: [Effect-TS/examples/http-server](https://github.com/Effect-TS/examples/tree/main/examples/http-server)

Это официальный пример на **Effect 3**, поэтому он лучше всего совпадает с текущим стеком wishlist:

- `HttpApi`;
- `HttpApiBuilder`;
- Schema-контракты;
- auth/authz middleware;
- `@effect/sql`;
- Layer composition;
- OpenAPI;
- OpenTelemetry;
- тестовые Layers.

Начать с:

- [Accounts API contract](https://github.com/Effect-TS/examples/blob/main/examples/http-server/src/Accounts/Api.ts);
- [Accounts HTTP handlers](https://github.com/Effect-TS/examples/blob/main/examples/http-server/src/Accounts/Http.ts);
- [UsersRepo](https://github.com/Effect-TS/examples/blob/main/examples/http-server/src/Accounts/UsersRepo.ts);
- [UserNotFound](https://github.com/Effect-TS/examples/blob/main/examples/http-server/src/Domain/User.ts);
- [OpenTelemetry layer](https://github.com/Effect-TS/examples/blob/main/examples/http-server/src/Tracing.ts);
- [Accounts tests](https://github.com/Effect-TS/examples/blob/main/examples/http-server/test/Accounts.test.ts).

Сильные стороны:

- один Schema используется для runtime validation, документации и клиента;
- handler не может вернуть ошибку, которой нет в контракте endpoint;
- понятная композиция API, policies и repositories;
- есть tracing и test Layers;
- соответствует Effect 3.17.

Но это **не enterprise backend**:

- SQL-ошибки в `UsersRepo` превращаются в defects через `Effect.orDie`;
- некоторые domain-модели знают HTTP status;
- мало сценариев отказа;
- SQLite вместо PostgreSQL;
- нет полноценной политики внутренних и публичных ошибок.

**Вердикт:** использовать как каноническую основу для `HttpApi`, Schema и Layer composition, но дополнить собственным error translation между persistence, use case и HTTP.

### 4. beep-effect/beep-effect — сильнейший пример разделения ошибок по слоям

Репозиторий: [beep-effect/beep-effect](https://github.com/beep-effect/beep-effect)

Очень крупный Effect-first монорепозиторий. Для обработки ошибок полезен конкретный вертикальный срез `architecture-lab`.

Читать по порядку:

1. [публичные WorkItem errors](https://github.com/beep-effect/beep-effect/blob/main/packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.errors.ts);
2. [repository contract](https://github.com/beep-effect/beep-effect/blob/main/packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.repository.ts);
3. [translation repository/domain → application errors](https://github.com/beep-effect/beep-effect/blob/main/packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.service.ts);
4. [translation application errors → HTTP](https://github.com/beep-effect/beep-effect/blob/main/packages/architecture-lab/server/src/aggregates/WorkItem/WorkItem.http.ts);
5. [PostgreSQL/PGlite integration tests](https://github.com/beep-effect/beep-effect/tree/main/packages/architecture-lab/server/test).

Там реализована следующая цепочка:

```text
PostgreSQL/Repository error
        ↓ exhaustive mapping
Application error
        ↓ exhaustive mapping
HTTP status + public response
```

Примеры преобразований:

- `WorkItemRepositoryNotFound` → `WorkItemNotFound` → `404`;
- `WorkItemRepositoryConflict` → `WorkItemConflict` → `409`;
- internal repository failure → redacted `WorkItemActionFailed` → `503`;
- domain transition error → `WorkItemActionRejected` → `422`.

Это безопаснее, чем добавлять `toHttp()` непосредственно в domain error.

Ограничения:

- Effect 4 beta;
- `architecture-lab` является архитектурной лабораторией, а не подтверждённым production backend;
- репозиторий чрезвычайно большой и местами переусложнён;
- очень много документации вокруг простых конструкций.

**Вердикт:** лучший найденный материал именно по error translation, но не шаблон структуры всего проекта.

### 5. mikearnaldi/accountability — большой Effect 3 и PostgreSQL пример

Репозиторий: [mikearnaldi/accountability](https://github.com/mikearnaldi/accountability)

Технически близок к стеку wishlist:

- Effect 3.19;
- `@effect/sql-pg`;
- `HttpApi`;
- отдельные `core`, `persistence` и `api`;
- много доменных модулей и тестов;
- accounting, authorization, audit log и reporting.

Полезные места:

- [API errors](https://github.com/mikearnaldi/accountability/blob/main/packages/api/src/Definitions/ApiErrors.ts);
- [repository errors](https://github.com/mikearnaldi/accountability/blob/main/packages/core/src/shared/errors/RepositoryError.ts);
- [API definitions](https://github.com/mikearnaldi/accountability/tree/main/packages/api/src/Definitions);
- [API Layers](https://github.com/mikearnaldi/accountability/tree/main/packages/api/src/Layers);
- [API integration tests](https://github.com/mikearnaldi/accountability/tree/main/packages/api/test).

Оговорки:

- репозиторий создан 10 января 2026 года, а последняя отправка кода была 23 января — очень короткая история;
- нет README с эксплуатационным статусом и нет подтверждения реального production;
- `core` импортирует `HttpApiSchema`, поэтому бизнесовый слой связан с HTTP;
- `PersistenceError` сразу аннотирован HTTP 500;
- масштаб файлов не подтверждает зрелость.

**Вердикт:** хороший каталог Effect 3-конструкций и тестов, но не доказательство enterprise-качества.

## Оценка NextTickIT/billing-service

Репозиторий: [NextTickIT/billing-service](https://github.com/NextTickIT/billing-service)

Проект выглядит как качественный небольшой учебный или ранний production-проект. Enterprise-называть его пока нельзя.

### Что сделано хорошо

- [Schema validation и единый route adapter](https://github.com/NextTickIT/billing-service/blob/main/packages/backend/src/infra/http/route.ts);
- Effect runtime создаётся один раз;
- конфигурация передаётся через Layer;
- используются `Redacted` и `Clock`;
- токены хранятся как hashes;
- есть защита sign-in от user enumeration через dummy password verification;
- есть unit- и e2e-тесты;
- domain-код не читает `process.env`.

### Что мешает назвать его enterprise

#### 1. Очень молодой и маленький проект

Репозиторий создан 12 июня 2026 года. Backend содержит примерно 85 tracked files и только модули auth/health.

#### 2. Domain зависит от HTTP

[`auth/domain.ts`](https://github.com/NextTickIT/billing-service/blob/main/packages/backend/src/modules/auth/domain.ts) импортирует ошибки из `infra/http/errors.ts`, а сами ошибки имеют метод `toHttp()`:

```ts
export class Forbidden extends Data.TaggedError('Forbidden')<{
  readonly reason: string;
}> {
  toHttp(): HttpReply {
    return { status: 403, body: { error: 'Forbidden' } };
  }
}
```

Из-за этого бизнесовая ошибка знает о transport protocol. При добавлении RPC, queue consumer или CLI придётся либо тащить HTTP дальше, либо создавать второй набор ошибок.

#### 3. Error channel потерял точность

В `RouteDef` handler объявлен как:

```ts
Effect.Effect<Out, unknown, R>;
```

Компилятор не может проверить, что все ожидаемые ошибки endpoint перечислены и преобразованы.

#### 4. Mapping не exhaustive

[`toHttp`](https://github.com/NextTickIT/billing-service/blob/main/packages/backend/src/infra/http/reply.ts) использует duck typing: если у объекта есть `toHttp`, метод вызывается. Добавление новой ошибки не заставит разработчика обновить HTTP mapping.

#### 5. Неизвестные expected failures превращаются в тихий 500

`catchAll` перехватывает, например, типизированный `SqlError`, превращает его в generic 500, но не логирует. Глобальный [Fastify error handler](https://github.com/NextTickIT/billing-service/blob/main/packages/backend/src/plugins/error-handler.plugin.ts) такую ошибку уже не увидит.

#### 6. Комментарий о defects неточен

`Effect.catchAll` обрабатывает typed failures, но не defects. Defect в итоге попадёт в Fastify и станет 500, однако это другой маршрут обработки.

### Итоговая оценка

**Хороший небольшой vertical slice — вертикальный срез от HTTP до БД. Не enterprise reference.**

Можно брать:

- работу с `Redacted`;
- auth flow;
- singleton `ManagedRuntime`;
- тесты;
- разделение модулей.

Не следует копировать без изменений:

- `toHttp()` внутри domain errors;
- `unknown` как error type всех handlers;
- единый `catchAll(toHttp)` без обязательного логирования;
- duck-typed mapping ошибок.

## Какой набор использовать для wishlist

Не стоит искать один «идеальный» репозиторий. Лучше собрать проверенные части:

1. **HTTP contracts, Schema, OpenAPI и middleware**  
   Официальный [Effect-TS/examples/http-server](https://github.com/Effect-TS/examples/tree/main/examples/http-server).

2. **Repository, transaction и resource patterns**  
   [Hazel database layer](https://github.com/HazelChat/hazel/blob/main/packages/db/src/services/database.ts).

3. **Ошибки persistence → application → HTTP**  
   [beep-effect WorkItem slice](https://github.com/beep-effect/beep-effect/tree/main/packages/architecture-lab/use-cases/src/aggregates/WorkItem).

4. **Observability, correlation context и infrastructure failures**  
   [T3 Code server](https://github.com/pingdotgg/t3code/tree/main/apps/server/src).

Для текущего Effect 3 коды из Hazel, T3 Code и beep-effect нужно переводить концептуально, а не копировать: эти проекты используют Effect 4 beta.

## Целевая цепочка ошибок для wishlist

```text
Drizzle / PostgreSQL
  ├─ unique violation ───────────→ WishlistAlreadyExists
  ├─ expected not found ─────────→ WishlistNotFound
  ├─ connection/query failure ───→ WishlistRepositoryUnavailable
  └─ unknown exception ──────────→ defect

Use case
  ├─ WishlistAlreadyExists ──────→ public Conflict
  ├─ WishlistNotFound ───────────→ public NotFound
  └─ RepositoryUnavailable ──────→ logged internal error + generic ServiceUnavailable

HttpApi contract
  ├─ Conflict ───────────────────→ 409
  ├─ NotFound ───────────────────→ 404
  └─ ServiceUnavailable ─────────→ 503 + correlationId
```

Главный критерий качества: добавление нового варианта ошибки должно приводить к compile error в месте её преобразования. Внутренний `cause` должен попадать в logs/traces, но не в HTTP response.
