# Proposal

## Why

Клиент пока не может завершить текущую Session через API: маршрут logout закомментирован.
Нужен выход, который отзывает только предъявленную Session и не скрывает технический отказ за успешным ответом.

## What Changes

- Добавить `POST /api/auth/logout` без обязательной аутентификации и без тела запроса; успешный ответ — `204 No Content`
  без тела.
- Удалять только Session, соответствующую cookie `wishlist_session`; остальные Session User оставлять без изменений.
- Возвращать `204` при отсутствующей или повреждённой cookie, неизвестной или истекшей Session.
- При каждом `204` выдавать истекающую `wishlist_session`, даже если запрос пришёл без cookie.
- Отдельно зафиксировать атрибуты истекающей cookie: `Path=/api`, `HttpOnly`, `SameSite=Lax`, `Secure` только в
  production.
- При временной недоступности возвращать `503`, при внутреннем отказе — `500` по существующему контракту `api-errors`.
  Эти ответы не содержат `Set-Cookie` для `wishlist_session`.
  Контракт `500`/`503` не обещает неизменность БД при неопределённом результате удаления.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `user-auth`: добавить требования logout, повторного выхода, истекающей cookie и поведения logout при техническом
  отказе.

`api-errors` применяется без изменений: требования уже охватывают `500`/`503`, Problem Details и `errorId` для любого
пути запроса.

## Impact

- Контракт и handler: `apps/api/src/modules/auth/api/auth.api.ts`,
  `apps/api/src/modules/auth/handlers/auth.handlers.ts`.
- Сервис и типы ошибок: `apps/api/src/modules/auth/service/auth.service.ts`, `auth.service.errors.ts` рядом с ним.
- Использовать существующие `authLogoutPath`, `AuthOperation.logout`, `sessionCookieSecurity`, `AuthTokenSchema`,
  `digestSessionToken` и `SessionRepository.deleteByTokenDigest`.
- Дополнить HTTP-тесты logout; обновить существующие подмены `AuthService` после расширения его интерфейса.
- Схема PostgreSQL, production-зависимости и `SessionAuthentication` не меняются.
- Handler читает cookie через `HttpApiBuilder.securityDecode`; optional middleware не вводится до второго потребителя,
  например Reservation по ADR-0002.
- Решения о Session и технических отказах остаются в [ADR-0001](../../../docs/adr/0001-postgresql-backed-sessions.md)
  и [ADR-0005](../../../docs/adr/0005-technical-failure-logging-and-5xx-contract.md).

### Не проверено

- Logout ещё не реализован; HTTP-сценарии, атрибуты истекающей cookie и поведение при отказах требуют проверки на этапе
  apply.
- Наличие `deleteByTokenDigest` и его теста установлено чтением кода; команды тестирования при подготовке предложения не
  запускались.
