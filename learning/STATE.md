# Состояние обучения

Обновлено: 2026-11-09

## Сейчас

Шаг: 3.4, keyset-пагинация. Задача 5.1 (список своих Wishlist) готова, не закоммичена, ветка `5.1`.

- 5.1а: пресеты в `wishlists.sorts.ts`; 5.1б: `listOwn` в репозитории; 5.1в: `listOwn` в сервисе
  (`= repository.listOwn`, владелец), service-тесты и заглушка `unexpectedList` в handler-тесте (агент).
  Следующее действие: импорт `../wishlists.sorts.js` в `wishlists.service.ts` заменить на `#modules/…`, затем 5.2,
  эндпоинт `GET /api/wishlists` → HTTP-тесты из `tasks.md` 5.2 зелёные.

## Проверено

- 5.1в: `check-types` чистый, `test src/modules/wishlists` 142 passed, 2026-11-09.
- 5.1а–5.1б: `check-types`, `lint` чистые; полный `pnpm test` 478 passed, 2026-11-01.
- Мина в тестах Session: `created_at` ставил `now()` PostgreSQL, `expires_at` — TestClock 2026-10-12 + 7 дней;
  с 2026-10-19 12:00 падали 11 тестов `wishlists.handlers.test.ts` (23514 `sessions_check`), на чистом `4f2ad8c`
  тоже. Агент: `sesion.repository.ts` пишет `createdAt` из Clock; 471 тест auth/wishlists/infra, 2026-11-01.

## Не проверено

- Пресет `occasionDate` и вторая страница `listOwn` на PostgreSQL не проверены: их покроют HTTP-тесты 5.2.
- `.zed/settings.json` (агент): Zed запускает `tsc --lsp --stdio` TypeScript 7 вместо vtsls; сервер отвечает на
  `initialize`, в самом Zed не проверено. Путь абсолютный — не коммитить или добавить `.zed/` в `.gitignore`.
- `pg` нужен только `kysely-codegen`: место в `devDependencies`, перенос не сделан.

## Заметки

- Ошибки 5.1, которые `check-types` не ловит: `direction` перепутан между пресетами (дважды), ключ без `id`,
  `cursorOf` со spread всей строки, пропущенный `.$call(keyset.apply)`.
- Объяснение двух `keyPart` на одну колонку сработало через JS: `map` (два `CASE` на строку) → `sort` с `||`.
- Фабрика с выводом типа курсора невозможна: TypeScript не выводит `Cursor` внутрь вложенных вызовов `keyPart`
  (три черновика, 2026-11-01). Поэтому псевдоним `WishlistSort<Cursor, Spec>`.
- vtsls в Zed показывал `any`: в `typescript` 7.0.2 нет `tsserver.js`, vtsls берёт встроенный 5.x.
- Код пишет владелец, тесты по просьбе агент; правки вне шага агент делает по прямой просьбе.
- Решения владельца: миграции только вперёд; контракт ключа держат `keyPart` и `prepareKeyset`, без `throw`/`die`.
