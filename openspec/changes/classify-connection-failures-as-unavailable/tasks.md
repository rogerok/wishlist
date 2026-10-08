# Tasks

## 1. Классификация отказа соединения

- [ ] 1.1 Сценарий «PostgreSQL недоступна до запроса»: дополнить таблицу `apps/api/src/infra/db/sql-failure.test.ts`
      строками `UnknownError` с `operation` `acquireConnection` и `connect` → `true`, `UnknownError` с `execute` и без
      `operation` → `false`, `AuthenticationError` с `acquireConnection` → `false`, в том числе внутри ошибки
      репозитория; изменить `isRetryableSqlFailure`. Проверка:
      `pnpm --filter @wishlist/api exec vitest run src/infra/db/sql-failure.test.ts` и
      `pnpm --filter @wishlist/api check-types`.

## 2. Интеграционная проверка

- [ ] 2.1 Сценарий «PostgreSQL недоступна до запроса» на собранном сервере: `pnpm --filter @wishlist/api build`, затем
      `pnpm --filter @wishlist/api exec tsx logout.smoke.ts`; во время обрыва `GET /api/auth/me`,
      `POST /api/auth/logout` и `POST /api/auth/login` отвечают `503 SERVICE_UNAVAILABLE`. Затем
      `pnpm --filter @wishlist/api exec vitest run --no-file-parallelism` и `pnpm --filter @wishlist/api lint`: все тесты
      проходят, новых предупреждений нет.
