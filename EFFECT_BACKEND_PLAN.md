# План разработки Effect API в Turborepo

## Основные решения

- Runtime: Node.js LTS.
- Расположение приложения: `apps/api`.
- Package manager: pnpm.
- Оркестрация: Turborepo.
- Effect: `effect`, `@effect/platform`, `@effect/platform-node`.
- Разработка: `tsx watch`.
- Production build: `tsc` с выводом в `dist`.
- Тесты: Vitest и `@effect/vitest`.
- HTTP: Effect `HttpApi`/`HttpServer`, если допустима нестабильность API.
- Общие контракты: отдельный `packages/contracts` только после появления реального потребителя на фронтенде.
- Vite для API не использовать.

> Нативные HTTP-модули Effect отмечены как unstable. Для проекта, допускающего обновления API Effect, можно использовать Effect HTTP stack. Если необходима консервативная production-граница, HTTP-слой следует построить на Fastify, оставив Effect для бизнес-логики, конфигурации, ошибок, конкурентности и управления ресурсами.

## Предлагаемая структура

```text
apps/
  web/
  docs/
  api/
    src/
      main.ts
      app/
      config/
      http/
      modules/
        users/
        wishlists/
      infrastructure/
    test/
    package.json
    tsconfig.json
    tsconfig.build.json

packages/
  eslint-config/
  typescript-config/
  ui/
  contracts/          # добавить позже при реальной необходимости
```

Пример структуры доменного модуля:

```text
modules/wishlists/
  domain/
  application/
  infrastructure/
  http/
```

Не создавать отдельные workspace-пакеты для каждого repository, database adapter или домена заранее. Пока код используется только API, он должен оставаться в `apps/api`.

## Этап 1. Зафиксировать runtime и HTTP-стек

1. Выбрать Node.js LTS.
2. Закрепить версию Node через `.nvmrc`, `.node-version` или используемый менеджер версий.
3. Сохранить pnpm как единый package manager.
4. Выбрать HTTP-границу:
   - Effect `HttpApi`/`HttpServer` для Effect-native реализации;
   - Fastify для более стабильной HTTP-границы.
5. Использовать ESM и `"type": "module"`.

### Результат

В проекте используется один runtime и нет смешения Node, Bun, Vite и нескольких HTTP-фреймворков.

## Этап 2. Создать workspace `apps/api`

1. Создать `apps/api` и его `package.json`.
2. Подключить `@repo/typescript-config` и `@repo/eslint-config`.
3. Добавить scripts:
   - `dev`;
   - `build`;
   - `start`;
   - `lint`;
   - `check-types`;
   - `test`;
   - при необходимости `test:watch`.
4. Не создавать отдельные корневые scripts для каждого приложения: Turborepo должен запускать одноимённые задачи workspace-пакетов.

### Результат

`apps/api` является полноценным участником pnpm workspace и Turbo pipeline.

## Этап 3. Настроить TypeScript

Использовать две конфигурации.

### `tsconfig.json`

- строгий режим;
- `noEmit`;
- ESM;
- наследование общей конфигурации;
- Effect language service/plugin, если он совместим с выбранной версией TypeScript.

### `tsconfig.build.json`

- вывод в `dist`;
- source maps;
- исключение тестов;
- declaration-файлы не нужны, пока API не является библиотекой;
- запрет импорта чужих workspace-исходников через относительные пути.

### Почему `tsc`, а не Vite

Для долгоживущего Node-процесса bundling обычно не требуется. `tsc` даёт понятные source maps и stack traces и не требует настраивать external dependencies. Если позднее понадобится единый bundle для serverless или ускорения запуска контейнера, отдельно рассмотреть `esbuild` или `tsdown`.

## Этап 4. Подключить Effect

Минимальные зависимости:

- `effect`;
- `@effect/platform`;
- `@effect/platform-node`.

По мере необходимости:

- `@effect/sql` и конкретный драйвер после выбора базы;
- `@effect/opentelemetry` после выбора observability-инфраструктуры;
- `@effect/vitest` для Effect-ориентированных тестов.

Точка входа должна только собирать Layers и запускать приложение. Бизнес-логика не должна напрямую читать `process.env`, открывать соединения или создавать глобальные singleton-объекты.

## Этап 5. Спроектировать Layer-граф

Разделить зависимости на следующие слои:

1. Config layer: порт, environment, database URL, секреты и логирование.
2. Infrastructure layers: база, HTTP server и внешние API.
3. Repository layers: persistence и преобразование ошибок драйвера в доменные ошибки.
4. Application/service layers: use cases, бизнес-правила и транзакционные границы.
5. HTTP layer: маршруты, декодирование запросов и преобразование ошибок в HTTP responses.
6. Main layer: финальная композиция, запуск Node runtime и graceful shutdown.

Доменная логика должна зависеть от интерфейсов сервисов. Конкретные Node- и DB-реализации подключаются в composition root.

## Этап 6. Поднять минимальный HTTP-сервер

1. Реализовать `GET /health`.
2. Добавить типизированный успешный ответ.
3. Добавить типизированную ошибку, если health зависит от инфраструктуры.
4. Получать порт из конфигурации.
5. Обработать `SIGTERM` и `SIGINT`.
6. Добавить структурированные логи запуска и завершения.

### Проверка

- `dev` запускает сервер и перезапускает его после изменений;
- health endpoint отвечает;
- процесс освобождает ресурсы при остановке;
- `build` создаёт `dist`;
- `start` запускает собранный код.

## Этап 7. Интегрировать API в Turborepo

1. Добавить `dist/**` в outputs задачи `build`; текущая конфигурация ориентирована на `.next/**`.
2. Оставить `dev` persistent и без кэша.
3. Настроить запуск `web` и `api` через Turbo filters, когда документация не нужна.
4. Сохранить `build.dependsOn: ["^build"]`.
5. Оставить одноимённые `lint` и `check-types` во всех приложениях.
6. Добавить задачу `test` после появления тестов.
7. Отделить watch-режим и integration-тесты от кэшируемых unit-тестов.

## Этап 8. Обновить ESLint и lint-staged

1. Добавить `apps/api` в lint-staged.
2. Запускать ESLint из контекста `apps/api`, чтобы ESLint 9 находил локальный flat config.
3. Запускать Prettier после ESLint.
4. Оставить pre-commit ограниченным staged-файлами.
5. Не запускать полный Turbo build или весь test suite в pre-commit; полные проверки выполнять в CI.

## Этап 9. Реализовать первую бизнес-вертикаль

В качестве первой вертикали использовать один законченный сценарий, например создание списка желаний:

1. Входная Schema.
2. Типизированная команда или use case.
3. Доменная модель.
4. Repository service.
5. In-memory реализация repository.
6. HTTP endpoint.
7. Маппинг validation, conflict, infrastructure и unexpected ошибок.
8. Тесты use case.
9. Интеграционный тест endpoint.

Сначала использовать in-memory repository, затем подключать базу. Это разделяет проверку архитектуры Effect и отладку SQL.

## Этап 10. Подключить PostgreSQL

1. Определить модель данных.
2. Выбрать подходящий драйвер `@effect/sql-*`.
3. Оформить connection pool как scoped Layer.
4. Настроить migrations.
5. Реализовать SQL repository.
6. Сохранить in-memory Layer для быстрых тестов.
7. Проверить подключение, ошибки, rollback, закрытие pool и конкурентные запросы.

SQL-модели не должны напрямую становиться HTTP DTO. Между БД, доменом и транспортом нужны явные границы.

## Этап 11. Добавить общие контракты с фронтендом

Создать `packages/contracts`, только когда `apps/web` действительно начнёт импортировать API-контракты.

В пакет можно вынести:

- request/response schemas;
- DTO;
- публичные идентификаторы;
- публичные error contracts.

Не выносить:

- repository interfaces;
- database entities;
- Layers;
- Node-зависимости;
- серверную конфигурацию;
- бизнес-сервисы.

Пакет контрактов должен быть platform-independent и безопасен для browser bundle.

## Этап 12. Настроить тестовую стратегию

### Unit-тесты

- бизнес-правила;
- типизированные ошибки;
- управление ресурсами;
- retry и timeout только там, где они входят в контракт.

### HTTP integration

- decoding;
- status codes;
- response schemas;
- error mapping;
- middleware;
- запуск реального HTTP Layer на случайном порту.

### Database integration

- migrations;
- constraints;
- transaction behavior;
- repository semantics.

Не тестировать внутреннюю структуру Effect pipeline и детали Layer-композиции, которые не наблюдаемы снаружи.

## Этап 13. Настроить CI и production-проверку

После первой полноценной вертикали CI должен выполнять:

1. lint;
2. check-types;
3. unit-тесты;
4. integration-тесты;
5. build;
6. запуск собранного сервера;
7. запрос health endpoint;
8. graceful shutdown.

Docker и OpenTelemetry добавлять только после определения deployment и observability-инфраструктуры.

## Итоговый набор инструментов

| Задача             | Выбор                                       |
| ------------------ | ------------------------------------------- |
| Runtime            | Node.js LTS                                 |
| Package manager    | pnpm                                        |
| Оркестрация        | Turborepo                                   |
| Dev runner         | `tsx watch`                                 |
| Production build   | `tsc`                                       |
| HTTP               | Effect HttpApi/HttpServer                   |
| Runtime adapter    | `@effect/platform-node`                     |
| Validation         | Effect Schema                               |
| Tests              | Vitest + `@effect/vitest`                   |
| Database           | PostgreSQL + подходящий `@effect/sql-*`     |
| Frontend contracts | `packages/contracts`, но не заранее         |
| Vite               | Не использовать для API                     |
| ESLint             | Локальный flat config в `apps/api`          |
| Git hooks          | существующие Prettier + lint-staged + Husky |

## Ссылки

- [Effect introduction](https://effect.website/docs/getting-started/introduction/)
- [Effect Platform introduction](https://effect.website/docs/platform/introduction/)
- [Effect Platform HTTP modules](https://github.com/Effect-TS/effect/blob/v3/packages/platform/README.md)
