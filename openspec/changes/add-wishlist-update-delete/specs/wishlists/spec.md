## ADDED Requirements

### Requirement: Изменение своего Wishlist

При действующей Session успешный `PUT /api/wishlists/:id` владельца SHALL заменять `title`, `description`,
`occasionDate` и `visibility` Wishlist нормализованными значениями тела, сохраняя его `id`, `ownerId` и `createdAt` и не
изменяя другие Wishlist.

#### Scenario: Владелец меняет все поля

- **GIVEN** у A действует Session; Clock фиксирует `2026-11-12T12:00:00Z`; PostgreSQL доступен
- **AND** A владеет ровно 1 Wishlist W с `title: "Books"`, `description: null`, `occasionDate: null`,
  `visibility: "private"`; других Wishlist нет
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "  Gifts  ", "description": "  Art  ", "occasionDate": "2027-01-15", "visibility": "public" }`
- **THEN** в БД ровно 1 Wishlist: W с прежними `id`, `ownerId` и `createdAt`
- **AND** его поля равны `title: "Gifts"`, `description: "Art"`, `occasionDate: "2027-01-15"`,
  `visibility: "public"`

#### Scenario: Public становится Private

- **GIVEN** у A действует Session; PostgreSQL доступен; A владеет Public Wishlist W с `title: "Books"`,
  `description: null`, `occasionDate: null`
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Books", "description": null, "occasionDate": null, "visibility": "private" }`
- **THEN** W имеет `visibility: "private"`

#### Scenario: Другие Wishlist не меняются

- **GIVEN** у A действует Session; PostgreSQL доступен
- **AND** A владеет ровно 2 Wishlist: W и V с известными полями; B владеет ровно 1 Wishlist U с известными полями;
  других Wishlist нет
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Gifts", "description": null, "occasionDate": null, "visibility": "private" }`
- **THEN** в БД ровно 3 Wishlist
- **AND** все поля V и U остаются прежними

### Requirement: Представление изменённого Wishlist

Успешный `PUT /api/wishlists/:id` SHALL отвечать 200 с JSON сохранённого Wishlist, содержащим только 8 полей: `id`,
`ownerId`, `title`, `description`, `occasionDate`, `visibility`, `createdAt`, `updatedAt`; timestamps представлены
строками ISO 8601.

#### Scenario: Ответ PUT соответствует записи

- **GIVEN** у A действует Session; Clock фиксирует `2026-11-12T12:00:00Z`; PostgreSQL доступен; A владеет Wishlist W
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Gifts", "description": "Art", "occasionDate": "2027-01-15", "visibility": "public" }`
- **THEN** API отвечает 200 с JSON ровно из перечисленных полей W после изменения
- **AND** JSON содержит `id` W, `ownerId` A, `title: "Gifts"`, `description: "Art"`, `occasionDate: "2027-01-15"`,
  `visibility: "public"`
- **AND** `createdAt` и `updatedAt` являются строками ISO 8601, соответствующими записи W

### Requirement: Время изменения

Успешный `PUT /api/wishlists/:id` SHALL записывать в `updatedAt` время начала транзакции PostgreSQL, оставляя
`createdAt` прежним.

#### Scenario: updatedAt сдвигается, createdAt нет

- **GIVEN** у A действует Session; PostgreSQL доступен
- **AND** A владеет Wishlist W, вставленным прямым SQL с `createdAt` и `updatedAt`, равными `2026-01-01T00:00:00.000Z`
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Gifts", "description": null, "occasionDate": null, "visibility": "private" }`
- **THEN** `createdAt` W равен `2026-01-01T00:00:00.000Z`
- **AND** `updatedAt` W позже `2026-01-01T00:00:00.000Z`

### Requirement: Прежняя или пустая Occasion Date при изменении

`PUT /api/wishlists/:id` владельца SHALL принимать `occasionDate`, равную сохранённой Occasion Date Wishlist, либо
`null` без проверки окна Occasion Date.

#### Scenario: Правка Wishlist с Past Occasion Date

- **GIVEN** у A действует Session; Clock фиксирует `2026-11-12T12:00:00Z`; PostgreSQL доступен
- **AND** A владеет Wishlist W, вставленным прямым SQL с `title: "Books"`, `occasionDate: "2025-12-01"`
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Gifts", "description": null, "occasionDate": "2025-12-01", "visibility": "private" }`
- **THEN** API отвечает 200
- **AND** W имеет `title: "Gifts"` и `occasionDate: "2025-12-01"`

#### Scenario: Сброс Past Occasion Date

- **GIVEN** у A действует Session; Clock фиксирует `2026-11-12T12:00:00Z`; PostgreSQL доступен
- **AND** A владеет Wishlist W, вставленным прямым SQL с `occasionDate: "2025-12-01"`
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Books", "description": null, "occasionDate": null, "visibility": "private" }`
- **THEN** API отвечает 200
- **AND** W имеет `occasionDate: null`

### Requirement: Новая Occasion Date вне окна при изменении

`PUT /api/wishlists/:id` владельца SHALL отвечать 400 без изменения Wishlist, если `occasionDate` ненулевая, отличается
от сохранённой и лежит вне включительного UTC-окна [сегодня − 1 день, сегодня + 5 календарных лет].

#### Scenario: Новая дата в прошлом году

- **GIVEN** у A действует Session; Clock фиксирует `2026-11-12T12:00:00Z`; PostgreSQL доступен
- **AND** A владеет Wishlist W с `title: "Books"`, `occasionDate: null`
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Gifts", "description": null, "occasionDate": "2025-12-01", "visibility": "private" }`
- **THEN** ответ имеет статус 400 и тип `application/problem+json`
- **AND** все поля W остаются прежними, включая `title: "Books"` и `updatedAt`

#### Scenario: Пять лет плюс один день

- **GIVEN** у A действует Session; Clock фиксирует `2026-11-12T12:00:00Z`; PostgreSQL доступен
- **AND** A владеет Wishlist W с `occasionDate: "2027-01-15"`
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Books", "description": null, "occasionDate": "2031-11-13", "visibility": "private" }`
- **THEN** ответ имеет статус 400 и тип `application/problem+json`
- **AND** W имеет `occasionDate: "2027-01-15"`

### Requirement: Новая Occasion Date в окне при изменении

`PUT /api/wishlists/:id` владельца SHALL принимать ненулевую `occasionDate`, отличную от сохранённой, если она лежит в
включительном UTC-окне [сегодня − 1 день, сегодня + 5 календарных лет].

#### Scenario: Границы окна принимаются

- **GIVEN** у A действует Session; Clock фиксирует `2026-11-12T12:00:00Z`; PostgreSQL доступен
- **AND** A владеет Wishlist W с `occasionDate: null`
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с `occasionDate: "2026-11-11"` либо `"2031-11-12"` при остальных
  полях `{ "title": "Books", "description": null, "visibility": "private" }`
- **THEN** API отвечает 200
- **AND** W имеет переданную `occasionDate`

### Requirement: Тело отказа по окну Occasion Date

Ответ 400 на Occasion Date вне окна при `PUT /api/wishlists/:id` SHALL иметь тип `application/problem+json` и тело
ровно из полей `code: WISHLIST_OCCASION_DATE_OUT_OF_WINDOW`, `detail: The occasion date is outside the allowed window`,
`status: 400`, `title: Occasion date out of window`, `type: /errors/wishlist-occasion-date-out-of-window`,
`instance: /api/wishlists/<id>` и `errors` из одной записи с `location: "payload"`, `path: ["occasionDate"]` и
`message: Expected a date between <min> and <max>`, где `<min>` и `<max>` — границы окна в формате `YYYY-MM-DD`.

#### Scenario: Тело отказа

- **GIVEN** у A действует Session; Clock фиксирует `2026-11-12T12:00:00Z`; PostgreSQL доступен
- **AND** A владеет Wishlist W с `occasionDate: null`
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Books", "description": null, "occasionDate": "2026-11-10", "visibility": "private" }`
- **THEN** ответ имеет статус 400, тип `application/problem+json`
- **AND** JSON содержит `code: WISHLIST_OCCASION_DATE_OUT_OF_WINDOW`,
  `detail: The occasion date is outside the allowed window`, `status: 400`, `title: Occasion date out of window`,
  `type: /errors/wishlist-occasion-date-out-of-window`, `instance: /api/wishlists/<id W>` и `errors` ровно из одной записи; других полей нет
- **AND** запись `errors` равна
  `{ "location": "payload", "path": ["occasionDate"], "message": "Expected a date between 2026-11-11 and 2031-11-12" }`

### Requirement: Отказ не-владельцу в чужом Public Wishlist

При действующей Session `PUT` и `DELETE /api/wishlists/:id` для Public Wishlist другого User SHALL отвечать 403
problem+json с телом ровно из полей `code: WISHLIST_FORBIDDEN`, `detail: You cannot modify this wishlist`,
`status: 403`, `title: Wishlist forbidden`, `type: /errors/wishlist-forbidden`, запрошенного `id` и
`instance: /api/wishlists/<id>`, оставляя Wishlist без изменений.

#### Scenario: PUT чужого Public Wishlist

- **GIVEN** A владеет Public Wishlist W с известными полями; B отличается от A и имеет действующую Session;
  PostgreSQL доступен
- **WHEN** B отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Hacked", "description": null, "occasionDate": null, "visibility": "private" }`
- **THEN** ответ имеет статус 403, тип `application/problem+json`, `code: WISHLIST_FORBIDDEN`,
  `instance: /api/wishlists/<id W>`
- **AND** остальные поля JSON равны `detail: You cannot modify this wishlist`, `status: 403`,
  `title: Wishlist forbidden`, `type: /errors/wishlist-forbidden`, `id: <id W>`; других полей нет
- **AND** все поля W остаются прежними

#### Scenario: DELETE чужого Public Wishlist

- **GIVEN** A владеет Public Wishlist W с известными полями; B отличается от A и имеет действующую Session;
  PostgreSQL доступен
- **WHEN** B отправляет `DELETE /api/wishlists/<id W>`
- **THEN** ответ имеет статус 403, тип `application/problem+json`, `code: WISHLIST_FORBIDDEN`,
  `instance: /api/wishlists/<id W>`, `id: <id W>`
- **AND** W существует с прежними полями

### Requirement: Владение проверяется раньше окна Occasion Date

`PUT /api/wishlists/:id` не-владельца SHALL получать 403 либо 404 по правилу видимости Wishlist, а не 400 за
Occasion Date вне окна.

#### Scenario: PUT чужого Public Wishlist с датой вне окна

- **GIVEN** A владеет Public Wishlist W с `occasionDate: null`; B отличается от A и имеет действующую Session; Clock
  фиксирует `2026-11-12T12:00:00Z`; PostgreSQL доступен
- **WHEN** B отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Books", "description": null, "occasionDate": "2025-12-01", "visibility": "public" }`
- **THEN** ответ имеет статус 403 и `code: WISHLIST_FORBIDDEN`

#### Scenario: PUT чужого Private Wishlist с датой вне окна

- **GIVEN** A владеет Private Wishlist W с `occasionDate: null`; B отличается от A и имеет действующую Session; Clock
  фиксирует `2026-11-12T12:00:00Z`; PostgreSQL доступен
- **WHEN** B отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Books", "description": null, "occasionDate": "2025-12-01", "visibility": "private" }`
- **THEN** ответ имеет статус 404 и `code: WISHLIST_NOT_FOUND`

### Requirement: Неразличимость скрытого и отсутствующего Wishlist при изменении и удалении

При действующей Session `PUT` и `DELETE /api/wishlists/:id` для чужого Private Wishlist и отсутствующего UUID SHALL
отвечать одинаковым 404 problem+json с телом ровно из полей `code: WISHLIST_NOT_FOUND`, `detail: The requested
wishlist does not exist`, `status: 404`, `title: Wishlist not found`, `type: /errors/wishlist-not-found`, запрошенного
`id` и `instance: /api/wishlists/<id>`, не изменяя данных.

#### Scenario: PUT чужого Private Wishlist

- **GIVEN** A владеет Private Wishlist W с известными полями; B отличается от A и имеет действующую Session;
  PostgreSQL доступен
- **WHEN** B отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Hacked", "description": null, "occasionDate": null, "visibility": "public" }`
- **THEN** ответ имеет статус 404, тип `application/problem+json`, `code: WISHLIST_NOT_FOUND`,
  `instance: /api/wishlists/<id W>`
- **AND** остальные поля JSON равны `detail: The requested wishlist does not exist`, `status: 404`,
  `title: Wishlist not found`, `type: /errors/wishlist-not-found`, `id: <id W>`; других полей нет
- **AND** все поля W остаются прежними

#### Scenario: DELETE чужого Private Wishlist

- **GIVEN** A владеет Private Wishlist W с известными полями; B отличается от A и имеет действующую Session;
  PostgreSQL доступен
- **WHEN** B отправляет `DELETE /api/wishlists/<id W>`
- **THEN** ответ имеет статус 404, тип `application/problem+json`, `code: WISHLIST_NOT_FOUND`,
  `instance: /api/wishlists/<id W>`, `id: <id W>`
- **AND** W существует с прежними полями

#### Scenario: Одинаковое тело 404 для одного id при PUT

- **GIVEN** у B действует Session; прежний PUT B на чужой Private Wishlist с UUID X дал тело R; затем владелец удалил
  Wishlist X; PostgreSQL доступен
- **WHEN** B повторяет тот же `PUT /api/wishlists/<X>`
- **THEN** ответ имеет статус 404 и тип `application/problem+json`, а полное JSON-тело точно равно R, включая `id` и
  `instance`

#### Scenario: Одинаковое тело 404 для одного id при DELETE

- **GIVEN** у B действует Session; прежний DELETE B на чужой Private Wishlist с UUID X дал тело R; затем владелец
  удалил Wishlist X; PostgreSQL доступен
- **WHEN** B отправляет `DELETE /api/wishlists/<X>`
- **THEN** ответ имеет статус 404 и тип `application/problem+json`, а полное JSON-тело точно равно R, включая `id` и
  `instance`

#### Scenario: Повторный DELETE владельца

- **GIVEN** у A действует Session; PostgreSQL доступен; A владел Wishlist W и уже удалил его через
  `DELETE /api/wishlists/<id W>`
- **WHEN** A снова отправляет `DELETE /api/wishlists/<id W>`
- **THEN** ответ имеет статус 404, тип `application/problem+json`, `code: WISHLIST_NOT_FOUND`,
  `instance: /api/wishlists/<id W>`, `id: <id W>`

### Requirement: Удаление своего Wishlist

При действующей Session `DELETE /api/wishlists/:id` владельца SHALL безвозвратно удалять этот Wishlist и отвечать 204
без тела, не изменяя другие Wishlist.

#### Scenario: Владелец удаляет Wishlist

- **GIVEN** у A действует Session; PostgreSQL доступен
- **AND** A владеет ровно 2 Wishlist: W и V с известными полями; B владеет ровно 1 Wishlist U с известными полями;
  других Wishlist нет
- **WHEN** A отправляет `DELETE /api/wishlists/<id W>`
- **THEN** ответ имеет статус 204 и пустое тело
- **AND** в БД ровно 2 Wishlist: V и U с прежними полями

#### Scenario: Владелец удаляет Public Wishlist

- **GIVEN** у A действует Session; PostgreSQL доступен; A владеет Public Wishlist W
- **WHEN** A отправляет `DELETE /api/wishlists/<id W>`
- **THEN** ответ имеет статус 204 и пустое тело
- **AND** Wishlist W в БД отсутствует

### Requirement: Валидация id при изменении и удалении

При действующей Session API SHALL отклонять `PUT` и `DELETE /api/wishlists/:id` с невалидным UUID ответом 400
problem+json с `code: REQUEST_VALIDATION_FAILED` и `instance`, равным пути запроса.

#### Scenario: Невалидный UUID

- **GIVEN** у A действует Session; PostgreSQL доступен
- **WHEN** A отправляет `DELETE /api/wishlists/not-a-uuid` либо `PUT /api/wishlists/not-a-uuid` с
  `{ "title": "Books", "description": null, "occasionDate": null, "visibility": "private" }`
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`,
  `instance: /api/wishlists/not-a-uuid`

### Requirement: Отклонение невалидного тела изменения

При действующей Session API SHALL отклонять `PUT /api/wishlists/:id` с невалидными или отсутствующими полями либо
лишними свойствами ответом 400 problem+json с `code: REQUEST_VALIDATION_FAILED`, `instance: /api/wishlists/<id>`, не
изменяя Wishlist.

#### Scenario: Невалидное поле

- **GIVEN** у A действует Session; PostgreSQL доступен; A владеет Wishlist W с `title: "Books"`, `description: null`,
  `occasionDate: null`, `visibility: "private"`
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с одним из невалидных тел из матрицы ниже
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`,
  `instance: /api/wishlists/<id W>`
- **AND** все поля W остаются прежними

Для каждой строки меняется только указанное поле; остальные поля равны
`{ "title": "Books", "description": null, "occasionDate": null, "visibility": "private" }`.

| Поле           | Невалидные значения                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `title`        | отсутствие, `null`, 42, `""`, `"   "`, 256 символов `a` после trim                                                                     |
| `description`  | отсутствие, 42, 1001 символ `a` после trim                                                                                             |
| `occasionDate` | отсутствие, 42, `"2027-02-29"`, `"2028-02-30"`, `"2028-13-01"`, `"2028-00-01"`, `"2028-01-00"`, `"2028-2-9"`, `"2028-02-29T00:00:00Z"` |
| `visibility`   | отсутствие, `null`, 42, `"unlisted"`, `"PUBLIC"`                                                                                       |

#### Scenario: Клиент передаёт серверные поля

- **GIVEN** у A действует Session; существует другой User B; PostgreSQL доступен; A владеет Wishlist W с известными
  полями
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с телом
  `{ "title": "Books", "description": null, "occasionDate": null, "visibility": "private" }` и лишним `ownerId` B,
  `id`, `createdAt`, `updatedAt` либо произвольным полем
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`,
  `instance: /api/wishlists/<id W>`
- **AND** все поля W остаются прежними, включая `ownerId` A

### Requirement: Session обязательна для изменения и удаления Wishlist

API SHALL отвечать 401 problem+json с `code: AUTH_INVALID_SESSION` и `instance`, равным пути запроса без query, на
`PUT` и `DELETE /api/wishlists/:id` без действующей Session.

#### Scenario: PUT и DELETE без действующей Session

- **GIVEN** существует Wishlist W с известными полями; PostgreSQL доступен; cookie `wishlist_session` отсутствует,
  повреждена, не соответствует Session либо соответствует истекшей Session
- **WHEN** клиент отправляет `DELETE /api/wishlists/<id W>?source=test` либо `PUT /api/wishlists/<id W>?source=test` с
  `{ "title": "Books", "description": null, "occasionDate": null, "visibility": "private" }`
- **THEN** ответ имеет статус 401, тип `application/problem+json`, `code: AUTH_INVALID_SESSION`,
  `instance: /api/wishlists/<id W>`
- **AND** W существует с прежними полями

### Requirement: Технические отказы изменения и удаления Wishlist

API SHALL отвечать на технические отказы `PUT` и `DELETE /api/wishlists/:id` по существующему контракту `api-errors`.

#### Scenario: Временный отказ изменения

- **GIVEN** у A действует Session; аутентификация завершается успешно; A владеет Wishlist W; persistence изменения
  отказывает временно
- **WHEN** A отправляет `PUT /api/wishlists/<id W>` с
  `{ "title": "Books", "description": null, "occasionDate": null, "visibility": "private" }`
- **THEN** API отвечает 503 problem+json по `api-errors`, с `instance: /api/wishlists/<id W>`

#### Scenario: Временный отказ удаления

- **GIVEN** у A действует Session; аутентификация завершается успешно; A владеет Wishlist W; persistence удаления
  отказывает временно
- **WHEN** A отправляет `DELETE /api/wishlists/<id W>`
- **THEN** API отвечает 503 problem+json по `api-errors`, с `instance: /api/wishlists/<id W>`
