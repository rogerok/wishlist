# Spec Delta

## Purpose

Определяет общий контракт постраничных списков API: как клиент выбирает размер страницы и сортировку, как получает
следующую страницу по курсору и как API отклоняет неверные query-параметры
([ADR-0008](../../../../../docs/adr/0008-keyset-pagination-with-opaque-cursor.md)).

Сценарии проверяют контракт на `GET /api/wishlists`; порядок «по умолчанию» в них — сортировка `createdAt` из
спецификации `wishlists`. Во всех сценариях PostgreSQL доступен, а у User A действует Session.

## ADDED Requirements

### Requirement: Форма ответа списка

Постраничный список API SHALL отвечать 200 с JSON ровно из двух полей: массива `items` и `nextCursor` — строки либо
`null`.

#### Scenario: Пустой список

- **GIVEN** A владеет ровно 0 Wishlist
- **WHEN** A отправляет `GET /api/wishlists`
- **THEN** ответ имеет статус 200 и тело точно равно `{ "items": [], "nextCursor": null }`

### Requirement: Размер страницы по умолчанию

Постраничный список API SHALL возвращать не больше 20 элементов, если запрос не содержит `limit`.

#### Scenario: Список длиннее страницы по умолчанию

- **GIVEN** A владеет ровно 21 Wishlist
- **WHEN** A отправляет `GET /api/wishlists`
- **THEN** ответ имеет статус 200, а `items` содержит ровно 20 элементов

### Requirement: Явный размер страницы

Постраничный список API SHALL возвращать не больше `limit` элементов для целого `limit` от 1 до 100 включительно.

#### Scenario: Нижняя граница limit

- **GIVEN** A владеет ровно 2 Wishlist
- **WHEN** A отправляет `GET /api/wishlists?limit=1`
- **THEN** ответ имеет статус 200, а `items` содержит ровно 1 элемент

#### Scenario: Верхняя граница limit

- **GIVEN** A владеет ровно 101 Wishlist
- **WHEN** A отправляет `GET /api/wishlists?limit=100`
- **THEN** ответ имеет статус 200, а `items` содержит ровно 100 элементов

### Requirement: Отклонение limit вне диапазона

Постраничный список API SHALL отклонять `limit`, который не записан десятичными цифрами без знака, пробелов и ведущих
нулей как целое от 1 до 100, ответом 400 problem+json с `code: REQUEST_VALIDATION_FAILED` и записью `errors` с
`location: "query"`, `path: ["limit"]`.

#### Scenario: Невалидный limit

- **GIVEN** A владеет ровно 1 Wishlist
- **WHEN** A отправляет `GET /api/wishlists` с `limit`, равным `0`, `101`, `-1`, `+5`, `05`, `1.5`, `1e1`, `0x10`,
  `%205` (пробел перед `5`), `abc` либо пустой строке
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`,
  `instance: /api/wishlists`
- **AND** `errors` содержит запись с `location: "query"` и `path: ["limit"]`

#### Scenario: Повторённый limit

- **GIVEN** A владеет ровно 1 Wishlist
- **WHEN** A отправляет `GET /api/wishlists?limit=1&limit=2`
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`
- **AND** `errors` содержит запись с `location: "query"`

### Requirement: Признак последней страницы

Постраничный список API SHALL возвращать `nextCursor: null` тогда и только тогда, когда после последнего выданного
элемента в порядке выбранной сортировки элементов нет.

#### Scenario: Элементов ровно на одну страницу

- **GIVEN** A владеет ровно 2 Wishlist
- **WHEN** A отправляет `GET /api/wishlists?limit=2`
- **THEN** `items` содержит ровно 2 элемента, а `nextCursor` равен `null`

#### Scenario: Элементов на один больше страницы

- **GIVEN** A владеет ровно 3 Wishlist
- **WHEN** A отправляет `GET /api/wishlists?limit=2`
- **THEN** `items` содержит ровно 2 элемента, а `nextCursor` является непустой строкой

### Requirement: Продолжение по курсору

Запрос постраничного списка с `cursor` из предыдущего ответа SHALL возвращать элементы, следующие в порядке
сортировки строго после последнего элемента страницы, выдавшей этот курсор.

#### Scenario: Вторая страница

- **GIVEN** A владеет ровно 3 Wishlist: W1, W2, W3 в порядке по умолчанию
- **AND** ответ на `GET /api/wishlists?limit=2` содержит `items` W1, W2 и `nextCursor` C
- **WHEN** A отправляет `GET /api/wishlists?limit=2&cursor=C`
- **THEN** `items` содержит ровно W3, а `nextCursor` равен `null`

#### Scenario: Другой limit на следующей странице

- **GIVEN** A владеет ровно 4 Wishlist: W1, W2, W3, W4 в порядке по умолчанию
- **AND** ответ на `GET /api/wishlists?limit=1` содержит `items` W1 и `nextCursor` C
- **WHEN** A отправляет `GET /api/wishlists?limit=3&cursor=C`
- **THEN** `items` содержит ровно W2, W3, W4 в этом порядке

### Requirement: Полный обход без пропусков и повторов

Последовательный обход всех страниц постраничного списка по курсорам SHALL выдать каждый элемент списка ровно один
раз и в порядке выбранной сортировки, включая элементы с равными значениями сортировки.

#### Scenario: Равные значения сортировки на границе страниц

- **GIVEN** A владеет ровно 5 Wishlist с одинаковым `createdAt`
- **WHEN** A проходит `GET /api/wishlists?limit=2`, передавая каждый полученный `nextCursor`, пока он не равен `null`
- **THEN** A получает ровно 3 страницы
- **AND** объединение их `items` содержит ровно 5 различных Wishlist A в порядке по умолчанию

### Requirement: Курсор после удаления элемента

Курсор постраничного списка SHALL оставаться действительным после удаления элемента, которым закончилась выдавшая его
страница.

#### Scenario: Удалён последний элемент первой страницы

- **GIVEN** A владел ровно 3 Wishlist: W1, W2, W3 в порядке по умолчанию
- **AND** ответ на `GET /api/wishlists?limit=2` содержал `items` W1, W2 и `nextCursor` C
- **AND** затем W2 удалён прямым SQL
- **WHEN** A отправляет `GET /api/wishlists?limit=2&cursor=C`
- **THEN** ответ имеет статус 200, `items` содержит ровно W3, а `nextCursor` равен `null`

### Requirement: Отклонение неразбираемого курсора

Постраничный список API SHALL отклонять `cursor`, который не разбирается как курсор этого списка или содержит значение
вне допустимого для его поля, ответом 400 problem+json с `code: REQUEST_VALIDATION_FAILED` и записью `errors` с
`location: "query"`.

#### Scenario: Битый курсор

- **GIVEN** A владеет ровно 1 Wishlist
- **WHEN** A отправляет `GET /api/wishlists` с `cursor`, равным пустой строке, `not-base64!`, base64url от
  `not json`, base64url от `{}` либо base64url от `{"sort":"createdAt"}`
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`,
  `instance: /api/wishlists`
- **AND** `errors` содержит запись с `location: "query"`

#### Scenario: Курсор правильной формы с недопустимым значением

- **GIVEN** A владеет ровно 1 Wishlist
- **WHEN** A отправляет `GET /api/wishlists` либо `GET /api/wishlists?sort=occasionDate` с `cursor`, равным base64url
  от JSON курсора соответствующей сортировки, где ровно одно поле недопустимо: `id: "x"`;
  `createdAt: "2026-02-30T00:00:00.000Z"`; `createdAt: "0000-01-01T00:00:00.000Z"`; `createdAt: "2026-10-01"`;
  `asOf: "2026-02-30"`; `asOf: "0000-01-01"`; `occasionDate: "0000-01-01"` либо `occasionDate: "2026-1-5"`
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`,
  `instance: /api/wishlists`
- **AND** `errors` содержит запись с `location: "query"`

### Requirement: Отклонение курсора другой сортировки

Постраничный список API SHALL отклонять `cursor`, выданный для сортировки, отличной от выбранной в запросе, ответом 400
problem+json с `code: REQUEST_VALIDATION_FAILED` и записью `errors` с `location: "query"`, `path: ["cursor"]`.

#### Scenario: Курсор occasionDate с явной сортировкой createdAt

- **GIVEN** A владеет ровно 2 Wishlist
- **AND** ответ на `GET /api/wishlists?sort=occasionDate&limit=1` содержит `nextCursor` C
- **WHEN** A отправляет `GET /api/wishlists?sort=createdAt&cursor=C`
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`
- **AND** `errors` содержит запись с `location: "query"` и `path: ["cursor"]`

#### Scenario: Курсор occasionDate без sort

- **GIVEN** A владеет ровно 2 Wishlist
- **AND** ответ на `GET /api/wishlists?sort=occasionDate&limit=1` содержит `nextCursor` C
- **WHEN** A отправляет `GET /api/wishlists?cursor=C`
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`
- **AND** `errors` содержит запись с `location: "query"` и `path: ["cursor"]`

### Requirement: Отклонение неизвестной сортировки

Постраничный список API SHALL отклонять `sort` вне набора сортировок этого списка ответом 400 problem+json с
`code: REQUEST_VALIDATION_FAILED` и записью `errors` с `location: "query"`, `path: ["sort"]`.

#### Scenario: Сортировка, которой нет у списка

- **GIVEN** A владеет ровно 1 Wishlist
- **WHEN** A отправляет `GET /api/wishlists` с `sort`, равным `title`, `CREATEDAT`, `created_at` либо пустой строке
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`
- **AND** `errors` содержит запись с `location: "query"` и `path: ["sort"]`

### Requirement: Отклонение неизвестного query-параметра

Маршрут API, объявляющий query-параметры, SHALL отклонять запрос с query-параметром вне своего контракта ответом 400
problem+json с `code: REQUEST_VALIDATION_FAILED` и записью `errors` с `location: "query"` и путём этого параметра.

#### Scenario: Опечатка в имени параметра

- **GIVEN** A владеет ровно 1 Wishlist
- **WHEN** A отправляет `GET /api/wishlists?srot=occasionDate`
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`
- **AND** `errors` содержит запись с `location: "query"` и `path: ["srot"]`
