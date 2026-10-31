# Tasks

Задачи ссылаются на сценарии delta-spec [api-pagination](specs/api-pagination/spec.md) и
[wishlists](specs/wishlists/spec.md); решения — в [design.md](design.md). Команды запускаются из корня репозитория.

Наставничество действует при apply. Keyset-пагинации в `learning/mastery.md` нет, поэтому режим по умолчанию — **new**:
агент пишет worked example, владелец заполняет пропуски `TODO(you)`; режим каждой группы называется перед работой.
С задачи 4.1 (решение владельца 2026-10-19) весь код и тесты пишет владелец по пошаговым указаниям агента; агент
формулирует шаг и критерий готовности, проверяет результат и подсказывает по лестнице подсказок.
Тесты пишутся до реализации, а checkbox закрывается только после успешной команды.

## 1. Строгий query и наблюдение границы ошибок

- [x] 1.1 Добавить `.annotate(HttpApi.QueryParseOptions, requestParseOptions)` в `apps/api/src/infra/api/api.ts`.
      Регрессионная проверка факта из design (решение 6): маршруты без query-Schema query не разбирают, поэтому сценарии
      «Владелец не выбирается через query», «Чужой Private Wishlist» (`?ownerId=…`) и 401 с `?source=test` из
      `add-wishlist-create-read` остаются зелёными. Доказательство:
      `pnpm --filter @wishlist/api test src/modules/wishlists src/modules/auth` проходит.
- [x] 1.2 Временным эндпоинтом в тесте `apps/api/src/infra/pagination/query-errors.test.ts` наблюдать `path` в записи
      `errors` для неизвестного query-ключа и для отказа проверки на уровне структуры query; `location: "query"` уже
      установлен чтением кода. Тестовый `HttpApi` сам несёт `.annotate(HttpApi.QueryParseOptions, requestParseOptions)` и
      передаётся в `HttpApiBuilder.group`: настройки разбора берутся из него, аннотация на другом API ничего не меняет
      (`learning/STATE.md`, «Заметки»), и без неё неизвестный ключ молча отбросится. Записать наблюдённый `path` в
      design.md, решение 3. Доказательство: `pnpm --filter @wishlist/api test src/infra/pagination/query-errors.test.ts`
      проходит с зафиксированными значениями, а неизвестный ключ в нём даёт 400.

## 2. Schema модуля пагинации

- [x] 2.1 В `apps/api/src/infra/pagination/` добавить кодек курсора `makeCursorCodec` (base64url → JSON → Schema
      содержимого, `cursor.ts`) и детали query-Schema (`query.ts`): `LimitQueryParam` со значением по умолчанию и
      `cursorMatchesSort` с отказом по `path: ["cursor"]`; Struct query собирает потребитель (design, решение 3). В
      `infra/schemas/dates.schema.ts` добавить `PgCalendarDate` и `PgInstantFromString` по design (решение 2). Тесты
      `dates.schema.test.ts`, `cursor.test.ts`, `query.test.ts` покрывают: encode → decode возвращает исходный курсор;
      матрицы сценариев «Битый курсор» и «Курсор правильной формы с недопустимым значением»; «Невалидный limit» и
      «Повторённый limit»; «Сортировка, которой нет у списка»; несовпадение сортировки курсора и `sort` для явного и
      отсутствующего `sort`. Модуль не импортирует `#modules/*`. Доказательство:
      `pnpm --filter @wishlist/api test src/infra/pagination/cursor.test.ts src/infra/pagination/query.test.ts src/infra/schemas/dates.schema.test.ts`
      и `pnpm --filter @wishlist/api check-types` проходят.
- [x] 2.2 Добавить фабрику Schema ответа `{ items, nextCursor }` по Schema элемента. Тест проверяет точный JSON
      пустой страницы `{ "items": [], "nextCursor": null }` (сценарий «Пустой список» на уровне Schema). Доказательство:
      `pnpm --filter @wishlist/api test src/infra/pagination/page.test.ts` проходит.

## 3. Индекс

- [x] 3.1 Добавить `apps/api/src/infra/db/migrations/0005_wishlists_idx.ts`: создать
      `wishlists_owner_id_created_at_id_idx` на `(owner_id, created_at DESC, id DESC)` и удалить
      `wishlists_owner_id_idx`. В `wishlists.migration.test.ts` проверить через `pg_indexes`, что новый индекс есть, а
      старого нет, и что «Каскадное удаление владельца» по-прежнему проходит. Доказательство:
      `pnpm --filter @wishlist/api test src/infra/db/migrations` проходит.
- [x] 3.2 После подтверждения владельца применить миграцию к локальной БД и выполнить codegen. Доказательство:
      `pnpm --filter @wishlist/api db:migrate`, `pnpm --filter @wishlist/api db:generate` и
      `pnpm --filter @wishlist/api db:check` проходят.

## 4. Keyset в SQL

- [x] 4.1 Реализовать применение пресета к запросу Kysely (`WHERE` сравнением строк значений, `ORDER BY`,
      `LIMIT limit + 1`) и сборку страницы с `nextCursor`. По design (решение 4): модуль очищает `ORDER BY`, `LIMIT` и
      `OFFSET` запроса потребителя, сохраняя его `WHERE`; кортеж типов ключа `Key` связывает `keyColumns` и
      `cursorValues` по длине и типам (проверка типов через `@ts-expect-error`); контракт ключа записан в комментарии к `KeysetSort`. Для пресета из колонок тесты
      на PostgreSQL (`apps/api/src/infra/pagination/keyset.test.ts`, таблица `wishlists`) проверяют сценарии
      «Элементов ровно на одну страницу», «Элементов на один больше страницы», «Вторая страница», «Другой limit на
      следующей странице», «Равные значения сортировки на границе страниц», «Удалён последний элемент первой страницы»,
      а также: запрос потребителя с `orderBy('title')` и `offset(5)` даёт те же страницы, что и без них; при
      `direction: 'asc'` страницы идут по возрастанию; ключи разной длины и переставленные колонки разных типов не компилируются. Доказательство:
      `pnpm --filter @wishlist/api test src/infra/pagination/keyset.test.ts` проходит.
- [x] 4.1a Заменить кортеж `Key` и два списка `keyColumns`/`cursorValues` одним списком компонентов `key` (design,
      решение 4, 2026-10-23). Компонент создаёт `keyPart`: общий параметр типа для `column` и `value`, ограничение
      `NonNullable<unknown>`, метка. `applyKeyset` строит обе стороны сравнения из `key`; комментарий-контракт к
      `KeysetSort` описывает новый вид. Тесты типов через `@ts-expect-error`: пустой `key`, разные типы `column` и
      `value` в одном компоненте, колонка с `NULL`, компонент объектом без `keyPart`. Доказательство:
      `pnpm --filter @wishlist/api test src/infra/pagination/keyset.test.ts` и `pnpm --filter @wishlist/api check-types`
      проходят.
- [x] 4.2 Добавить вычисляемый ключ с параметром: выражения ключа применяются и к колонкам, и к параметрам курсора,
      каждый параметр явно приведён к типу (`::date`, `::uuid`, design, решение 5); параметр первой страницы вычисляет
      `Effect` пресета. В `keyset.test.ts` под `TestClock` проверить для ключа
      `occasionDate` из design (решение 5) порядок сценариев «Все три группы», «Несколько Wishlist без Occasion Date»,
      «В Москве уже завтра» и «Полночь посреди обхода». Доказательство:
      `pnpm --filter @wishlist/api test src/infra/pagination/keyset.test.ts` проходит.
- [x] 4.3 На локальной БД создать 1 000 Wishlist у одного User и по 1 000 ещё у трёх User, выполнить
      `ANALYZE wishlists`, затем `EXPLAIN` первой и второй страницы `sort=createdAt`. Записать в design.md, решение 7,
      использует ли план `wishlists_owner_id_created_at_id_idx` с условием по кортежу в `Index Cond`. Без свежей
      статистики и других владельцев план может уйти в Seq Scan, и вывод будет про планировщик, а не про индекс.
      Доказательство: вывод `EXPLAIN` приложен к записи; временные данные удалены.

## 5. Список Wishlist

- [ ] 5.1 Объявить пресеты `createdAt` и `occasionDate` в модуле Wishlist; добавить метод repository и service
      «список своих Wishlist» с областью `owner_id = viewerId`, декодированием строк и `OperationFailed` по образцу
      `getReadableById`. Service-тест поверх PostgreSQL проверяет «Свои Wishlist обеих visibility», «Разные createdAt»,
      «Равные createdAt». Доказательство:
      `pnpm --filter @wishlist/api test src/modules/wishlists/service/wishlists.service.test.ts` проходит.
- [ ] 5.2 Добавить операцию и эндпоинт `GET /api/wishlists` с query-Schema из модуля и Schema ответа страницы, handler
      и перевод технических отказов через существующий обработчик. HTTP-тесты в `wishlists.handlers.test.ts` покрывают
      все сценарии `api-pagination` и сценарии `wishlists` «Элемент совпадает с записью», «Список без действующей
      Session», «Невалидный query без действующей Session», «Временный отказ чтения списка», «Повреждённая строка в
      списке», «Полночь посреди обхода». Доказательство:
      `pnpm --filter @wishlist/api test src/modules/wishlists/handlers/wishlists.handlers.test.ts` и
      `pnpm --filter @wishlist/api check-types` проходят.

## 6. Свойство полного обхода

- [ ] 6.1 Property-based тест `apps/api/src/infra/pagination/keyset.property.test.ts` на PostgreSQL по design (решение
      8): генерируемые строки и `limit`; обход через `Stream.paginate`; оракул — `Order`, объявленный в самом тестовом
      файле независимо от пресета. Для обоих пресетов
      проверяется требование «Полный обход без пропусков и повторов». Сид и число прогонов зафиксированы в тесте.
      Доказательство: `pnpm --filter @wishlist/api test src/infra/pagination/keyset.property.test.ts` проходит три раза
      подряд.

## 7. Интеграция

- [ ] 7.1 Smoke на настоящем сервере и локальной БД: signup, создание 3 Wishlist, обход `GET /api/wishlists?limit=2`
      по `nextCursor`, `sort=occasionDate`, 400 на `?srot=x`; созданные smoke данные удалить. Добавить пагинацию и индекс
      в `learning/reference/system-map.html`. Доказательство: сценарии smoke дают ожидаемые статусы и тела;
      `pnpm --filter @wishlist/api check-types`, `lint`, `test`, `build`, `db:check` проходят;
      `openspec validate add-reusable-keyset-pagination --strict` проходит.
