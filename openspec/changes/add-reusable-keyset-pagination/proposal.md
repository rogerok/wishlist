# Proposal

## Why

Шаг 3.4 [roadmap](../../../learning/roadmap.md#3-owner-only-wishlists) требует список Wishlist со стабильным порядком и
ограниченной страницей. Списки понадобятся и дальше (Public Profile в Milestone 3, Wishlist Items в Milestone 4),
поэтому пагинация делается один раз как общий контракт и переиспользуемый модуль, а Wishlist становится его первым
потребителем. Решения по контракту приняты владельцем 2026-10-18 и записаны в
[ADR-0008](../../../docs/adr/0008-keyset-pagination-with-opaque-cursor.md).

## What Changes

- Ввести общий контракт постраничного списка: `GET` с необязательными query-параметрами `sort`, `cursor`, `limit`;
  ответ `{ items, nextCursor }`; `nextCursor: null` на последней странице; страницы только вперёд, без номеров и
  `totalCount`.
- `limit` по умолчанию 20; принимается только запись десятичными цифрами без знака и ведущих нулей от 1 до 100,
  иначе 400 `REQUEST_VALIDATION_FAILED`.
- Непрозрачный курсор: base64url от JSON с именем сортировки, значениями ключа последней строки и параметрами
  вычисляемого ключа. Битый курсор, курсор с недопустимым значением поля и курсор другой сортировки — 400
  `REQUEST_VALIDATION_FAILED` с `location: "query"`, а не отказ PostgreSQL и 500.
- Строгий разбор query для маршрутов, объявляющих query-параметры: неизвестный query-параметр — 400
  `REQUEST_VALIDATION_FAILED`. Маршруты без query-Schema query не разбирают и лишние ключи по-прежнему игнорируют.
- Без действующей Session список отвечает 401 даже при невалидном query: аутентификация выполняется до разбора query.
- Добавить защищённый Session маршрут `GET /api/wishlists`: все Wishlist текущего User, `private` и `public`.
- Две сортировки списка Wishlist:
  - `createdAt` (по умолчанию) — новые сверху;
  - `occasionDate` — Upcoming Occasion Date от ближайшей, затем Past Occasion Date от недавней, затем Wishlist без
    Occasion Date. Граница «сегодня» (`asOf`, дата по UTC) фиксируется на первой странице и переносится в курсоре.
- Миграция `0005`: составной индекс `(owner_id, created_at DESC, id DESC)` вместо `wishlists_owner_id_idx`.
- Переиспользуемый модуль `apps/api/src/infra/pagination/`: Schema курсора, query и ответа, применение keyset к запросу
  Kysely, сборка страницы. Модуль переносится в workspace-пакет, когда появится второй потребитель.
- Вне scope: список Wishlist другого User и Public Profile, общий каталог Public Wishlist, фильтры, переход к странице
  назад, сортировка по колонке с `NULL` через `infinity` (заготовка описана в ADR-0008), update/delete Wishlist.

## Capabilities

### New Capabilities

- `api-pagination`: общий контракт постраничных списков API — query-параметры, размер страницы, форма ответа, курсор
  и его отклонение, строгий разбор query.

### Modified Capabilities

- `wishlists`: добавляются требования к списку своих Wishlist — область видимости, сортировки и их порядок, отсутствие
  Session. Основная спецификация `openspec/specs/wishlists/` появится при архивировании `add-wishlist-create-read`;
  этот change архивируется после него.

## Impact

- Новый модуль `apps/api/src/infra/pagination/` с тестами, включая property-based тест обхода всех страниц.
- `apps/api/src/infra/api/api.ts`: аннотация `HttpApi.QueryParseOptions` со строгим разбором. Она действует только на
  маршруты с query-Schema: HttpApi не декодирует query эндпоинта без неё (`HttpApiBuilder.ts:844`, `:875`), поэтому
  существующие маршруты не меняются.
- `apps/api/src/infra/schemas/`: даты курсора ограничены годами, которые принимает PostgreSQL (`CalendarDate`
  пропускает `0000-01-01`, а PostgreSQL — нет).
- Модуль Wishlist: операция и эндпоинт списка, метод репозитория и service, handler, тесты HTTP и репозитория.
- Новая миграция `0005` и перегенерированный `apps/api/src/infra/db/generated/database.ts`, если codegen его меняет.
- Зависимости не добавляются: хватает Effect 4.0.4 (Schema, Clock, Stream, Order), Kysely и fast-check.

### Расхождения с кодом

- Change `add-wishlist-create-read` реализован (коммит `b9b87d8`), но не архивирован: в `openspec/specs/` нет
  `wishlists`.
- В `api.ts` строгий разбор включён только для тела (`HttpApi.PayloadParseOptions`); query-Schema пока нет ни у
  одного маршрута.
- `wishlists_owner_id_idx (owner_id)` — единственный индекс Wishlist кроме первичного ключа.
- `CalendarDate` (`infra/schemas/dates.schema.ts`) принимает `0000-01-01`, которую PostgreSQL отклоняет как
  `date/time field value out of range`.

### Установлено чтением кода Effect 4.0.4

- Любая ошибка декодирования query, включая проверку на уровне структуры, оборачивается в
  `HttpApiSchemaError.wrap("Query", …)` (`HttpApiBuilder.ts:876`) и получает `location: "query"`.
- Декодирование query выполняется внутри `applyMiddleware` (`HttpApiBuilder.ts:854–876`), поэтому `SessionAuthentication`
  группы срабатывает раньше и отвечает 401.

### Не проверено

- Что PostgreSQL выбирает новый индекс для `sort=createdAt`; проверяется через `EXPLAIN` в задачах.
