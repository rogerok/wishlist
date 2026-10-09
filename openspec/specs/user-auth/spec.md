# user-auth Specification

## Purpose

Дает возможность зарегистрироваться пользователю как User, идентифицировать себя с Password Credential,
и пользоваться ограниченной во времени Session

## Requirements

### Requirement: Signup

Когда `POST /api/auth/signup` получает валидный запрос, API SHALL создать User, его Password Credential и одну Session
и отвечать созданным User вместе с cookie `wishlist_session`.

#### Scenario: Успешный signup

- **GIVEN** - User с email "example@email.com" незарегистрирован
- **WHEN** - клиент отправляет запрос `POST /api/auth/signup` с почтой,
  валидным password, совпадающим с password passwordConfirm, и непустым `displayName`
- **THEN** - API отвечает `201 Created`
- **AND** - тело ответа содержит `id`, `email`, `displayName` созданного User
- **AND** - ни ответ, ни логи не содержат Session token

#### Scenario: Session cookie атрибуты

- **GIVEN** - НЕ в продакшене
- **WHEN** - успешный signup
- **THEN** - ответ выставляет ровно одну cookie `wishlist_session`
- **AND** - cookie содержит `HttpOnly`, `SameSite=Lax`, `Path=/api`, `Max-Age=604800` без `Secure`

#### Scenario: Secure cookie в продакшене

- **GIVEN** - API запущен в продакшене
- **WHEN** - успешный signup
- **THEN** - `wishlist_session` cookie содержит также `Secure`

#### Scenario: User с данным email уже существует

- **GIVEN** - User с email "example@email.com" зарегистрирован
- **WHEN** - клиент отправляет запрос `POST /api/auth/signup` с почтой "example@email.com",
  валидным password, совпадающим с password passwordConfirm, и непустым `displayName`
- **THEN** - API отвечает `409 Conflict`
- **AND** - тело ответа содержит Problem Details для `USER_EMAIL_ALREADY_EXISTS`
- **AND** - User не создан второй раз
- **AND** - В ответе нет заголовка `Set-Cookie` с `wishlist_session`

#### Scenario: password не совпадает с passwordConfirm

- **GIVEN** - User с email "example@email.com" незарегистрирован
- **WHEN** - клиент отправляет запрос `POST /api/auth/signup` с почтой "example@email.com",
  валидным password, несовпадающим с password passwordConfirm, и непустым `displayName`
- **THEN** - API отвечает `400 Bad Request`
- **AND** - тело ответа содержит Problem Details для `REQUEST_VALIDATION_FAILED`
- **AND** - User не создан
- **AND** - В ответе нет заголовка `Set-Cookie` с `wishlist_session`

### Requirement: Успешный вход

При верных email и пароле API SHALL отвечать на `POST /api/auth/login` кодом `200 OK`, создавая новую действующую
Session существующего User и возвращая поля `id`, `email`, `displayName` этого User
и новую cookie `wishlist_session`, не отзывая и не изменяя ранее выданные Session этого User.

#### Scenario: Успешный вход

- **GIVEN** User зарегистрирован через signup, и клиент знает его email и правильный пароль
- **WHEN** клиент отправляет `POST /api/auth/login` с этим email и паролем
- **THEN** API отвечает `200 OK`
- **AND** тело ответа содержит `id`, `email`, `displayName` того же User и полностью совпадает с
  телом ответа signup
- **AND** API создаёт новую действующую Session этого User
- **AND** ответ выставляет новую cookie `wishlist_session`, значение которой отличается от cookie signup
- **AND** ни пароль, ни значение новой cookie не присутствуют в теле ответа

#### Scenario: Повторный вход сохраняет предыдущие Session

- **GIVEN** после signup у User была ровно одна действующая Session
- **AND** первый успешный вход с cookie signup завершился ответом `200 OK`,
  созданием второй действующей Session и выдачей новой cookie `wishlist_session`
- **AND** перед повторным входом у User ровно две действующие Session:
  от signup и первого входа
- **WHEN** клиент отправляет `POST /api/auth/login` с правильными email
  и паролем и cookie первого входа
- **THEN** API отвечает `200 OK`
- **AND** API создаёт новую действующую Session того же User
  и выдаёт новую cookie `wishlist_session`
- **AND** значения cookie signup, первого и повторного входа различаются
- **AND** Session от signup и первого входа остаются действующими
  и не изменяются
- **AND** User имеет ровно три одновременные действующие Session

#### Scenario: Атрибуты cookie в production

- **GIVEN** API запущен в production, и User зарегистрирован
- **WHEN** клиент отправляет `POST /api/auth/login` с правильными email и паролем
- **THEN** API отвечает `200 OK` и выставляет cookie `wishlist_session`
- **AND** cookie содержит атрибуты `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api`, `Max-Age=604800`

### Requirement: Неразличимый отказ при входе — защита от перебора email (enumeration)

При неизвестном email или неверном пароле существующего User API SHALL возвращать на `POST /api/auth/login`
ответы с одинаковым HTTP-статусом `401 Unauthorized`, типом содержимого `application/problem+json`
и полностью совпадающими телами, содержащими `code: AUTH_INVALID_CREDENTIALS`, `status: 401`,
`instance: /api/auth/login`, без заголовка `Set-Cookie`.

#### Scenario: Неизвестный email

- **GIVEN** User с указанным email не зарегистрирован
- **WHEN** клиент отправляет `POST /api/auth/login` с этим email и паролем, допустимыми для тела запроса
- **THEN** API отвечает `401 Unauthorized` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: AUTH_INVALID_CREDENTIALS`, `status: 401`, `instance: /api/auth/login`
- **AND** тело ответа полностью совпадает с ответом на неверный пароль существующего User
- **AND** ответ не содержит заголовка `Set-Cookie`

#### Scenario: Неверный пароль без раскрытия существования User — защита от перебора email (enumeration)

- **GIVEN** User с указанным email зарегистрирован
- **WHEN** клиент отправляет `POST /api/auth/login` с этим email и неверным паролем, допустимыми для тела запроса
- **THEN** API отвечает `401 Unauthorized` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: AUTH_INVALID_CREDENTIALS`, `status: 401`, `instance: /api/auth/login`
- **AND** тело ответа полностью совпадает с ответом на неизвестный email
- **AND** ответ не содержит заголовка `Set-Cookie`

### Requirement: Проверка пароля при неизвестном email

Когда на `POST /api/auth/login` приходит email, для которого нет User или нет его Password Credential, API SHALL
выполнить одну проверку пароля той же стоимости, что и для зарегистрированного User, прежде чем ответить
`401 Unauthorized` с `code: AUTH_INVALID_CREDENTIALS`. Так время ответа не показывает, зарегистрирован ли email.

#### Scenario: Неизвестный email

- **GIVEN** User с указанным email не зарегистрирован
- **WHEN** клиент отправляет `POST /api/auth/login` с этим email и паролем, допустимыми для тела запроса
- **THEN** API выполняет ровно одну проверку пароля
- **AND** API отвечает `401 Unauthorized` с `code: AUTH_INVALID_CREDENTIALS`

#### Scenario: User без Password Credential

- **GIVEN** User с указанным email зарегистрирован, и его Password Credential удалён из БД
- **WHEN** клиент отправляет `POST /api/auth/login` с этим email и паролем, допустимыми для тела запроса
- **THEN** API выполняет ровно одну проверку пароля
- **AND** API отвечает `401 Unauthorized` с `code: AUTH_INVALID_CREDENTIALS`

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

### Requirement: Обязательный Display Name при signup

API SHALL отклонять `POST /api/auth/signup`, если `displayName` отсутствует, после удаления пробелов по краям пуст или
длиннее 100 символов, ответом `400 Bad Request` с `code: REQUEST_VALIDATION_FAILED` и без создания User.

#### Scenario: Display Name из одних пробелов

- **GIVEN** User с email "example@email.com" незарегистрирован
- **WHEN** клиент отправляет `POST /api/auth/signup` с почтой "example@email.com", валидным password, совпадающим с
  passwordConfirm, и `displayName: "   "`
- **THEN** API отвечает `400 Bad Request` с `code: REQUEST_VALIDATION_FAILED`
- **AND** User не создан
