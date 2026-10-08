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
  валидным password, совпадающим с password passwordConfirm, поля с именем опциональны - могут быть `null`
- **THEN** - API отвечает `201 Created`
- **AND** - тело ответа содержит `id`, `email`, `firstName`, `lastName`, `middleName` созданного User
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
  валидным password, совпадающим с password passwordConfirm, поля с именем опциональны - могут быть `null`
- **THEN** - API отвечает `409 Conflict`
- **AND** - тело ответа содержит Problem Details для `USER_EMAIL_ALREADY_EXISTS`
- **AND** - User не создан второй раз
- **AND** - В ответе нет заголовка `Set-Cookie` с `wishlist_session`

#### Scenario: password не совпадает с passwordConfirm

- **GIVEN** - User с email "example@email.com" незарегистрирован
- **WHEN** - клиент отправляет запрос `POST /api/auth/signup` с почтой "example@email.com",
  валидным password, несовпадающим с password passwordConfirm, поля с именем опциональны - могут быть `null`
- **THEN** - API отвечает `400 Bad Request`
- **AND** - тело ответа содержит Problem Details для `REQUEST_VALIDATION_FAILED`
- **AND** - User не создан
- **AND** - В ответе нет заголовка `Set-Cookie` с `wishlist_session`

### Requirement: Успешный вход

При верных email и пароле API SHALL отвечать на `POST /api/auth/login` кодом `200 OK`, создавая новую действующую
Session существующего User и возвращая поля `id`, `email`, `firstName`, `lastName`, `middleName` этого User
и новую cookie `wishlist_session`, не отзывая и не изменяя ранее выданные Session этого User.

#### Scenario: Успешный вход

- **GIVEN** User зарегистрирован через signup, и клиент знает его email и правильный пароль
- **WHEN** клиент отправляет `POST /api/auth/login` с этим email и паролем
- **THEN** API отвечает `200 OK`
- **AND** тело ответа содержит `id`, `email`, `firstName`, `lastName`, `middleName` того же User и полностью совпадает с
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
