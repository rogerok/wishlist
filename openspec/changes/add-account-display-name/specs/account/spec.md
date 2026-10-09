# Spec Delta

## Purpose

Account позволяет текущему User изменять собственные данные, определяя его только по предъявленной Session.
Этот контракт описывает изменение своего Display Name без выбора User клиентом.

## ADDED Requirements

### Requirement: Сохранение своего Display Name

При действующей Session и валидном теле `PATCH /api/account` API SHALL сохранять Display Name связанного с Session User, удаляя пробелы по краям перед проверкой длины 1–100.

#### Scenario: Изменение имени с пробелами по краям

- **GIVEN** существует User A с `displayName: "Ada"` и действующей Session S1; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и телом `{ "displayName": "  Ada Lovelace  " }`
- **THEN** сохранённый `displayName` User A равен `"Ada Lovelace"`

#### Scenario: Допустимые границы длины

- **GIVEN** существует User A с `displayName: "Ada"` и действующей Session S1; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и строкой `displayName` из 1 либо 100 символов `a`
- **THEN** сохранённый `displayName` User A точно равен переданной строке

### Requirement: Ответ с обновлённым User

Успешный `PATCH /api/account` SHALL отвечать `200 OK` с JSON, содержащим только `id`, `displayName`, `email` обновлённого User.

#### Scenario: Ответ содержит новое имя

- **GIVEN** существует User A с известным `id`, `displayName: "Ada"`, `email: "ada@example.test"` и действующей Session S1; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и телом `{ "displayName": "Grace" }`
- **THEN** API отвечает `200 OK`
- **AND** JSON содержит ровно `id` User A, `displayName: "Grace"`, `email: "ada@example.test"`

### Requirement: Изоляция других User

Изменение Display Name через `PATCH /api/account` SHALL оставлять данные всех User, кроме связанного с предъявленной Session, неизменными независимо от параметров query.

#### Scenario: User A не выбирает User B через query

- **GIVEN** существуют User A и B с именами `"Ada"` и `"Bob"`; у User A действует Session S1; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account?id=<id User B>` с cookie User A и телом `{ "displayName": "Grace" }`
- **THEN** все сохранённые поля User B остаются прежними

### Requirement: Отсутствие маршрута Account по id

API SHALL отвечать `404 Not Found` на `PATCH /api/account/<id User>`, поскольку Account не адресуется по id.

#### Scenario: User A не выбирает User B через путь

- **GIVEN** существуют User A и B; у User A действует Session S1; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account/<id User B>` с cookie S1 и телом `{ "displayName": "Grace" }`
- **THEN** API отвечает `404 Not Found`

### Requirement: Отклонение невалидного тела

При действующей Session API SHALL отклонять `PATCH /api/account` с отсутствующим, нестроковым, пустым после trim или длиннее 100 после trim `displayName`, либо с лишними полями, ответом `400` problem+json с `code: REQUEST_VALIDATION_FAILED`, `instance: /api/account` и без изменения User.

#### Scenario: Невалидный Display Name

- **GIVEN** существует User A с `displayName: "Ada"` и действующей Session S1; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и одним из тел: `{}`, `{ "displayName": null }`, `{ "displayName": 42 }`, `{ "displayName": "" }`, `{ "displayName": "   " }` либо `displayName` из 101 символа `a`
- **THEN** API отвечает `400` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: REQUEST_VALIDATION_FAILED`, `instance: /api/account`
- **AND** все сохранённые поля User A остаются прежними

#### Scenario: Попытка передать чужой id в теле

- **GIVEN** существуют User A и B с именами `"Ada"` и `"Bob"`; у User A действует Session S1; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1, `displayName: "Grace"` и дополнительным полем `id` либо `userId`, равным id User B
- **THEN** API отвечает `400` problem+json с `code: REQUEST_VALIDATION_FAILED`, `instance: /api/account`
- **AND** все сохранённые поля User A и User B остаются прежними

#### Scenario: Попытка изменить email

- **GIVEN** существует User A с `displayName: "Ada"`, `email: "ada@example.test"` и действующей Session S1; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и телом `{ "displayName": "Grace", "email": "other@example.test" }`
- **THEN** API отвечает `400` problem+json с `code: REQUEST_VALIDATION_FAILED`, `instance: /api/account`
- **AND** все сохранённые поля User A остаются прежними

### Requirement: Отказ без действующей Session

При отсутствующей, повреждённой, неизвестной или истекшей Session API SHALL отклонять `PATCH /api/account` ответом `401` problem+json с `code: AUTH_INVALID_SESSION`, `instance: /api/account` и без изменения User.

#### Scenario: Отсутствующая cookie

- **GIVEN** существует User A с `displayName: "Ada"`; запрос не содержит cookie `wishlist_session`; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с телом `{ "displayName": "Grace" }`
- **THEN** API отвечает `401` problem+json с `code: AUTH_INVALID_SESSION`, `instance: /api/account`
- **AND** все сохранённые поля User A остаются прежними

#### Scenario: Повреждённая cookie

- **GIVEN** существует User A с `displayName: "Ada"`; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с cookie `wishlist_session=abc` и телом `{ "displayName": "Grace" }`
- **THEN** API отвечает `401` problem+json с `code: AUTH_INVALID_SESSION`, `instance: /api/account`
- **AND** все сохранённые поля User A остаются прежними

#### Scenario: Неизвестная либо истекшая Session

- **GIVEN** существует User A с `displayName: "Ada"`; cookie имеет корректный формат, но соответствующая Session отсутствует либо её `expiresAt` не позже текущего времени; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с этой cookie и телом `{ "displayName": "Grace" }`
- **THEN** API отвечает `401` problem+json с `code: AUTH_INVALID_SESSION`, `instance: /api/account`
- **AND** все сохранённые поля User A остаются прежними

### Requirement: Сохранение прочих данных User

Успешный `PATCH /api/account` SHALL оставлять `id`, `email` и Password Credential текущего User неизменными.

#### Scenario: Изменение только имени

- **GIVEN** существует User A с известными `id`, `email`, `displayName: "Ada"`, ровно одним Password Credential и действующей Session S1; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и телом `{ "displayName": "Grace" }`
- **THEN** `id`, `email` и все поля Password Credential User A остаются прежними

### Requirement: Сохранение Session при изменении имени

Успешный `PATCH /api/account` SHALL оставлять все Session неизменными и не выдавать cookie `wishlist_session` в ответе.

#### Scenario: Имя меняется без перевыдачи Session

- **GIVEN** существуют User A и B; у A ровно две действующие Session S1 и S2, у B ровно одна действующая Session S3; PostgreSQL доступен
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и телом `{ "displayName": "Grace" }`
- **THEN** в БД остаются ровно S1, S2, S3 с прежними значениями всех полей
- **AND** ответ не содержит `Set-Cookie` для `wishlist_session`

### Requirement: Видимость нового имени через любую Session User

После успешного изменения Display Name через Account последующий `GET /api/auth/me` с cookie любой действующей Session того же User SHALL возвращать новое имя этого User.

#### Scenario: Чтение после изменения

- **GIVEN** у User A две действующие Session S1 и S2; Display Name уже изменён на `"Grace"` успешным `PATCH /api/account` с cookie S1; после него данные не меняются; PostgreSQL доступен
- **WHEN** клиент отправляет `GET /api/auth/me` с cookie S2
- **THEN** ответ содержит `displayName: "Grace"`

### Requirement: Временная недоступность Account

При временной недоступности во время аутентификации или изменения Display Name `PATCH /api/account` SHALL возвращать `503` problem+json с `code: SERVICE_UNAVAILABLE`, `instance: /api/account` по контракту `api-errors`.

#### Scenario: Недоступность при аутентификации

- **GIVEN** существует User A с действующей Session S1; PostgreSQL недоступен до запроса и не устанавливает соединение
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и телом `{ "displayName": "Grace" }`
- **THEN** API отвечает `503` problem+json с `code: SERVICE_UNAVAILABLE`, `instance: /api/account` по контракту `api-errors`

#### Scenario: Временный отказ записи

- **GIVEN** существует User A с действующей Session S1; аутентификация успешна; запись имени завершается временным SQL-отказом
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и телом `{ "displayName": "Grace" }`
- **THEN** API отвечает `503` problem+json с `code: SERVICE_UNAVAILABLE`, `instance: /api/account` по контракту `api-errors`

### Requirement: Внутренний технический отказ Account

При внутреннем техническом отказе во время аутентификации или изменения Display Name `PATCH /api/account` SHALL возвращать `500` problem+json с `code: INTERNAL_ERROR`, `instance: /api/account` по контракту `api-errors`.

#### Scenario: Внутренний отказ записи

- **GIVEN** существует User A с действующей Session S1; аутентификация успешна; запись имени завершается необратимым SQL-отказом
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и телом `{ "displayName": "Grace" }`
- **THEN** API отвечает `500` problem+json с `code: INTERNAL_ERROR`, `instance: /api/account` по контракту `api-errors`

#### Scenario: Непредвиденное исключение Account

- **GIVEN** существует User A с действующей Session S1; аутентификация успешна; обработка изменения имени завершается непредвиденным исключением
- **WHEN** клиент отправляет `PATCH /api/account` с cookie S1 и телом `{ "displayName": "Grace" }`
- **THEN** API отвечает `500` problem+json с `code: INTERNAL_ERROR`, `instance: /api/account` по контракту `api-errors`

### Requirement: Доступ Account из разрешённого origin

API SHALL разрешать credentialed-запросы `PATCH /api/account` с JSON-телом из origin, перечисленных в `CORS_ALLOWED_ORIGINS`.

#### Scenario: Preflight разрешённого origin

- **GIVEN** API запущен с `http://localhost:5173` в `CORS_ALLOWED_ORIGINS` и включёнными CORS credentials
- **WHEN** клиент отправляет `OPTIONS /api/account` с `Origin: http://localhost:5173`, `Access-Control-Request-Method: PATCH`, `Access-Control-Request-Headers: content-type`
- **THEN** ответ разрешает метод PATCH и заголовок content-type
- **AND** ответ содержит `Access-Control-Allow-Origin: http://localhost:5173`, `Access-Control-Allow-Credentials: true`
