# Design

## Context

Мотивация в proposal.md, контракт в [specs/wishlists/spec.md](specs/wishlists/spec.md). Состояние кода, от которого
отталкивается подход:

- Repository Wishlist уже умеет `getReadableById(viewerId, id)`: строка видна, если `owner_id = viewerId` или
  `visibility = 'public'` (`repository/wishlists.repository.ts`). Service превращает `None` в `WishlistNotFoundError`.
- Окно Occasion Date считает `occasionDateWindow(now)` внутри `CalendarDateInWindow` (`schemas/wishlist.schema.ts`);
  «сегодня» берётся из `DateTime.now`, то есть из `Clock`, и тесты фиксируют его через `TestClock`.
- Транзакции: `db.withTransaction(effect)` из `@repo/sql-kysely`; repository внутри эффекта работает на соединении
  транзакции. Образец: `signup` в `modules/auth/service/auth.service.ts:109`, где `SqlError` транзакции переводится
  через `sqlOperationFailed`.
- `PUT /api/users/:id` пишет `` updatedAt: sql`now()` `` (`modules/users/repository/users.repository.ts:140`).
- Problem-тела строятся через `makeNotFoundBody`/`makeConflictBody` (`infra/errors/problem-bodies.ts`) и
  `domainProblem` (`infra/errors/http-problem.ts`).

## Goals / Non-Goals

**Goals:**

- Мутация затрагивает только строку с `id = :id AND owner_id = viewerId`; владение проверяет сам SQL записи, а не
  отдельный запрос до неё.
- Выбор 403/404 после промаха переиспользует правило видимости `getReadableById`, чтобы read и мутации не разошлись.
- Границы окна и текст `message` для create и PUT берутся из одной функции.

**Non-Goals:**

- Оптимистическая блокировка (`If-Match`, версия строки).
- Каскад на Wishlist Items и Reservations: таблиц пока нет.

## Decisions

### 1. Запись первой, развилка 403/404 только на промахе

PUT и DELETE сначала обращаются к строке с условием `id AND owner_id`. Промах (строки нет среди своих) разрешает общая
функция service:

```text
resolveMiss(viewerId, id):
  getReadableById(viewerId, id)
    Some → WishlistForbiddenError { id }   // чужой Public: строку видно, но она не своя
    None → WishlistNotFoundError { id }    // чужой Private или отсутствующий UUID
```

На успешном пути владельца DELETE выполняет один SQL-запрос, PUT выполняет два (`SELECT … FOR UPDATE` и
`UPDATE … RETURNING`) между `BEGIN` и `COMMIT`. Чтение видимости идёт только на промахе.

Ответ на вопрос шага 3.5 roadmap про утечку: отдельный предварительный запрос «чей это Wishlist»
(`SELECT … WHERE id = :id` без правила видимости) находит и чужой Private Wishlist, и ответ 403 вместо 404 сообщает B,
что такой id существует. `resolveMiss` спрашивает через `getReadableById`, который чужой Private не видит, поэтому B
получает тот же 404, что и для отсутствующего UUID.

Альтернатива «сначала `getReadableById`, потом мутация» отклонена: между двумя запросами владелец может сменить
visibility или удалить Wishlist, а мутация без `owner_id` в условии зависела бы от устаревшей проверки.

### 2. PUT в транзакции с блокировкой строки

```text
withTransaction:
  SELECT occasion_date FROM wishlists WHERE id = :id AND owner_id = :viewer FOR UPDATE
    нет строки → resolveMiss
  если body.occasionDate ≠ null и ≠ сохранённой → проверка окна (Clock)
    вне окна → WishlistOccasionDateOutOfWindowError { id, min, max }
  UPDATE wishlists SET title, description, occasion_date, visibility, updated_at = now()
    WHERE id = :id AND owner_id = :viewer RETURNING *
```

`FOR UPDATE` держит строку до конца транзакции, и параллельный PUT не сменит дату между сравнением и UPDATE. Ошибки
из транзакции типизированы и откатывают её; `SqlError` самого `withTransaction` переводится в `OperationFailed` через
`sqlOperationFailed(source, 'update')`.

`updated_at = now()` следует решению владельца 6 и образцу `PUT /api/users/:id`. В одном PUT работают двое часов:
окно считает «сегодня» по `Clock` приложения, а `now()` возвращает время начала транзакции PostgreSQL. Под `TestClock`
на `2026-11-12` окно проверяется по `2026-11-12`, а `updatedAt` получает настоящую дату. Сейчас это ничего не ломает:
у `wishlists` нет CHECK между timestamps, и ни один код не сравнивает `updatedAt` с `Clock`.

Сравнение дат идёт строками `YYYY-MM-DD`: оба значения проходят через `CalendarDate`, формат совпадает.

Следствие для не-владельца: проверка окна стоит после блокировки своей строки, поэтому B с датой вне окна получает 403
или 404, а не 400 (требование «Владение проверяется раньше окна Occasion Date»). Иначе B подбирал бы сохранённую дату
чужого Private Wishlist: дата, равная сохранённой, прошла бы без проверки окна, а любая другая дала бы 400.

Следствие для невалидных лет: `UpdateWishlistBodySchema` берёт `CalendarDate` без окна, а он пропускает
`0000-01-01`. Такая дата всегда отличается от сохранённой и не проходит окно, поэтому до PostgreSQL она не доходит и
даёт 400 `WISHLIST_OCCASION_DATE_OUT_OF_WINDOW`, а не 500. По этой же причине `0000-01-01` нет в матрице
`REQUEST_VALIDATION_FAILED` спеки.

### 3. DELETE одним запросом без транзакции

`DELETE FROM wishlists WHERE id = :id AND owner_id = :viewer` и число удалённых строк. 0 → `resolveMiss`. Транзакция
ничего не защищает: сравнивать перед удалением нечего, а гонка между DELETE и `getReadableById` меняет только код
отказа (403 вместо 404 или наоборот), данные не трогает.

### 4. Окно Occasion Date: одна функция, проверка в service

`occasionDateWindow(now)` экспортируется из `wishlist.schema.ts`; рядом появляется проверка, которая возвращает
`{ min, max }` при нарушении. `CalendarDateInWindow` (create) и service (PUT) вызывают её, поэтому границы и текст
`Expected a date between <min> and <max>` совпадают. Сценарий «Тело отказа» сравнивает `message` целиком, поэтому тест
PUT поймает и расхождение текста с create. Окно в Schema тела PUT не встраивается: Schema не видит
сохранённую дату и отклонила бы прежнюю Past Occasion Date.

### 5. Ошибки и problem-тела

| Доменная ошибка                            | HTTP | Тело                                                                          |
| ------------------------------------------ | ---- | ----------------------------------------------------------------------------- |
| `WishlistNotFoundError { id }`             | 404  | существующий `WishlistNotFoundProblem`                                        |
| `WishlistForbiddenError { id }`            | 403  | `makeForbiddenBody`: тексты + `id`, `instance`                                |
| `WishlistOccasionDateOutOfWindowError {…}` | 400  | тексты + `instance`, `errors: [RequestValidationIssueSchema]` из одной записи |

`makeForbiddenBody` добавляется в `problem-bodies.ts` по образцу `makeNotFoundBody` (`makeProblemBody(403)`). Тело
400 не содержит `id`: `instance` уже указывает на Wishlist, а форма `errors` совпадает с `REQUEST_VALIDATION_FAILED`,
чтобы клиент разбирал поле одинаково. `instance` 400 строится из `id` ошибки (`makeByIdInstance`), а запись `errors`
из `min`/`max`.

### 6. HTTP

- `PUT` `wishlistsByIdPath`: `params: { id: WishlistIdSchema }`, `payload: UpdateWishlistBodySchema`,
  `success: WishlistResponseSchema` (200), ошибки: технические, 404, 403, 400 окна.
- `DELETE` `wishlistsByIdPath`: `success: HttpApiSchema.NoContent` (есть в Effect 4.0.4,
  `effect/dist/http-api/HttpApiSchema.d.ts:120`), ошибки: технические, 404, 403.
- Операции `update` и `delete` уже есть в `WishlistsOperations`; handlers передают их в
  `makeTechnicalErrorHandler` с `meta: { targetWishlistId: id }`, как `getReadableById`.
- `UpdateWishlistBodySchema` — те же поля, что у create, кроме `occasionDate: WishlistOccasionDateSchema`.

## Risks / Trade-offs

- [Create и PUT отдают нарушение окна с разными `code`] → тела совпадают по `errors`; расхождение записано в
  proposal, клиент различает случаи по `code`.
- [`updatedAt` из часов PostgreSQL, окно из `Clock`: под `TestClock` они расходятся] → тесты проверяют только сдвиг
  `updatedAt` относительно заданного прямым SQL значения. Тот же класс расхождения уже ронял тесты Session
  (`created_at` через `now()`, `expires_at` через `Clock`; см. `learning/STATE.md`, «Проверено»). Если появится CHECK
  между timestamps Wishlist или сравнение `updatedAt` с `Clock`, писать `updatedAt` из `Clock`, как
  `sesion.repository.ts`.
- [Гонка DELETE владельца и чужого запроса меняет код отказа 403/404] → данные не затрагиваются; принято.
- [`FOR UPDATE` блокирует строку на время транзакции] → транзакция короткая, внешних вызовов внутри нет.
