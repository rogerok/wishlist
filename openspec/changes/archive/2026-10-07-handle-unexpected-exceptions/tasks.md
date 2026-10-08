# Tasks

Команды запускаются из корня репозитория.

## 1. Путь запроса в instance

- [x] 1.1 Разбирать путь в `toRequestPathname` без интерпретации начального `//` как host; поддерживает требования
      «Ответ на внутренний технический отказ» и «Ответ на временную недоступность» (`instance`, равный пути запроса).
      Проверка: таблица unit-тестов и запросы `//probe/probe-7`, `///probe/probe-7?x=1` к настоящему Node HTTP-серверу
      проходят.

  ```bash
  pnpm --filter @wishlist/api run test src/infra/errors/http-problem.test.ts src/infra/errors/technical-failure.test.ts -t "toRequestPathname|Node HTTP server"
  ```

## 2. Непредвиденные исключения

- [x] 2.1 Добавить `DefectBoundaryMiddleware` и общую `logTechnicalFailure`; реализует сценарии «Непредвиденное
      исключение при signup» и «Текст непредвиденного исключения содержит email» на тестовом API. Проверка: дефект даёт
      безопасный `500` с одной строкой `operation.failed`, типизированная ошибка не логируется повторно, отмена не
      становится `500`.

  ```bash
  pnpm --filter @wishlist/api run test src/infra/errors/technical-failure.test.ts -t "DefectBoundaryMiddleware"
  ```

- [x] 2.2 Подключить middleware к `AppApi` и сборкам тестов; сверить оба сценария на `POST /api/auth/signup` с тестом
      `returns a safe 500 for an unexpected exception`. Проверка: тест проходит; текст исключения не попадает ни в
      тело, ни в логи, ни в `console`.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/handlers/auth.handlers.test.ts -t "unexpected exception"
  ```

- [x] 2.3 Дополнить ADR-0005 обработкой дефектов и полем `kind`. Проверка: ADR описывает middleware для дефектов,
      отмену запроса и отсутствие повторного логирования.

## 3. Интеграционная проверка

- [x] 3.1 Типы, lint и полный набор тестов. Проверка: `check-types` без ошибок; `lint` без ошибок; полный прогон
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
