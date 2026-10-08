# api-errors Specification

## Purpose

Определяет, как API отвечает клиенту, когда запрос не удалось обработать из-за технического отказа на стороне сервера,
и как такой ответ связывается с диагностикой на сервере.

## Requirements

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

### Requirement: Ответ на временную недоступность

Если обработка запроса завершилась временной недоступностью ресурса, после которой повтор запроса может пройти, API
SHALL отвечать `503 Service Unavailable` с типом содержимого `application/problem+json` и телом, содержащим
`code: SERVICE_UNAVAILABLE`, `status: 503` и `instance`, равный пути запроса.

#### Scenario: Перегрузка расчёта хеша пароля при signup

- **GIVEN** все слоты расчёта хеша пароля заняты
- **WHEN** клиент отправляет `POST /api/auth/signup` с валидным телом
- **THEN** API отвечает `503 Service Unavailable` с типом содержимого `application/problem+json`
- **AND** тело ответа содержит `code: SERVICE_UNAVAILABLE`, `status: 503`, `instance: /api/auth/signup`

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

### Requirement: Идентификатор ошибки в ответе на технический отказ

В теле ответа на технический отказ API SHALL возвращать поле `errorId` из 32 шестнадцатеричных символов в нижнем
регистре, которое сервер генерирует для этого отказа независимо от заголовков запроса.

#### Scenario: Запрос без заголовков трассировки

- **GIVEN** все слоты расчёта хеша пароля заняты
- **WHEN** клиент отправляет `POST /api/auth/signup` с валидным телом без заголовков `traceparent`, `b3` и `x-b3-traceid`
- **THEN** API отвечает `503 Service Unavailable`
- **AND** тело ответа содержит `errorId` из 32 шестнадцатеричных символов в нижнем регистре

#### Scenario: Заголовок traceparent не влияет на errorId

- **GIVEN** база данных отвечает на запросы signup необратимой ошибкой
- **WHEN** клиент отправляет `POST /api/auth/signup` с валидным телом и заголовком
  `traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01`
- **THEN** API отвечает `500 Internal Server Error`
- **AND** тело ответа содержит `errorId` из 32 шестнадцатеричных символов в нижнем регистре
- **AND** тело ответа не содержит `0af7651916cd43dd8448eb211c80319c`

#### Scenario: Заголовок x-b3-traceid не попадает в ответ

- **GIVEN** база данных отвечает на запросы signup необратимой ошибкой
- **WHEN** клиент отправляет `POST /api/auth/signup` с валидным телом и заголовками `x-b3-traceid: forged-by-client`,
  `x-b3-spanid: x`
- **THEN** API отвечает `500 Internal Server Error`
- **AND** тело ответа содержит `errorId` из 32 шестнадцатеричных символов в нижнем регистре
- **AND** тело ответа не содержит `forged-by-client`
