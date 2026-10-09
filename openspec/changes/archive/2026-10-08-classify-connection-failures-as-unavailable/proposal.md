# Proposal

## Why

Когда PostgreSQL недоступна, API отвечает `500` вместо `503`. Smoke задачи 3.2 изменения `add-session-logout` отрезал
собранный сервер от PostgreSQL до запроса: `POST /api/auth/logout`, `GET /api/auth/me` и `POST /api/auth/login` ответили
`500 INTERNAL_ERROR`. Требование «Ответ на временную недоступность» обещает для такого отказа `503`.

Причина в классификации `@effect/sql-pg` 4.0.0-rc.108: `classifyError` в `PgClient.ts` выбирает причину только по коду
SQLSTATE. У сетевого обрыва (`ECONNRESET`, `ECONNREFUSED`) кода нет, и библиотека возвращает `UnknownError` с
`operation: 'acquireConnection'` и `isRetryable === false`. `isRetryableSqlFailure` честно считает такой отказ
неповторяемым.

## What Changes

- `isRetryableSqlFailure` считает повторяемым `SqlError`, причина которого — `UnknownError` с `operation` `connect` или
  `acquireConnection`.
- Отказ PostgreSQL до выполнения запроса даёт `503 SERVICE_UNAVAILABLE` во всех маршрутах, которые переводят
  SQL-отказы через `isRetryableSqlFailure`: auth и users.
- Классифицированные причины на этапе соединения, например `AuthenticationError`, и обрыв во время выполнения запроса
  (`operation: 'execute'`) по-прежнему дают `500`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `api-errors`: требование «Ответ на временную недоступность» получает сценарий недоступной PostgreSQL; текст
  требования не меняется.

## Impact

- Код: `apps/api/src/infra/db/sql-failure.ts`.
- Тесты: `apps/api/src/infra/db/sql-failure.test.ts`.
- Вызывающие модули без изменений: `modules/auth/service/auth.service.ts`, `modules/users/service/users.service.ts`.
- Зависимости, конфигурация и схема БД не меняются.

Не проверено:

- Отказ PostgreSQL при остановленном сервере БД (`ECONNREFUSED`) проверяется так же, через `acquireConnection`, но
  smoke воспроизводит обрыв соединения прокси (`ECONNRESET`).
- Обрыв соединения во время выполнения запроса не воспроизводился.
