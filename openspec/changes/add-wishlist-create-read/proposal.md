# Proposal

## Why

Шаги 3.1–3.3 [roadmap](../../../learning/roadmap.md#3-owner-only-wishlists) добавляют первый путь продукта: создать Wishlist и прочитать его по id. Контракт следует принятым решениям [Milestone 2 и порядка работ](../../../docs/product/implementation-plan.md#порядок-работ-решение-владельца-2026-10-12), а не расширяет объём до всего milestone.

## What Changes

- Добавить входные Schema для четырёх полей `title`, `description`, `occasionDate`, `visibility` по таблице Milestone 2.
- Ограничить Occasion Date при create окном «сегодня по UTC − 1 день» — «сегодня по UTC + 5 лет» включительно.
- Первой проверкой доказать выполнение `SchemaGetter.checkEffect` с `Clock` при декодировании payload в HttpApi; при отказе выбрать запасной путь плана.
- Добавить PostgreSQL persistence Wishlist: UUID, владелец, поля контракта, timestamps, FK, ограничения и индекс владельца.
- Читать PostgreSQL `date` строкой через общую настройку `types` каждого `PgClient.layer`; задать `dateParser: "string"` генератору.
- Добавить защищённые Session маршруты `POST /api/wishlists` и `GET /api/wishlists/:id`.
- Создавать Wishlist только для `CurrentSession.user.id`. Читать Private Wishlist только владельцу; Public Wishlist — любому аутентифицированному User.
- Возвращать одинаковый 404 для чужого Private Wishlist и отсутствующего id по соглашению Users: `makeNotFoundBody`, запрошенный `id`, `title: "Wishlist not found"` и `instance` из id.
- Исправить общий `instance` ответа 401 для защищённых маршрутов, сохраняя существующий контракт `/api/auth/me`.
- Проверить Schema, миграцию, PostgreSQL HTTP-сценарии и настоящий сервер с двумя User.

Не входят: шаги 3.4–3.7, list/pagination, update/delete Wishlist, Items, Item Price, Reservations, `unlisted`, Sharing Link, анонимное чтение, Public Profile, завершение Account и закрытие CRUD Users. Цена и её валюта относятся к Item Price в Milestone 4, не к Wishlist. PATCH в CORS остаётся задачей последующего update в Milestone 2.

## Capabilities

### New Capabilities

- `wishlists`: контракт Wishlist, ограничения persistence, создание для текущего User и чтение по visibility с Session.

### Modified Capabilities

Нет. `user-auth` сохраняет signup/login/logout; требования `api-errors` переиспользуются без изменения. Требование 401 новых маршрутов принадлежит `wishlists`.

## Impact

- Новый модуль `apps/api/src/modules/wishlists/`: schemas, repository, service, api, handlers и module Layer.
- Новая миграция после `0003_display_name`; regenerated `apps/api/src/infra/db/generated/database.ts`.
- Общая настройка date parser: `apps/api/src/infra/db/`, live/test подключения и `apps/api/.kysely-codegenrc.json`.
- Подключение группы и Layer: `infra/api/api.ts`, `infra/api/api-live.ts`, `app.ts`.
- Общий 401: `modules/auth/api/auth.api.errors.ts`, `modules/auth/handlers/auth.handlers.ts` и затронутые тесты.
- Ошибки: существующие `OperationFailed`, `domainProblem`, `makeTechnicalFailureHandler`, middleware валидации и дефектов по [ADR-0005](../../../docs/adr/0005-technical-failure-logging-and-5xx-contract.md).
- Зависимости не добавляются; существующие Effect `4.0.0-rc.108`, PostgreSQL, Kysely и Vitest достаточны.

### Расхождения с кодом

- `modules/` не содержит Wishlist; generated `DB` содержит только `users`, `passwordCredentials`, `sessions`.
- Оба `PgClient.layer` в `infra/db/config.ts` и `test-database.layer.ts` не задают `types`; генератор не задаёт `dateParser`.
- `AuthUnauthenticatedBody.instance` закреплён за `authMePath`, хотя `SessionAuthentication` уже является общим middleware.
- `SessionAuthenticationLive` назначает технической ошибке операцию `AuthOperation.me` даже на другом защищённом маршруте; переименование операции остаётся вне scope.
- Account содержит учебные заготовки и не подключён к API; change не использует его как рабочий образец и не реализует его заново.
- `server.ts` не разрешает PATCH; это расхождение относится к следующему update, не к 3.1–3.3.
- Публичный CRUD Users остаётся. Пока он позволяет удалить чужого User, новый модуль не означает защищённость всего API.
- Заголовок «Owner-only» не означает owner-only чтение Public Wishlist: явное решение от 2026-10-12 разрешает его другому User с Session.

### Допущения планирования

- Пропущенные `description` и `occasionDate` становятся `null`; явный `null` для них допустим. Для `visibility` допустимо отсутствие, но не `null`.
- Успешные ответы: 201 при create, 200 при read; JSON содержит ровно 8 полей: `id`, `ownerId`, четыре поля входного контракта, `createdAt`, `updatedAt`.
- Основной путь окна — входная Schema с `SchemaGetter.checkEffect` и `Clock`, ответ 400 `REQUEST_VALIDATION_FAILED`. Прямой service окно не проверяет.
- Если первая HTTP-проверка опровергает основной путь, окно проверяет service с `Clock` и предлагаемым кодом 400 `WISHLIST_OCCASION_DATE_OUT_OF_RANGE`. Выбранный путь фиксируется до дальнейшей реализации.
- Schema сохранённой строки и read проверяют формат даты, но не её текущее окно. PostgreSQL не получает CHECK с `now()`.
- Для верхней границы прибавляются пять календарных лет; 29 февраля ограничивается последним днём февраля целевого года.
- FK владельца использует `ON DELETE CASCADE` по образцу Session и Password Credential; отдельный контракт удаления Wishlist здесь не вводится.
- Новые имена маршрутов, схем, таблицы и ошибки not-found являются предложением, а не существующими идентификаторами кода.

### Не проверено

- Runtime-сценарии нового модуля не выполнялись: этот change создаёт только планирование, без проектного кода.
- Текущие тесты существующего auth не запускались; переиспользование описывает прочитанный код, а не новое подтверждение его поведения.
- Выполнение `checkEffect` с управляемым Clock в HttpApi пока не подтверждено; первая задача 1.1 проверяет именно эту границу.
