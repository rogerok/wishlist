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
