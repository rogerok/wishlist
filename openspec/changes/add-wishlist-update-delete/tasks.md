# Tasks

Задачи ссылаются на сценарии delta-spec [wishlists](specs/wishlists/spec.md); решения в [design.md](design.md).
Команды запускаются из корня репозитория.

Наставничество действует при apply. Весь код и тесты пишет владелец по пошаговым указаниям агента (решение
2026-10-19): агент формулирует шаг и критерий готовности, проверяет результат и подсказывает по лестнице подсказок.
Перед каждой группой агент называет режим по `learning/mastery.md`. Тест пишется до реализации; checkbox закрывается
только после успешной команды.

## 1. Общие части ошибок и окна

- [ ] 1.1 Экспортировать проверку окна Occasion Date из `apps/api/src/modules/wishlists/schemas/wishlist.schema.ts` и
      перевести на неё `CalendarDateInWindow` (design, решение 4). Сценарии окна create из основной спеки остаются
      зелёными; новый тест функции проверяет границы `2026-11-11` и `2031-11-12` при «сегодня» `2026-11-12`.
      Доказательство: `pnpm --filter @wishlist/api test src/modules/wishlists/schemas` проходит.
- [ ] 1.2 Добавить `makeForbiddenBody` в `apps/api/src/infra/errors/problem-bodies.ts`, ошибки
      `WishlistForbiddenError` и `WishlistOccasionDateOutOfWindowError` в `wishlists.errors.ts`, problem-тела 403 и 400
      в `api/wishlists.api.errors.ts` (design, решение 5). Тест encode проверяет точный JSON тел из требований «Отказ
      не-владельцу в чужом Public Wishlist» и «Тело отказа по окну Occasion Date». Доказательство:
      `pnpm --filter @wishlist/api test src/modules/wishlists/api src/infra/errors` и
      `pnpm --filter @wishlist/api check-types` проходят.

## 2. Repository

- [ ] 2.1 Добавить в `WishlistRepository` блокировку своей строки (`SELECT … WHERE id AND owner_id FOR UPDATE`) и
      `update` (`UPDATE … WHERE id AND owner_id … RETURNING`, `` updatedAt: sql`now()` ``) по design, решение 2. Тесты в
      `repository/wishlists.repository.test.ts`: блокировка и update чужой строки возвращают `None`и не меняют её;
      сценарий «updatedAt сдвигается, createdAt нет». Доказательство:
      `pnpm --filter @wishlist/api test src/modules/wishlists/repository/wishlists.repository.test.ts` проходит.
- [ ] 2.2 Добавить `delete` своей строки с числом удалённых строк (design, решение 3). Тесты: своя строка → 1 и
      строки нет; чужая строка → 0 и строка на месте; повтор → 0. Доказательство:
      `pnpm --filter @wishlist/api test src/modules/wishlists/repository/wishlists.repository.test.ts` проходит.

## 3. Service

- [ ] 3.1 Добавить в `WishlistsService` развилку промаха `resolveMiss` и `update` в `db.withTransaction` с проверкой
      окна только для новой ненулевой даты (design, решения 1, 2). Тесты в `service/wishlists.service.test.ts` под
      `TestClock` на `2026-11-12T12:00:00Z`: «Правка Wishlist с Past Occasion Date», «Сброс Past Occasion Date», «Новая
      дата в прошлом году», «Пять лет плюс один день», «Границы окна принимаются»; B на Public A →
      `WishlistForbiddenError`, в том числе «PUT чужого Public Wishlist с датой вне окна»; B на Private A и
      отсутствующий UUID → `WishlistNotFoundError`, в том числе «PUT чужого Private Wishlist с датой вне окна»; во всех отказах строка не меняется. Доказательство:
      `pnpm --filter @wishlist/api test src/modules/wishlists/service/wishlists.service.test.ts` проходит.
- [ ] 3.2 Добавить `delete` в service: 0 удалённых строк → `resolveMiss`. Тесты: «Владелец удаляет Wishlist»,
      `WishlistForbiddenError` для Public A, `WishlistNotFoundError` для Private A и «Повторный DELETE владельца».
      Доказательство: `pnpm --filter @wishlist/api test src/modules/wishlists/service/wishlists.service.test.ts`
      проходит.

## 4. HTTP PUT

- [ ] 4.1 Добавить `UpdateWishlistBodySchema` (design, решение 6) и эндпоинт `PUT /api/wishlists/:id` с handler.
      HTTP-тесты в `handlers/wishlists.handlers.test.ts`: «Владелец меняет все поля», «Public становится Private»,
      «Другие Wishlist не меняются», «Ответ PUT соответствует записи», «Тело отказа», «PUT чужого Public Wishlist»,
      «PUT чужого Private Wishlist», «Одинаковое тело 404 для одного id при PUT», «Невалидный UUID» для PUT, матрица
      «Невалидное поле», «Клиент передаёт серверные поля». Доказательство:
      `pnpm --filter @wishlist/api test src/modules/wishlists/handlers/wishlists.handlers.test.ts` и
      `pnpm --filter @wishlist/api check-types` проходят.
- [ ] 4.2 Покрыть отказы PUT без Session и при сбое persistence по образцу тестов create: «PUT и DELETE без
      действующей Session» для PUT, «Временный отказ изменения». Доказательство:
      `pnpm --filter @wishlist/api test src/modules/wishlists/handlers/wishlists.handlers.test.ts` проходит.

## 5. HTTP DELETE

- [ ] 5.1 Добавить эндпоинт `DELETE /api/wishlists/:id` с `HttpApiSchema.NoContent` и handler. HTTP-тесты: «Владелец
      удаляет Wishlist», «Владелец удаляет Public Wishlist», «DELETE чужого Public Wishlist», «DELETE чужого Private
      Wishlist», «Одинаковое тело 404 для одного id при DELETE», «Повторный DELETE владельца», «Невалидный UUID» для
      DELETE, «PUT и DELETE без действующей Session» для DELETE, «Временный отказ удаления». Доказательство:
      `pnpm --filter @wishlist/api test src/modules/wishlists/handlers/wishlists.handlers.test.ts` и
      `pnpm --filter @wishlist/api check-types` проходят.

## 6. Интеграция

- [ ] 6.1 Smoke на настоящем сервере и локальной БД (конфиг `api-db-5434`): signup A и B; A создаёт Public и Private
      Wishlist; A меняет title через PUT → 200; B делает PUT и DELETE на Public A → 403, на Private A → 404; A удаляет
      Wishlist → 204, повторный DELETE → 404. Smoke-данные удалить. Добавить PUT и DELETE в
      `learning/reference/system-map.html`. Доказательство: статусы совпадают с ожидаемыми;
      `pnpm --filter @wishlist/api check-types`, `lint`, `test`, `build` и
      `openspec validate add-wishlist-update-delete --strict` проходят.
