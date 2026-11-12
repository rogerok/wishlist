# Состояние обучения

Обновлено: 2026-11-11

## Сейчас

Шаг: 3.4, keyset-пагинация; 5.1 и 5.2 в `main` (`ed0b315`). Ветка `6.1`.

- 6.1 закрыта 2026-11-12: `wishlists.repository.property.test.ts`, `prop` для `createdAt` и `occasionDate`.
  Шаги 1–2 (`Stream.paginate`, `Order`) писал владелец, шаг 3 вписал по решению агента, шаг 4 написал агент.
  Следующее действие: 7.1, smoke на живом сервере → статусы и тела совпадают со сценариями.

## Проверено

- 6.1: тестовый файл 3 раза подряд 3 passed; полный `pnpm test` 537 passed; без `TestClock.setTime` или с
  переставленными группами Upcoming/Past `prop` `occasionDate` падает, 2026-11-12.
- 5.2: `check-types` чистый, полный `pnpm test` 534 passed, 2026-11-11.
- 5.1в: `check-types` чистый, `test src/modules/wishlists` 142 passed, 2026-11-09.
- 5.1а–5.1б: `check-types`, `lint` чистые; полный `pnpm test` 478 passed, 2026-11-01.
- Session в тестах: `sesion.repository.ts` пишет `createdAt` из Clock, а не `now()`; 471 тест, 2026-11-01.

## Не проверено

- Живой сервер: `GET /api/wishlists` ещё не вызывался, это smoke 7.1.
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
