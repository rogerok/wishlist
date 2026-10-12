# Proposal

## Why

Шаг 2.3 [roadmap](../../../learning/roadmap.md) добавляет изменение своего Display Name через Account.
Архитектурное решение уже принято в [ADR-0006](../../../docs/adr/0006-account-module-for-self-service.md); термин Account определён в [CONTEXT.md](../../../CONTEXT.md).

## What Changes

- Добавить модуль `account` и защищённый `PATCH /api/account` без `:id`.
- Разрешить PATCH в существующей CORS-конфигурации для разрешённых origin.
- Принимать только обязательный `displayName`, используя `UserDisplayNameInputSchema`: trim, затем длина 1–100.
- Определять целевого User только по `CurrentSession.user.id`, предоставленному `SessionAuthentication`.
- Возвращать `200 OK` с обновлённым User по `UserResponseSchema`: `id`, `displayName`, `email`.
- Отклонять лишние поля, включая `id`, `userId`, `email`, и не изменять чужого User.
- Не менять Password Credential и Session; следующее чтение `GET /api/auth/me` с cookie любой действующей Session того же User показывает новое имя.
- Использовать существующие `AUTH_INVALID_SESSION`, `REQUEST_VALIDATION_FAILED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.
- Убрать привязку `AuthUnauthenticatedHttpError.instance` к `/api/auth/me`: значение берётся из пути текущего запроса.

## Capabilities

### New Capabilities

- `account`: действия текущего User над собой через Session; в этом изменении — только изменение своего Display Name.

### Modified Capabilities

Нет. Требования `user-auth` и `api-errors` сохраняются; Account использует существующий контракт технических ошибок.

## Impact

- Новый код: `apps/api/src/modules/account/` с API, схемами, handler, service, repository и Layer модуля.
- Подключение: `apps/api/src/infra/api/api.ts`, `apps/api/src/infra/api/api-live.ts`, `apps/api/src/app.ts`.
- HTTP-сервер: `apps/api/src/server.ts`, где `allowedMethods` пока не содержит PATCH.
- Переиспользование: схемы User, `SessionAuthentication`, `CurrentSession`, `withRequestParseOptions`, инфраструктура ошибок по [ADR-0005](../../../docs/adr/0005-technical-failure-logging-and-5xx-contract.md).
- Общая ошибка 401: `apps/api/src/modules/auth/api/auth.api.errors.ts`, её создание в `auth.handlers.ts` и проверки `auth.me.test.ts`.
- OpenAPI: тип `instance` у `AuthUnauthenticatedHttpError` расширяется с литерала `/api/auth/me` до строки; для `GET /api/auth/me` значение не меняется.
- Хранение: существующая таблица `users`; миграции и новые зависимости не нужны.
- Вне объёма: смена email и пароля, управление Session, Public Profile, роли, удаление публичного CRUD, развязка `auth` → `users`.
- Маршруты `users` по `:id` остаются открытыми до шага 2.6; Account не закрывает этот известный доступ к чужим данным.

### Предположения

- Конкретный новый маршрут — `PATCH /api/account`: ADR задаёт модуль и отсутствие id, но не HTTP-метод и суффикс.
- Лишние поля отклоняются существующим `withRequestParseOptions`, а не молча игнорируются.

### Не проверено

- Существующее поведение auth и технических ошибок сверено по коду и тестам, но тесты в этом planning workflow не запускались.
- Поведение нового Account ещё не реализовано; все его сценарии ниже являются целевым контрактом, а не описанием работающего endpoint.
