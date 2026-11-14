# Состояние обучения

Обновлено: 2026-11-14

## Сейчас

Шаг: 3.5–3.6 закрыты; изменение `add-wishlist-update-delete` выполнено полностью (10 из 10 задач).
Код repository, service, эндпоинтов и handler PUT/DELETE писал владелец; тесты и карту системы писал агент.
Изменение заархивировано 2026-11-14: `openspec/changes/archive/2026-11-14-add-wishlist-update-delete`.
Следующее действие: открыть PR ветки `feat/wishlist-update-delete` → PR смёрджен в `main`. Затем 3.7, vertical smoke.

## Проверено

- 6.1 smoke, `dist` + БД `api-postgres-1` на порту 5435, 2026-11-14: signup A и B 201; create Public и Private 201;
  PUT A 200; PUT и DELETE B на Public A 403, на Private A 404; DELETE A 204 с пустым телом, повтор 404.
  Smoke-User удалены, каскад убрал оставшийся Wishlist.
- 6.1 проверки, 2026-11-14: `check-types`, `lint`, `build` проходят; полный `test` 628 passed + 1 todo;
  `openspec validate add-wishlist-update-delete --strict` проходит. Диаграмма PUT/DELETE в карте рендерится.
- 5.1: до кода 11 тестов DELETE падали с 404; после `wishlists.handlers.test.ts` 163 passed, 2026-11-14.

## Не проверено

- `.zed/settings.json` (агент): Zed запускает `tsc --lsp --stdio` TypeScript 7 вместо vtsls; в самом Zed не
  проверено. Путь абсолютный — не коммитить или добавить `.zed/` в `.gitignore`.
- `pg` нужен только `kysely-codegen`: место в `devDependencies`, перенос не сделан.
- `db:check` в 6.1 не запускался: миграций в изменении нет, `db:migrate` ответил «DB schema is up to date».

## Заметки

- Ошибки 3.1–4.1: окно по сохранённой дате; `return` ошибки без `yield*`; путь коллекции вместо `:id`; окно в Schema PUT.
- Порты: 5432 — `cms-api-postgres-1`, 5434 — `cms-openapi-postgres-1` (чужие проекты). БД wishlist
  `api-postgres-1` поднята на 5435: `POSTGRES_PORT=5435 docker compose ... up -d`. Сервер: конфиг `api-db-5435` в
  `.claude/launch.json`; конфиг `api-db-5434` удалён 2026-11-14.
- В mermaid `;` внутри сообщения разделяет команды и ломает диаграмму: писать запятую.
- Фабрика с выводом типа курсора невозможна: TypeScript не выводит `Cursor` внутрь вложенных вызовов `keyPart`
  (три черновика, 2026-11-01). Поэтому псевдоним `WishlistSort<Cursor, Spec>`.
- Код пишет владелец, тесты по просьбе агент; правки вне шага агент делает по прямой просьбе.
- Решения владельца: миграции только вперёд; контракт ключа держат `keyPart` и `prepareKeyset`, без `throw`/`die`.
