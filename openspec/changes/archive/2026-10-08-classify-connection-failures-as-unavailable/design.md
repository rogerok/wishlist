# Design

## Context

Мотивация — в [proposal.md](proposal.md#why), контракт — в [delta-спецификации](specs/api-errors/spec.md).

- `isRetryableSqlFailure` (`apps/api/src/infra/db/sql-failure.ts`) возвращает `isRetryable` из `SqlError`. Его вызывают
  `mapTechnicalError` в `auth.service.ts` и перевод ошибок в `users.service.ts`: `true` даёт `503`, `false` — `500`.
- `@effect/sql-pg` 4.0.0-rc.108, `PgClient.ts`: `classifyError` выбирает причину по коду SQLSTATE. `08xxx` →
  `ConnectionError` (повторяемая), `28xxx` → `AuthenticationError` (неповторяемая), без кода или с неизвестным кодом →
  `UnknownError` (неповторяемая). Этап библиотека передаёт в поле `operation`: `connect`, `acquireConnection`,
  `execute`, `stream`, `listen`.
- Smoke `apps/api/logout.smoke.ts` воспроизвёл обрыв: прокси между сервером и PostgreSQL рвёт соединения. Цепочка
  ошибки: `SqlError → UnknownError`, `operation: 'acquireConnection'`.

## Goals / Non-Goals

**Goals:**

- Отказ PostgreSQL до выполнения запроса даёт `503` через существующий перевод ошибок, без изменений в модулях.

**Non-Goals:**

- Обрыв соединения во время выполнения запроса (`operation: 'execute'`): результат команды неизвестен, это отдельное
  решение.
- Разбор сетевых кодов Node и драйвера `pg`.
- Повторы SQL-запросов внутри API.

## Decisions

### 1. Классифицировать по этапу `operation`, а не по сетевым кодам

`isRetryableSqlFailure` считает повторяемым `SqlError`, причина которого — `UnknownError` с `operation` `connect` или
`acquireConnection`. Ошибка на этапе получения соединения означает, что команда в PostgreSQL не отправлялась, и повтор
может пройти.

Владелец выбрал этот вариант: он опирается на поле самой библиотеки, и не нужно поддерживать список ошибок драйвера и
Node.

Отклонены:

- **Разбор `cause` по кодам `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`.** Ловит и обрыв во время запроса, но требует
  поддерживать список строк из Node и `pg`.
- **Оставить `500`.** Настоящий отказ БД нарушает требование «Ответ на временную недоступность», а тесты с подменой
  `ConnectionError` остаются зелёными.

### 2. Только `UnknownError`

Причины, которые библиотека уже классифицировала, сохраняют собственный `isRetryable`. Неверный пароль к БД
(`AuthenticationError`) на этапе `acquireConnection` остаётся `500`: повтор его не исправит.

## Risks / Trade-offs

- [Effect 4 — release candidate; обновление может переименовать значения `operation`] → таблица
  `sql-failure.test.ts` фиксирует строки `connect` и `acquireConnection`, smoke проверяет настоящий отказ.
- [Неклассифицированный SQLSTATE на этапе соединения, например `53300` too_many_connections или `57P03`
  cannot_connect_now, тоже станет `503`] → для этих кодов повтор как раз может пройти.
- [Неверное имя базы (`3D000`) на этапе `acquireConnection` дало бы `503`] → `PgClient.layer` соединяется при старте
  (`operation: 'connect'` при сборке Layer), и сервер с неверной конфигурацией не запускается.
