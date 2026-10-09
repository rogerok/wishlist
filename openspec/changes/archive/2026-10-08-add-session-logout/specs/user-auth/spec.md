# Spec Delta

## ADDED Requirements

### Requirement: Отзыв только предъявленной Session

При успешном `POST /api/auth/logout` с cookie `wishlist_session`, соответствующей существующей Session независимо от её
срока,
API SHALL удалять только эту Session, не изменяя остальные Session этого или другого User.

#### Scenario: Выход из одной из нескольких Session

- **GIVEN** у User A ровно две действующие Session S1 и S2 с разными cookie
- **AND** у User B ровно одна действующая Session S3
- **AND** PostgreSQL доступен, и удаление завершается успешно
- **WHEN** клиент отправляет `POST /api/auth/logout` с cookie S1
- **THEN** строка S1 отсутствует в БД
- **AND** у User A остаётся ровно одна Session S2 с прежними значениями полей
- **AND** у User B остаётся ровно одна Session S3 с прежними значениями полей

#### Scenario: Удаление существующей истекшей Session

- **GIVEN** у User ровно две Session: истекшая S1 и действующая S2
- **AND** PostgreSQL доступен, и удаление завершается успешно
- **WHEN** клиент отправляет `POST /api/auth/logout` с cookie S1
- **THEN** строка S1 отсутствует в БД
- **AND** у User остаётся ровно одна Session S2 с прежними значениями полей

### Requirement: Успешный ответ logout независимо от действительности Session

При отсутствии технического отказа API SHALL отвечать на `POST /api/auth/logout` кодом `204 No Content` без тела,
независимо от отсутствия cookie `wishlist_session`, её повреждённого формата, отсутствия соответствующей Session или
истечения её срока.

#### Scenario: Действующая Session

- **GIVEN** у User ровно одна действующая Session S1
- **AND** PostgreSQL доступен, и удаление завершается успешно
- **WHEN** клиент отправляет `POST /api/auth/logout` с cookie S1 без тела запроса
- **THEN** API отвечает `204 No Content` без тела

#### Scenario: Отсутствующая cookie

- **GIVEN** запрос не содержит cookie `wishlist_session`, и технического отказа при обработке нет
- **WHEN** клиент отправляет `POST /api/auth/logout` без тела запроса
- **THEN** API отвечает `204 No Content` без тела

#### Scenario: Повреждённая cookie

- **GIVEN** cookie `wishlist_session` имеет значение `abc`, и технического отказа при обработке нет
- **WHEN** клиент отправляет `POST /api/auth/logout` с этой cookie без тела запроса
- **THEN** API отвечает `204 No Content` без тела

#### Scenario: Неизвестная Session

- **GIVEN** cookie `wishlist_session` имеет корректный формат, но соответствующей строки Session в БД нет
- **AND** PostgreSQL доступен, и операция удаления завершается успешно
- **WHEN** клиент отправляет `POST /api/auth/logout` с этой cookie без тела запроса
- **THEN** API отвечает `204 No Content` без тела

#### Scenario: Истекшая Session

- **GIVEN** у User ровно одна Session S1 с истекшим сроком
- **AND** PostgreSQL доступен, и удаление завершается успешно
- **WHEN** клиент отправляет `POST /api/auth/logout` с cookie S1 без тела запроса
- **THEN** API отвечает `204 No Content` без тела

#### Scenario: Повторный logout

- **GIVEN** предыдущий logout с cookie S1 завершился успешно, и строки S1 больше нет в БД
- **AND** PostgreSQL доступен, и операция удаления завершается успешно
- **WHEN** клиент повторно отправляет `POST /api/auth/logout` с прежней cookie S1 без тела запроса
- **THEN** API отвечает `204 No Content` без тела

### Requirement: Истекающая cookie при каждом успешном logout

Каждый ответ `204` на `POST /api/auth/logout` SHALL содержать ровно одну истекающую cookie `wishlist_session` с пустым
значением, `Max-Age=0` и `Expires=Thu, 01 Jan 1970 00:00:00 GMT`, независимо от наличия cookie в запросе.

#### Scenario: Истечение cookie после удаления Session

- **GIVEN** у User ровно одна действующая Session S1
- **AND** PostgreSQL доступен, и удаление завершается успешно
- **WHEN** клиент отправляет `POST /api/auth/logout` с cookie S1
- **THEN** ответ содержит ровно одну cookie `wishlist_session` с пустым значением, `Max-Age=0` и
  `Expires=Thu, 01 Jan 1970 00:00:00 GMT`

#### Scenario: Истечение cookie без cookie в запросе

- **GIVEN** запрос не содержит cookie `wishlist_session`, и технического отказа при обработке нет
- **WHEN** клиент отправляет `POST /api/auth/logout`
- **THEN** ответ содержит ровно одну cookie `wishlist_session` с пустым значением, `Max-Age=0` и
  `Expires=Thu, 01 Jan 1970 00:00:00 GMT`

#### Scenario: Истечение повреждённой cookie

- **GIVEN** cookie `wishlist_session` имеет повреждённое значение `abc`
- **AND** технического отказа при обработке нет
- **WHEN** клиент отправляет `POST /api/auth/logout` с этой cookie
- **THEN** ответ содержит ровно одну cookie `wishlist_session` с пустым значением, `Max-Age=0` и
  `Expires=Thu, 01 Jan 1970 00:00:00 GMT`

#### Scenario: Истечение cookie неизвестной Session

- **GIVEN** cookie `wishlist_session` имеет корректный формат, но соответствующей строки Session в БД нет
- **AND** технического отказа при обработке нет
- **WHEN** клиент отправляет `POST /api/auth/logout` с этой cookie
- **THEN** ответ содержит ровно одну cookie `wishlist_session` с пустым значением, `Max-Age=0` и
  `Expires=Thu, 01 Jan 1970 00:00:00 GMT`

#### Scenario: Истечение cookie истекшей Session

- **GIVEN** cookie `wishlist_session` соответствует существующей Session с истекшим сроком
- **AND** технического отказа при обработке нет
- **WHEN** клиент отправляет `POST /api/auth/logout` с этой cookie
- **THEN** ответ содержит ровно одну cookie `wishlist_session` с пустым значением, `Max-Age=0` и
  `Expires=Thu, 01 Jan 1970 00:00:00 GMT`

### Requirement: Атрибуты истекающей Session cookie

Истекающая cookie `wishlist_session` в успешном ответе logout SHALL иметь `Path=/api`, `HttpOnly`, `SameSite=Lax` и
атрибут `Secure` только в production, как cookie при выдаче Session.

#### Scenario: Атрибуты истекающей cookie вне production

- **GIVEN** API работает в режиме test, запрос не содержит cookie, и технического отказа при обработке нет
- **WHEN** клиент отправляет `POST /api/auth/logout`
- **THEN** истекающая cookie `wishlist_session` имеет `Path=/api`, `HttpOnly`, `SameSite=Lax` и не имеет `Secure`

#### Scenario: Атрибуты истекающей cookie в production

- **GIVEN** API работает в production, запрос не содержит cookie, и технического отказа при обработке нет
- **WHEN** клиент отправляет `POST /api/auth/logout`
- **THEN** истекающая cookie `wishlist_session` имеет `Path=/api`, `HttpOnly`, `SameSite=Lax` и `Secure`

### Requirement: Отказ logout при временной недоступности

При временной недоступности ресурса во время `POST /api/auth/logout` API SHALL отвечать `503 Service Unavailable` по
контракту `api-errors`, без заголовка `Set-Cookie` для `wishlist_session`.

#### Scenario: PostgreSQL недоступен до запроса

- **GIVEN** у User ровно две действующие Session S1 и S2
- **AND** PostgreSQL недоступен уже до запроса и не принимает команду удаления Session
- **WHEN** клиент отправляет `POST /api/auth/logout` с cookie S1
- **THEN** API отвечает `503 Service Unavailable` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: SERVICE_UNAVAILABLE`, `status: 503`, `instance: /api/auth/logout`
- **AND** ответ не содержит `Set-Cookie` для `wishlist_session`

### Requirement: Отказ logout при внутреннем техническом отказе

При внутреннем техническом отказе во время `POST /api/auth/logout` API SHALL отвечать `500 Internal Server Error` по
контракту `api-errors`, без заголовка `Set-Cookie` для `wishlist_session`.

#### Scenario: Необратимая ошибка удаления

- **GIVEN** cookie `wishlist_session` имеет корректный формат
- **AND** операция удаления завершается необратимой ошибкой PostgreSQL
- **WHEN** клиент отправляет `POST /api/auth/logout` с этой cookie
- **THEN** API отвечает `500 Internal Server Error` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: INTERNAL_ERROR`, `status: 500`, `instance: /api/auth/logout`
- **AND** ответ не содержит `Set-Cookie` для `wishlist_session`

#### Scenario: Непредвиденное исключение

- **GIVEN** cookie `wishlist_session` имеет корректный формат
- **AND** обработка logout завершается непредвиденным исключением
- **WHEN** клиент отправляет `POST /api/auth/logout` с этой cookie
- **THEN** API отвечает `500 Internal Server Error` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: INTERNAL_ERROR`, `status: 500`, `instance: /api/auth/logout`
- **AND** ответ не содержит `Set-Cookie` для `wishlist_session`
