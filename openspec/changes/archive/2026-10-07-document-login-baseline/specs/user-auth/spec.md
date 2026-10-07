# Spec Delta

## ADDED Requirements

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
