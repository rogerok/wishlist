## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Обязательный Display Name при signup

API SHALL отклонять `POST /api/auth/signup`, если `displayName` отсутствует, после удаления пробелов по краям пуст или
длиннее 100 символов, ответом `400 Bad Request` с `code: REQUEST_VALIDATION_FAILED` и без создания User.

#### Scenario: Display Name из одних пробелов

- **GIVEN** User с email "example@email.com" незарегистрирован
- **WHEN** клиент отправляет `POST /api/auth/signup` с почтой "example@email.com", валидным password, совпадающим с
  passwordConfirm, и `displayName: "   "`
- **THEN** API отвечает `400 Bad Request` с `code: REQUEST_VALIDATION_FAILED`
- **AND** User не создан
