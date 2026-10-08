# Tasks

Команды запускаются из корня репозитория.

## 1. errorId вместо traceId

- [x] 1.1 Генерировать `errorId` в `logTechnicalFailure`, проверять формат в `ErrorIdSchema` и передавать его в
      `operation.defect.details`; реализует требование «Идентификатор ошибки в ответе на технический отказ» на тестовом
      API. Проверка: тесты хелпера проходят, включая игнорирование `traceparent`, `x-b3-traceid`, `b3` и новый
      `errorId` на каждый отказ.

  ```bash
  pnpm --filter @wishlist/api run test src/infra/errors/technical-failure.test.ts
  ```

- [x] 1.2 Сверить сценарий «Запрос без заголовков трассировки» с тестом
      `returns a safe 503 for 'password hasher overload'`, который проверяет формат `errorId`.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/handlers/auth.handlers.test.ts -t "password hasher overload"
  ```

- [x] 1.3 Сверить сценарии «Заголовок traceparent не влияет на errorId» и «Заголовок x-b3-traceid не попадает в ответ»
      с тестами `ignores an incoming 'traceparent' header` и `ignores an incoming 'x-b3-traceid' header`.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/handlers/auth.handlers.test.ts -t "ignores an incoming"
  ```

- [x] 1.4 Обновить ADR-0005: `errorId`, отвергнутый вариант с trace id и последствие для связи с трассами. Проверка: в
      ADR нет упоминаний `traceId`.

  ```bash
  grep -c traceId docs/adr/0005-technical-failure-logging-and-5xx-contract.md
  ```

## 2. Интеграционная проверка

- [x] 2.1 Типы, lint и полный набор тестов. Проверка: `check-types` без ошибок; `lint` без ошибок; полный прогон
      проходит везде, кроме `auth.me.test.ts`, где 5 тестов по-прежнему получают `500` из-за незавершённого
      `TODO(you) 1: authenticate`.

  ```bash
  pnpm --filter @wishlist/api check-types
  ```

  ```bash
  pnpm --filter @wishlist/api lint
  ```

  ```bash
  pnpm --filter @wishlist/api run test --no-file-parallelism
  ```
