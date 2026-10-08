# Proposal

## Why

Поле `traceId` в ответах `500` и `503` бралось из server span, а Effect строит span по входящим заголовкам `traceparent`,
`b3` и `x-b3-traceid`. Клиент выбирал значение сам, а заголовки B3 не проверялись вовсе: строка
`x-b3-traceid: victim@example.test …` попадала в тело ответа и в лог. Решение и отвергнутые варианты — в
[ADR-0005](../../../../docs/adr/0005-technical-failure-logging-and-5xx-contract.md).

## What Changes

- **BREAKING** Поле `traceId` в теле ответов `500` и `503` заменяется полем `errorId`. Внешних клиентов у API пока нет.
- `errorId` — 32 шестнадцатеричных символа, которые сервер генерирует для каждого технического отказа; заголовки
  трассировки запроса на него не влияют.
- Строка лога `operation.failed` и строка `operation.defect.details` вместо `traceId` содержат `errorId` с тем же
  значением, что и в ответе.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `api-errors`: требование «Идентификатор трассы в ответе на технический отказ» удаляется; добавляется требование
  «Идентификатор ошибки в ответе на технический отказ».

## Impact

- Код: `apps/api/src/infra/errors/technical-http-errors.ts`, `technical-failure.ts`, `defect-boundary.ts`.
- Тесты: `infra/errors/technical-failure.test.ts`, `modules/auth/handlers/auth.handlers.test.ts`,
  `modules/users/handlers/users.handlers.test.ts`.
- Зависимости и конфигурация не меняются.

Не проверено на настоящем эндпоинте и поэтому не включено в сценарии:

- новый `errorId` для каждого отказа: проверено двумя запросами к тестовому API;
- игнорирование заголовка `b3`: проверено на тестовом API, на `POST /api/auth/signup` проверены `traceparent` и
  `x-b3-traceid`.
