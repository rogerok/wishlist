# Tasks

Команды запускаются из корня репозитория.

## 1. Общий контракт ответов и логирование технических отказов

- [x] 1.1 Добавить `describeErrorChain` и таблицу его тестов. Задача не реализует сценарий спецификации: формат лога вне
      спеки, правило — в ADR-0005. Проверка: все тесты файла проходят.

  ```bash
  pnpm --filter @wishlist/api run test src/infra/logging/error-chain.test.ts
  ```

- [x] 1.2 Добавить общие ошибки `500`/`503` и `makeTechnicalFailureHandler`; реализует требования «Ответ на внутренний
      технический отказ», «Ответ на временную недоступность» и «Идентификатор трассы в ответе на технический отказ».
      Проверка: тесты хелпера на тестовом API проходят.

  ```bash
  pnpm --filter @wishlist/api run test src/infra/errors/technical-failure.test.ts
  ```

- [x] 1.3 Перевести хендлеры, контракты и `SessionAuthentication` модуля `auth` на общий хелпер; реализует все сценарии
      спецификации на `POST /api/auth/signup`. Проверка: тесты хендлеров auth проходят.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/handlers/auth.handlers.test.ts
  ```

- [x] 1.4 Перевести хендлеры и контракты модуля `users` на общий хелпер. Проверка: `GET /api/users` при ошибке
      репозитория отвечает `500` с `code: INTERNAL_ERROR`, тест проходит.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/users/handlers/users.handlers.test.ts
  ```

- [x] 1.5 Записать решение в `docs/adr/0005-technical-failure-logging-and-5xx-contract.md`. Проверка: файл существует и
      описывает логирование и контракт `5xx`.

## 2. Сверка сценариев с тестами

- [x] 2.1 Сценарий «Необратимая ошибка базы данных при signup» — тест `returns a safe 500 for 'SQL error'`.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/handlers/auth.handlers.test.ts -t "SQL error"
  ```

- [x] 2.2 Сценарий «Перегрузка расчёта хеша пароля при signup» — тест
      `returns a safe 503 for 'password hasher overload'`.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/handlers/auth.handlers.test.ts -t "password hasher overload"
  ```

- [x] 2.3 Сценарий «Запрос с заголовком traceparent» — тест `returns the trace id from an incoming traceparent header`.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/handlers/auth.handlers.test.ts -t "traceparent"
  ```

- [x] 2.4 Сценарий «Запрос без заголовка traceparent» — тест `returns a safe 503 for 'password hasher overload'`
      проверяет формат `traceId`.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/handlers/auth.handlers.test.ts -t "password hasher overload"
  ```

- [x] 2.5 Сценарий «Текст исходной ошибки содержит email» — тест `returns a safe 500 for 'unknown cause'`.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/handlers/auth.handlers.test.ts -t "unknown cause"
  ```

## 3. Интеграционная проверка

- [x] 3.1 Типы, lint и полный набор тестов. Проверка: `check-types` без ошибок; `lint` без ошибок; полный прогон
      проходит везде, кроме `auth.me.test.ts`, где 5 тестов падают только на незавершённом `TODO(you) 1: authenticate`.

  ```bash
  pnpm --filter @wishlist/api check-types
  ```

  ```bash
  pnpm --filter @wishlist/api lint
  ```

  ```bash
  pnpm --filter @wishlist/api run test --no-file-parallelism
  ```
