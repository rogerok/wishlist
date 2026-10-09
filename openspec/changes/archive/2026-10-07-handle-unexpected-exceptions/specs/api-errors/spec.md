# Spec Delta

## MODIFIED Requirements

### Requirement: Ответ на внутренний технический отказ

Если обработка запроса завершилась внутренним техническим отказом, который повтор запроса не исправит, API SHALL
отвечать `500 Internal Server Error` с типом содержимого `application/problem+json` и телом, содержащим
`code: INTERNAL_ERROR`, `status: 500` и `instance`, равный пути запроса.

#### Scenario: Необратимая ошибка базы данных при signup

- **GIVEN** база данных отвечает на запросы signup необратимой ошибкой
- **WHEN** клиент отправляет `POST /api/auth/signup` с валидным телом
- **THEN** API отвечает `500 Internal Server Error` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: INTERNAL_ERROR`, `status: 500`, `instance: /api/auth/signup`

#### Scenario: Непредвиденное исключение при signup

- **GIVEN** обработка signup завершается непредвиденным исключением
- **WHEN** клиент отправляет `POST /api/auth/signup` с валидным телом
- **THEN** API отвечает `500 Internal Server Error` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: INTERNAL_ERROR`, `status: 500`, `instance: /api/auth/signup`

### Requirement: Нераскрытие причины технического отказа

API SHALL формировать тело ответа на технический отказ без текста и значений исходной ошибки.

#### Scenario: Текст исходной ошибки содержит email

- **GIVEN** обработка signup завершается неизвестной ошибкой с текстом `sensitive@mail.com`
- **WHEN** клиент отправляет `POST /api/auth/signup` с валидным телом
- **THEN** API отвечает `500 Internal Server Error`
- **AND** тело ответа не содержит `sensitive@mail.com`

#### Scenario: Текст непредвиденного исключения содержит email

- **GIVEN** обработка signup завершается непредвиденным исключением с текстом `sensitive@mail.com`
- **WHEN** клиент отправляет `POST /api/auth/signup` с валидным телом
- **THEN** API отвечает `500 Internal Server Error`
- **AND** тело ответа не содержит `sensitive@mail.com`
