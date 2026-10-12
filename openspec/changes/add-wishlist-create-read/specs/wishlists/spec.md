# Spec Delta

## Purpose

Определяет контракт Wishlist, его сохранение и создание для текущего User. Задаёт чтение по id с Session: Private Wishlist доступен владельцу, Public Wishlist — любому аутентифицированному User.

Тело create содержит каждый ключ контракта, необязательное значение — `null` ([ADR-0007](../../../../../docs/adr/0007-request-body-contains-every-field.md)). Минимальное тело — `{ "title": "Books", "description": null, "occasionDate": null, "visibility": "private" }`.

## ADDED Requirements

### Requirement: Нормализация title

Входной контракт Wishlist SHALL удалять пробелы по краям `title` перед проверкой длины от 1 до 255 символов.

#### Scenario: Границы title после trim

- **WHEN** входной контракт декодирует `title` из 1 либо 255 символов `a`, окружённых пробелами
- **THEN** результат содержит ровно переданные символы `a` без крайних пробелов

### Requirement: Нормализация description

Входной контракт Wishlist SHALL преобразовывать `null` и пустую после trim `description` в `null`, а непустую строку — в строку без крайних пробелов длиной до 1000 символов.

#### Scenario: Пустое description

- **WHEN** входной контракт декодирует `description`: `null`, `""` либо `"   "`
- **THEN** результат содержит `description: null`

#### Scenario: Непустое description

- **WHEN** входной контракт декодирует `description` из 1 либо 1000 символов `a`, окружённых пробелами
- **THEN** результат содержит ровно переданные символы `a`

### Requirement: Календарный контракт Occasion Date

Входной контракт Wishlist SHALL принимать `occasionDate` только как существующую календарную дату `YYYY-MM-DD` либо `null`.

#### Scenario: Високосная дата

- **GIVEN** сегодня по UTC — `2026-10-12`
- **WHEN** входной контракт декодирует `occasionDate: "2028-02-29"`
- **THEN** результат содержит `occasionDate: "2028-02-29"`

#### Scenario: Дата не указана

- **WHEN** входной контракт декодирует `occasionDate: null`
- **THEN** результат содержит `occasionDate: null`

### Requirement: Окно Occasion Date при create

API create Wishlist SHALL принимать ненулевую Occasion Date только в включительном UTC-окне [сегодня − 1 день, сегодня + 5 календарных лет]; вне окна — 400 problem+json без вставки: основной путь возвращает `code: REQUEST_VALIDATION_FAILED` и ровно одну запись `errors` с `location: "payload"`, `path: ["occasionDate"]`, `message` с границами окна; выбранный запасной путь возвращает `code: WISHLIST_OCCASION_DATE_OUT_OF_RANGE`.

#### Scenario: Вчера минус один день отклоняется

- **GIVEN** у A действует Session; Clock фиксирует `2026-10-12T12:00:00Z`; PostgreSQL доступен; в БД ровно 0 Wishlist; активен основной либо выбранный запасной контракт
- **WHEN** A отправляет `POST /api/wishlists` с `{ "title": "Books", "occasionDate": "2026-10-10" }`
- **THEN** ответ имеет статус 400 и тип `application/problem+json`
- **AND** `code` равен `REQUEST_VALIDATION_FAILED` в основном контракте либо `WISHLIST_OCCASION_DATE_OUT_OF_RANGE` в запасном
- **AND** в основном пути `errors` содержит ровно одну запись: `location: "payload"`, `path: ["occasionDate"]`, а `message` содержит допустимые границы `2026-10-11` и `2031-10-12`
- **AND** в БД остаётся ровно 0 Wishlist

#### Scenario: Вчера принимается

- **GIVEN** Clock фиксирует `2026-10-12T12:00:00Z`
- **WHEN** входная проверка create обрабатывает `occasionDate: "2026-10-11"`
- **THEN** дата проходит проверку окна без изменения значения

#### Scenario: Пять лет принимаются

- **GIVEN** Clock фиксирует `2026-10-12T12:00:00Z`
- **WHEN** входная проверка create обрабатывает `occasionDate: "2031-10-12"`
- **THEN** дата проходит проверку окна без изменения значения

#### Scenario: Пять лет плюс один день отклоняются

- **GIVEN** у A действует Session; Clock фиксирует `2026-10-12T12:00:00Z`; PostgreSQL доступен; в БД ровно 0 Wishlist; активен основной либо выбранный запасной контракт
- **WHEN** A отправляет `POST /api/wishlists` с `{ "title": "Books", "occasionDate": "2031-10-13" }`
- **THEN** ответ имеет статус 400 и тип `application/problem+json`
- **AND** `code` равен `REQUEST_VALIDATION_FAILED` в основном контракте либо `WISHLIST_OCCASION_DATE_OUT_OF_RANGE` в запасном
- **AND** в основном пути `errors` содержит ровно одну запись: `location: "payload"`, `path: ["occasionDate"]`, а `message` содержит допустимые границы `2026-10-11` и `2031-10-12`
- **AND** в БД остаётся ровно 0 Wishlist

### Requirement: Значения visibility

Входной контракт Wishlist SHALL принимать `visibility` только из `private`, `public`; значения по умолчанию на входе нет.

#### Scenario: Явная visibility

- **WHEN** входной контракт декодирует `visibility: "public"`
- **THEN** результат содержит `visibility: "public"`

#### Scenario: Visibility private

- **WHEN** входной контракт декодирует `visibility: "private"`
- **THEN** результат содержит `visibility: "private"`

### Requirement: Отклонение невалидного create

При действующей Session API SHALL отклонять `POST /api/wishlists` с невалидными или отсутствующими полями либо лишними свойствами ответом 400 problem+json с `code: REQUEST_VALIDATION_FAILED`, `instance: /api/wishlists`, без создания Wishlist.

#### Scenario: Невалидное поле

- **GIVEN** у User A действует Session; PostgreSQL доступен; в БД ровно 0 Wishlist
- **WHEN** A отправляет `POST /api/wishlists` с одним из невалидных тел из матрицы ниже
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`, `instance: /api/wishlists`
- **AND** в БД остаётся ровно 0 Wishlist

Для каждой строки меняется только указанное поле; остальные поля соответствуют минимальному телу.

| Поле           | Невалидные значения                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`        | отсутствие, `null`, 42, `""`, `"   "`, 256 символов `a` после trim                                                                                     |
| `description`  | отсутствие, 42, 1001 символ `a` после trim                                                                                                             |
| `occasionDate` | отсутствие, 42, `"2027-02-29"`, `"2028-02-30"`, `"2028-13-01"`, `"2028-00-01"`, `"2028-01-00"`, `"2028-2-9"`, `"0000-01-01"`, `"2028-02-29T00:00:00Z"` |
| `visibility`   | отсутствие, `null`, 42, `"unlisted"`, `"PUBLIC"`                                                                                                       |

#### Scenario: Клиент передаёт серверные поля

- **GIVEN** у User A действует Session; существует другой User B; PostgreSQL доступен; в БД ровно 0 Wishlist
- **WHEN** A отправляет `POST /api/wishlists` с минимальным телом и лишним `ownerId` B, `id`, `createdAt`, `updatedAt` либо произвольным полем
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`, `instance: /api/wishlists`
- **AND** в БД остаётся ровно 0 Wishlist

### Requirement: Создание для текущего User

Успешный `POST /api/wishlists` SHALL сохранять ровно один новый Wishlist для User предъявленной Session с нормализованными полями, новым UUID и серверными `createdAt`, `updatedAt`, не изменяя существующие Wishlist.

#### Scenario: Создание минимального Wishlist

- **GIVEN** у User A действует Session; PostgreSQL доступен; в БД ровно 0 Wishlist
- **WHEN** A отправляет `POST /api/wishlists` с минимальным телом, где `title: "  Books  "`
- **THEN** в БД ровно 1 Wishlist с владельцем A и новым UUID
- **AND** его поля равны `title: "Books"`, `description: null`, `occasionDate: null`, `visibility: "private"`
- **AND** его `createdAt` и `updatedAt` заданы сервером

#### Scenario: Несколько Wishlist одного User

- **GIVEN** у A действует Session; PostgreSQL доступен; A владеет ровно 1 Wishlist W с известными полями; других Wishlist нет
- **WHEN** A отправляет `POST /api/wishlists` с минимальным телом
- **THEN** A владеет ровно 2 Wishlist с разными id
- **AND** все поля W остаются прежними

#### Scenario: Владелец не выбирается через query

- **GIVEN** у A действует Session; существует другой User B; PostgreSQL доступен; в БД ровно 0 Wishlist
- **WHEN** A отправляет `POST /api/wishlists?ownerId=<id B>` с минимальным телом
- **THEN** в БД ровно 1 Wishlist с владельцем A

### Requirement: Представление созданного Wishlist

Успешный `POST /api/wishlists` SHALL отвечать 201 с JSON сохранённого Wishlist, содержащим только 8 полей: `id`, `ownerId`, `title`, `description`, `occasionDate`, `visibility`, `createdAt`, `updatedAt`; timestamps представлены строками ISO 8601.

#### Scenario: Ответ create соответствует записи

- **GIVEN** у A действует Session; Clock фиксирует `2026-10-12T12:00:00Z`; PostgreSQL доступен
- **WHEN** A отправляет `POST /api/wishlists` с `{ "title": "Books", "description": "  Art  ", "occasionDate": "2028-02-29", "visibility": "public" }`
- **THEN** API отвечает 201 с JSON ровно из перечисленных полей сохранённого Wishlist
- **AND** JSON содержит `ownerId` A, `title: "Books"`, `description: "Art"`, `occasionDate: "2028-02-29"`, `visibility: "public"`
- **AND** `createdAt` и `updatedAt` являются строками ISO 8601, соответствующими записи

### Requirement: Чтение доступного Wishlist

При действующей Session `GET /api/wishlists/:id` SHALL отвечать 200 с представлением Wishlist из восьми полей контракта и ISO 8601 timestamps, если User является владельцем либо visibility равна `public`.

#### Scenario: Владелец читает Private Wishlist

- **GIVEN** A владеет Private Wishlist W с известными восемью полями; у A действует Session; PostgreSQL доступен
- **WHEN** A отправляет `GET /api/wishlists/<id W>`
- **THEN** API отвечает 200 с точным представлением W из восьми полей контракта

#### Scenario: Другой User читает Public Wishlist

- **GIVEN** A владеет Public Wishlist W с известными восемью полями; B отличается от A и имеет действующую Session; PostgreSQL доступен
- **WHEN** B отправляет `GET /api/wishlists/<id W>`
- **THEN** API отвечает 200 с точным представлением W из восьми полей контракта

#### Scenario: Владелец читает Public Wishlist

- **GIVEN** A владеет Public Wishlist W с известными восемью полями; у A действует Session; PostgreSQL доступен
- **WHEN** A отправляет `GET /api/wishlists/<id W>`
- **THEN** API отвечает 200 с точным представлением W из восьми полей контракта

### Requirement: Чтение Occasion Date вне текущего окна

Чтение доступного Wishlist SHALL возвращать 200 с сохранённой календарной Occasion Date без проверки её попадания в текущее окно create.

#### Scenario: Чтение старой Occasion Date

- **GIVEN** A владеет Wishlist W, вставленным прямым SQL с `occasionDate: "2020-02-29"`; у A действует Session; Clock фиксирует `2026-10-12T12:00:00Z` без сдвига времени; PostgreSQL доступен
- **WHEN** A отправляет `GET /api/wishlists/<id W>`
- **THEN** ответ имеет статус 200 и содержит `occasionDate: "2020-02-29"`

### Requirement: Неразличимость скрытого и отсутствующего Wishlist

При действующей Session `GET /api/wishlists/:id` SHALL отвечать одинаковым 404 problem+json для чужого Private Wishlist и отсутствующего UUID: тело содержит ровно `code: WISHLIST_NOT_FOUND`, `detail: The requested wishlist does not exist`, `status: 404`, `title: Wishlist not found`, `type: /errors/wishlist-not-found`, запрошенный `id` и `instance: /api/wishlists/<id>`.

#### Scenario: Чужой Private Wishlist

- **GIVEN** A владеет Private Wishlist W; B отличается от A и имеет действующую Session; PostgreSQL доступен
- **WHEN** B отправляет `GET /api/wishlists/<id W>?ownerId=<id A>`
- **THEN** ответ имеет статус 404, тип `application/problem+json`, `code: WISHLIST_NOT_FOUND`, `instance: /api/wishlists/<id W>`
- **AND** остальные поля JSON равны `detail: The requested wishlist does not exist`, `status: 404`, `title: Wishlist not found`, `type: /errors/wishlist-not-found`, `id: <id W>`; других полей нет

#### Scenario: Отсутствующий Wishlist

- **GIVEN** у A действует Session; Wishlist с UUID X отсутствует; PostgreSQL доступен
- **WHEN** A отправляет `GET /api/wishlists/<X>`
- **THEN** ответ имеет статус 404, тип `application/problem+json`, `code: WISHLIST_NOT_FOUND`, `instance: /api/wishlists/<X>`
- **AND** остальные поля JSON равны `detail: The requested wishlist does not exist`, `status: 404`, `title: Wishlist not found`, `type: /errors/wishlist-not-found`, `id: <X>`; других полей нет

#### Scenario: Одинаковое тело 404 для одного id

- **GIVEN** у B действует Session; прежний GET чужого Private Wishlist с UUID X дал тело R; созданный для теста Wishlist X уже удалён; PostgreSQL доступен
- **WHEN** B отправляет `GET /api/wishlists/<X>`
- **THEN** ответ имеет статус 404 и тип `application/problem+json`, а полное JSON-тело точно равно R, включая `id` и `instance`

### Requirement: Валидация id при read

При действующей Session API SHALL отклонять `GET /api/wishlists/:id` с невалидным UUID ответом 400 problem+json с `code: REQUEST_VALIDATION_FAILED` и `instance`, равным пути запроса.

#### Scenario: Невалидный UUID

- **GIVEN** у A действует Session; PostgreSQL доступен
- **WHEN** A отправляет `GET /api/wishlists/not-a-uuid`
- **THEN** ответ имеет статус 400, тип `application/problem+json`, `code: REQUEST_VALIDATION_FAILED`, `instance: /api/wishlists/not-a-uuid`

### Requirement: Session обязательна для маршрутов Wishlist

API SHALL отвечать 401 problem+json с `code: AUTH_INVALID_SESSION` и `instance`, равным пути запроса без query, на create/read Wishlist без действующей Session.

#### Scenario: Create без действующей Session

- **GIVEN** PostgreSQL доступен; cookie `wishlist_session` отсутствует, повреждена, не соответствует Session либо соответствует истекшей Session
- **WHEN** клиент отправляет `POST /api/wishlists?source=test` с минимальным телом
- **THEN** ответ имеет статус 401, тип `application/problem+json`, `code: AUTH_INVALID_SESSION`, `instance: /api/wishlists`

#### Scenario: Public Wishlist без действующей Session

- **GIVEN** существует Public Wishlist W; PostgreSQL доступен; cookie `wishlist_session` отсутствует, повреждена, не соответствует Session либо соответствует истекшей Session
- **WHEN** клиент отправляет `GET /api/wishlists/<id W>?source=test`
- **THEN** ответ имеет статус 401, тип `application/problem+json`, `code: AUTH_INVALID_SESSION`, `instance: /api/wishlists/<id W>`

### Requirement: Ограничения сохранённых полей

Persistence Wishlist SHALL отклонять запись с `title` NULL, пустым после btrim или длиннее 255, непустым `description` длиннее 1000 либо пустым после btrim, несуществующей датой, или `visibility` вне разрешённых значений либо NULL.

#### Scenario: Прямая запись нарушает контракт

- **GIVEN** существует User A; PostgreSQL доступен; в БД ровно 0 Wishlist
- **WHEN** прямая вставка Wishlist A содержит одно нарушение ограничения при остальных допустимых полях
- **THEN** PostgreSQL отклоняет вставку
- **AND** в БД остаётся ровно 0 Wishlist

### Requirement: Значения persistence по умолчанию

Persistence Wishlist SHALL сохранять `visibility: private`, `description: null`, `occasionDate: null` при отсутствии этих полей в записи.

#### Scenario: Прямая минимальная запись

- **GIVEN** существует User A; PostgreSQL доступен
- **WHEN** прямая вставка Wishlist передаёт только владельца A и `title: "Books"`
- **THEN** сохранённая запись содержит `visibility: private`, `description: null`, `occasionDate: null`

### Requirement: Существующий владелец

Persistence Wishlist SHALL запрещать создание Wishlist без существующего владельца User.

#### Scenario: Несуществующий владелец

- **GIVEN** User с UUID X отсутствует; PostgreSQL доступен; в БД ровно 0 Wishlist
- **WHEN** прямая вставка Wishlist передаёт владельца X и `title: "Books"`
- **THEN** PostgreSQL отклоняет вставку
- **AND** в БД остаётся ровно 0 Wishlist

### Requirement: Удаление владельца удаляет его Wishlist

Persistence Wishlist SHALL удалять все Wishlist удаляемого User, сохраняя Wishlist остальных User без изменений.

#### Scenario: Каскадное удаление владельца

- **GIVEN** A владеет ровно 2 Wishlist; B владеет ровно 1 Wishlist W с известными полями; других Wishlist нет; PostgreSQL доступен
- **WHEN** PostgreSQL удаляет User A
- **THEN** Wishlist A отсутствуют
- **AND** в БД остаётся ровно 1 Wishlist W с прежними полями и владельцем B

### Requirement: Сохранение date-only без сдвига

Путь сохранения и чтения Wishlist SHALL возвращать ненулевую Occasion Date точно строкой `YYYY-MM-DD`, совпадающей со входом, независимо от часового пояса процесса.

#### Scenario: Дата проходит PostgreSQL без преобразования во время

- **GIVEN** существует User A; PostgreSQL доступен; процесс работает с `TZ=UTC`, `TZ=Europe/Moscow` либо `TZ=America/Los_Angeles`
- **WHEN** путь сохранения и чтения обрабатывает Wishlist A с `occasionDate: "2028-02-29"`
- **THEN** прочитанное значение имеет тип string и точно равно `"2028-02-29"`

### Requirement: Технические отказы Wishlist

API Wishlist SHALL отвечать на технические отказы create/read по существующему контракту `api-errors`.

#### Scenario: Временный отказ сохранения

- **GIVEN** у A действует Session; аутентификация завершается успешно; persistence create отказывает временно
- **WHEN** A отправляет `POST /api/wishlists` с минимальным телом
- **THEN** API отвечает 503 problem+json по `api-errors`, с `instance: /api/wishlists`

#### Scenario: Повреждённая строка при read

- **GIVEN** у A действует Session; аутентификация завершается успешно; в отдельной тестовой БД снят CHECK непустого title и вставлен доступный Wishlist W с `title: " "`
- **WHEN** A отправляет `GET /api/wishlists/<id W>`
- **THEN** API отвечает 500 problem+json по `api-errors`, с `instance: /api/wishlists/<id W>`
