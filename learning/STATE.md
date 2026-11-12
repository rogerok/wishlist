# Состояние обучения

Обновлено: 2026-11-11

## Сейчас

Шаг: 3.4 закрыт: PR #13 влит (`1a0c578`), изменение в архиве `2026-11-12-add-reusable-keyset-pagination`.
Следующее действие: 3.5 Update, спека OpenSpec (пишет владелец: автор + ревьюер) → `openspec validate --strict`.

## Проверено

- 7.1 smoke, `dist` + локальная БД на порту 5434, 2026-11-12: signup 201; 3 create 201; `?limit=2` → C, B, затем A
  и `nextCursor: null`; `sort=occasionDate` → A (12-01), B (01-15), C (без даты); `?srot=x` → 400 по `srot`; без
  cookie 401. Smoke-User удалён, каскад убрал 3 Wishlist и 1 Session. `check-types`, `lint`, `build`, `db:check`,
  полный `test` (537) и `openspec validate --strict` проходят.
- 6.1: тестовый файл 3 раза подряд 3 passed; полный `pnpm test` 537 passed; без `TestClock.setTime` или с
  переставленными группами Upcoming/Past `prop` `occasionDate` падает, 2026-11-12.
- 5.2: `check-types` чистый, полный `pnpm test` 534 passed, 2026-11-11.
- 5.1: `check-types`, `lint` чистые; `test src/modules/wishlists` 142 passed, 2026-11-09.
- Session в тестах: `sesion.repository.ts` пишет `createdAt` из Clock, а не `now()`; 471 тест, 2026-11-01.

## Не проверено

- `.zed/settings.json` (агент): Zed запускает `tsc --lsp --stdio` TypeScript 7 вместо vtsls; сервер отвечает на
  `initialize`, в самом Zed не проверено. Путь абсолютный — не коммитить или добавить `.zed/` в `.gitignore`.
- `pg` нужен только `kysely-codegen`: место в `devDependencies`, перенос не сделан.

## Заметки

- Порт 5432 занят `cms-api-postgres-1` (rtdlab), 5433 — другим процессом. Smoke шёл на 5434 через конфиг
  `api-db-5434` в `.claude/launch.json`: он подменяет порт в `POSTGRES_URL`, `.env.development` не меняется.

- Ошибки 5.1, которые `check-types` не ловит: `direction` перепутан между пресетами (дважды), ключ без `id`,
  `cursorOf` со spread всей строки, пропущенный `.$call(keyset.apply)`.
- Объяснение двух `keyPart` на одну колонку сработало через JS: `map` (два `CASE` на строку) → `sort` с `||`.
- Фабрика с выводом типа курсора невозможна: TypeScript не выводит `Cursor` внутрь вложенных вызовов `keyPart`
  (три черновика, 2026-11-01). Поэтому псевдоним `WishlistSort<Cursor, Spec>`.
- vtsls в Zed показывал `any`: в `typescript` 7.0.2 нет `tsserver.js`, vtsls берёт встроенный 5.x.
- Код пишет владелец, тесты по просьбе агент; правки вне шага агент делает по прямой просьбе.
- Решения владельца: миграции только вперёд; контракт ключа держат `keyPart` и `prepareKeyset`, без `throw`/`die`.
