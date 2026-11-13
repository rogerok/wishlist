# Proposal

## Why

Шаги 3.5 и 3.6 [roadmap](../../../learning/roadmap.md#3-owner-only-wishlists): владелец пока может создать Wishlist,
но не может исправить его поля или удалить его. Мутация должна затрагивать только Wishlist владельца, а ответ
не-владельцу не должен раскрывать существование чужого Private Wishlist. Решения по контракту владелец принял
2026-11-12, умолчания подтвердил в тот же день.

## What Changes

- Новый маршрут `PUT /api/wishlists/:id` с полным телом по
  [ADR-0007](../../../docs/adr/0007-request-body-contains-every-field.md): `title`, `description`, `occasionDate`,
  `visibility`. Ответ 200 с сохранённым Wishlist из 8 полей. `visibility` меняется в обе стороны.
- Новый маршрут `DELETE /api/wishlists/:id`: hard delete, ответ 204 без тела. Повторный DELETE владельца даёт 404.
- Отказ не-владельцу на PUT и DELETE: чужой Public Wishlist → 403 `WISHLIST_FORBIDDEN` с `id` и `instance`; чужой
  Private Wishlist и отсутствующий UUID → одинаковый 404 `WISHLIST_NOT_FOUND`, как у GET.
- Окно Occasion Date при PUT проверяется, только если владелец сменил дату на другую ненулевую. Wishlist с Past
  Occasion Date можно править, не трогая дату. Нарушение окна → 400 `WISHLIST_OCCASION_DATE_OUT_OF_WINDOW` с одной
  записью `errors` по `path: ["occasionDate"]`.
- Невалидный UUID в `:id`, невалидное поле и лишнее поле тела → 400 `REQUEST_VALIDATION_FAILED`.
- PUT записывает в `updatedAt` время начала транзакции PostgreSQL и не меняет `createdAt`.
- Вне объёма: Reservations и Wishlist Items при удалении (шаг 6), точное значение `updatedAt`, условные запросы
  `If-Match`, Sharing Link и его инвалидация при смене visibility, soft delete.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `wishlists`: добавляются требования к изменению и удалению своего Wishlist, отказы 403/404 не-владельцу, окно
  Occasion Date при изменении даты, валидация, Session и технические отказы новых маршрутов. Существующие требования
  create, read и списка не меняются.

## Impact

- `apps/api/src/infra/errors/problem-bodies.ts`: фабрика тела 403 рядом с `makeNotFoundBody`.
- Модуль Wishlist: Schema тела PUT, ошибки `WishlistForbiddenError` и ошибка окна, problem-тела 403 и 400, методы
  repository (блокировка своей строки, update, delete), методы service, эндпоинты и handlers, тесты service и HTTP.
- `wishlist.schema.ts`: функция окна Occasion Date становится общей для create и PUT, чтобы границы и текст `message`
  совпадали.
- Миграция не нужна: `updated_at` уже есть, дочерних таблиц у `wishlists` пока нет.
- Зависимости не добавляются.

### Расхождения и наблюдения

- Create отдаёт нарушение окна как `REQUEST_VALIDATION_FAILED` (`CalendarDateInWindow`), PUT по решению владельца
  отдаёт то же нарушение со своим `code`. Тела совпадают по форме `errors`, отличаются `code`, `title`, `detail`,
  `type`.
- Ответов 403 в проекте пока нет; `makeNotFoundBody` задаёт `status: 404` жёстко.
- `WishlistsOperations` уже содержит `update` и `delete`.
- `PUT /api/users/:id` ставит `` updatedAt: sql`now()` `` (`users.repository.ts:140`); PUT Wishlist следует этому образцу.
