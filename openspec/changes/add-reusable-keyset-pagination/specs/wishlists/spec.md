# Spec Delta

Список своих Wishlist следует общему контракту `api-pagination`. Ниже — только то, что принадлежит Wishlist: какие
Wishlist входят в список, какие у него сортировки и их порядок. Upcoming и Past Occasion Date определены в
[CONTEXT.md](../../../../../CONTEXT.md).

## ADDED Requirements

### Requirement: Список содержит только свои Wishlist

При действующей Session `GET /api/wishlists` SHALL выдавать в `items` все Wishlist User этой Session — Private и
Public — и ни одного Wishlist другого User.

#### Scenario: Свои Wishlist обеих visibility

- **GIVEN** у A действует Session; PostgreSQL доступен
- **AND** A владеет ровно 1 Private Wishlist WA1 и ровно 1 Public Wishlist WA2
- **AND** другой User B владеет ровно 1 Private Wishlist и ровно 1 Public Wishlist
- **WHEN** A отправляет `GET /api/wishlists`
- **THEN** `items` содержит ровно 2 элемента: WA1 и WA2

### Requirement: Представление элемента списка

Каждый элемент `items` в ответе `GET /api/wishlists` SHALL содержать ровно 8 полей Wishlist — `id`, `ownerId`,
`title`, `description`, `occasionDate`, `visibility`, `createdAt`, `updatedAt` — с timestamps строками ISO 8601.

#### Scenario: Элемент совпадает с записью

- **GIVEN** у A действует Session; PostgreSQL доступен
- **AND** A владеет ровно 1 Wishlist W с `title: "Books"`, `description: "Art"`, `occasionDate: "2028-02-29"`,
  `visibility: "public"`
- **WHEN** A отправляет `GET /api/wishlists`
- **THEN** `items` содержит ровно 1 элемент из 8 полей с `id` и `ownerId` записи W, `title: "Books"`,
  `description: "Art"`, `occasionDate: "2028-02-29"`, `visibility: "public"`
- **AND** `createdAt` и `updatedAt` элемента являются строками ISO 8601, соответствующими записи W

### Requirement: Сортировка createdAt

`GET /api/wishlists` без `sort` и с `sort=createdAt` SHALL упорядочивать Wishlist от более позднего `createdAt` к более
раннему, а при равном `createdAt` — по `id` по убыванию.

#### Scenario: Разные createdAt

- **GIVEN** у A действует Session; PostgreSQL доступен
- **AND** A владеет ровно 3 Wishlist: W1 с `createdAt` 2026-10-01T10:00:00.000Z, W2 с 2026-10-02T10:00:00.000Z, W3 с
  2026-10-03T10:00:00.000Z
- **WHEN** A отправляет `GET /api/wishlists` без `sort` либо с `sort=createdAt`
- **THEN** `items` содержит ровно W3, W2, W1 в этом порядке

#### Scenario: Равные createdAt

- **GIVEN** у A действует Session; PostgreSQL доступен
- **AND** A владеет ровно 2 Wishlist с `createdAt` 2026-10-01T10:00:00.000Z: WL с меньшим `id` и WH с большим `id`
- **WHEN** A отправляет `GET /api/wishlists`
- **THEN** `items` содержит ровно WH, WL в этом порядке

### Requirement: Сортировка occasionDate

`GET /api/wishlists?sort=occasionDate` SHALL выдавать сначала Wishlist с Upcoming Occasion Date от ближайшей даты к
дальней, затем с Past Occasion Date от недавней к давней, затем без Occasion Date; при равной Occasion Date либо её
отсутствии — по `id` по возрастанию.

#### Scenario: Все три группы

- **GIVEN** у A действует Session; Clock фиксирует `2026-10-18T12:00:00Z`; PostgreSQL доступен
- **AND** A владеет ровно 7 Wishlist, вставленными прямым SQL: U1 с Occasion Date `2026-10-18`, U2 с `2026-12-31`,
  P1 с `2026-10-17`, P2 с `2026-05-01`, UL и UH с `2027-01-15`, где `id` UL меньше `id` UH, и N без Occasion Date
- **WHEN** A отправляет `GET /api/wishlists?sort=occasionDate`
- **THEN** `items` содержит ровно U1, U2, UL, UH, P1, P2, N в этом порядке

#### Scenario: Несколько Wishlist без Occasion Date

- **GIVEN** у A действует Session; Clock фиксирует `2026-10-18T12:00:00Z`; PostgreSQL доступен
- **AND** A владеет ровно 3 Wishlist: P с Occasion Date `2026-09-01`, вставленный прямым SQL, а также NL и NH без
  Occasion Date, где `id` NL меньше `id` NH
- **WHEN** A отправляет `GET /api/wishlists?sort=occasionDate`
- **THEN** `items` содержит ровно P, NL, NH в этом порядке

### Requirement: Граница сегодня по UTC

Сортировка `occasionDate` SHALL делить Wishlist на Upcoming и Past Occasion Date по текущей календарной дате в UTC.

#### Scenario: В Москве уже завтра

- **GIVEN** у A действует Session; Clock фиксирует `2026-10-18T23:30:00Z`; PostgreSQL доступен
- **AND** A владеет ровно 2 Wishlist: T с Occasion Date `2026-10-18` и F с `2026-10-25`
- **WHEN** A отправляет `GET /api/wishlists?sort=occasionDate`
- **THEN** `items` содержит ровно T, F в этом порядке

### Requirement: Граница сегодня фиксируется на первой странице

Продолжение обхода `sort=occasionDate` по курсору SHALL делить Wishlist на Upcoming и Past Occasion Date по дате UTC
в момент запроса первой страницы этого обхода.

#### Scenario: Полночь посреди обхода

- **GIVEN** у A действует Session; PostgreSQL доступен
- **AND** A владеет ровно 3 Wishlist: X с Occasion Date `2026-10-18`, Y с `2026-12-31` и P с `2026-09-01`,
  вставленным прямым SQL
- **AND** при Clock `2026-10-18T23:59:00Z` ответ на `GET /api/wishlists?sort=occasionDate&limit=1` содержал `items`
  X и `nextCursor` C
- **AND** затем Clock переведён на `2026-10-19T00:01:00Z`
- **WHEN** A отправляет `GET /api/wishlists?sort=occasionDate&limit=2&cursor=C`
- **THEN** `items` содержит ровно Y, P в этом порядке, а `nextCursor` равен `null`

### Requirement: Session обязательна для списка Wishlist

API SHALL отвечать 401 problem+json с `code: AUTH_INVALID_SESSION` и `instance: /api/wishlists` на `GET
/api/wishlists` без действующей Session, в том числе при невалидных query-параметрах.

#### Scenario: Список без действующей Session

- **GIVEN** PostgreSQL доступен; cookie `wishlist_session` отсутствует, повреждена, не соответствует Session либо
  соответствует истекшей Session
- **WHEN** клиент отправляет `GET /api/wishlists?limit=5`
- **THEN** ответ имеет статус 401, тип `application/problem+json`, `code: AUTH_INVALID_SESSION`,
  `instance: /api/wishlists`

#### Scenario: Невалидный query без действующей Session

- **GIVEN** PostgreSQL доступен; cookie `wishlist_session` отсутствует
- **WHEN** клиент отправляет `GET /api/wishlists?limit=0` либо `GET /api/wishlists?srot=x`
- **THEN** ответ имеет статус 401, тип `application/problem+json`, `code: AUTH_INVALID_SESSION`,
  `instance: /api/wishlists`

### Requirement: Технические отказы списка Wishlist

API SHALL отвечать на технические отказы `GET /api/wishlists` по существующему контракту `api-errors`.

#### Scenario: Временный отказ чтения списка

- **GIVEN** у A действует Session; аутентификация завершается успешно; persistence списка отказывает временно
- **WHEN** A отправляет `GET /api/wishlists`
- **THEN** API отвечает 503 problem+json по `api-errors`, с `instance: /api/wishlists`

#### Scenario: Повреждённая строка в списке

- **GIVEN** у A действует Session; аутентификация завершается успешно; в отдельной тестовой БД снят CHECK непустого
  title, и A владеет Wishlist W с `title: " "`
- **WHEN** A отправляет `GET /api/wishlists`
- **THEN** API отвечает 500 problem+json по `api-errors`, с `instance: /api/wishlists`
