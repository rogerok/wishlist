# Proposal

## Why

Ответы на технические отказы были свои у каждого модуля (`AUTH_INTERNAL_ERROR`, `USERS_UNAVAILABLE` и т. д.) и не
содержали ничего, что связывает ответ клиенту со строкой лога. Изменение вводит общий для всех модулей контракт ответов
`500` и `503` и поле `traceId`; причины решения — в [ADR-0005](../../../../docs/adr/0005-technical-failure-logging-and-5xx-contract.md).

## What Changes

- **BREAKING** Коды `AUTH_INTERNAL_ERROR`, `AUTH_UNAVAILABLE_ERROR`, `USERS_INTERNAL_ERROR`, `USERS_UNAVAILABLE`
  заменяются общими `INTERNAL_ERROR` (`500`) и `SERVICE_UNAVAILABLE` (`503`). Внешних клиентов у API пока нет.
- Тело ответа на технический отказ получает поле `traceId`: идентификатор трассы запроса или trace id из входящего
  заголовка `traceparent`.
- Поле `instance` ответов `500` и `503` равно пути запроса.
- Логирование технических отказов меняется по ADR-0005; формат логов не входит в спецификацию, потому что клиент его не
  наблюдает.

## Capabilities

### New Capabilities

- `api-errors`: ответы API на технические отказы — статус, тело problem+json, связь с трассой и нераскрытие причины.

### Modified Capabilities

Нет. Требования `user-auth` не упоминали ответы `500` и `503`.

## Impact

- Код: `apps/api/src/infra/errors/`, `apps/api/src/infra/logging/`, хендлеры и контракты `auth` и `users`,
  security-middleware `SessionAuthentication`.
- Тесты: `infra/errors/technical-failure.test.ts`, `infra/logging/error-chain.test.ts`,
  `modules/auth/handlers/auth.handlers.test.ts`, `modules/users/handlers/users.handlers.test.ts`.
- Зависимости и конфигурация не меняются.

Сценарии спецификации подтверждены тестами `POST /api/auth/signup` в `auth.handlers.test.ts`.

Не проверено и поэтому не включено в сценарии:

- `503` при сбое базы данных, который можно повторить: сервисы классифицируют его так, но HTTP-теста нет.
- Ответы `500` и `503` на `GET /api/auth/me`: обработчик `/me` не завершён, его тесты красные.
- Поле `instance` и тип содержимого для эндпоинтов `users`: тест проверяет только статус и `code`.
