# user-auth Specification

## Purpose

Дает возможность зарегистрироваться пользователю как User, идентифицировать себя с Password Credential,
и пользоваться ограниченной во времени сессией

## Requirements

### Requirements: Signup

Когда `POST /api/auth/signup` получает валидный запрос, API SHALL создать User, Password, Credential, Session.
Ответить созданным User и Session куки.

#### Scenario: Успешный signup

- **GIVEN** - User с email "example@email.com" незарегистрирован
- **WHEN** - пользователь отправляет запрос `POST /api/auth/signup` с почтой,
  валидным password, совпадающим с password passwordConfirm, поля с именем опциональны - могут быть `null`
- **THEN** - API отвечает `201 Created`
- **AND** - тело ответа содержит `id`, `email`, `firstName`, `lastName`, `secondName` созданного User
- **AND** - ни ответ, ни логи не содержат credentials - password, Session

#### Scenario:User с данным email уже существует

- **GIVEN** - User с email "example@email.com" зарегистрирован
- **WHEN** - пользователь отправляет запрос `POST /api/auth/signup` с почтой "example@email.com",
  валидным password, совпадающим с password passwordConfirm, поля с именем опциональны - могут быть `null`
- **THEN** - API отвечает `409 Conflict`
- **AND** - тело ответа содержит Problem Details созданного User
- **AND** - ни ответ, ни логи не содержат credentials - password, Session
