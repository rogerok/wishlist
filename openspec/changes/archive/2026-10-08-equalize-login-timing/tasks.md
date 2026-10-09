# Tasks

Команды запускаются из корня репозитория.

## 1. Фиктивная проверка пароля

- [x] 1.1 Написать тесты сервиса для сценариев «Неизвестный email» и «User без Password Credential»: настоящий
      `PasswordHasher` обёрнут подсчётом вызовов `verify`; ожидается ровно 1 вызов, который завершился без ошибки, и
      `AuthInvalidCredentialsError`. Проверка: оба теста красные до изменения `auth.service.ts`, потому что `verify` не
      вызывается.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/service/auth.service.test.ts -t "password check"
  ```

- [x] 1.2 Считать фиктивный хэш при сборке `AuthServiceLive` и вызывать `verify` с ним, когда User или Password
      Credential не найден; реализует оба сценария требования «Проверка пароля при неизвестном email». Проверка: тесты из
      1.1 зелёные.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/service/auth.service.test.ts -t "password check"
  ```

- [x] 1.3 Сверить с HTTP-ответом: `AuthInvalidCredentialsError` по-прежнему даёт `401` с `code: AUTH_INVALID_CREDENTIALS`
      на неизвестный email. Проверка: тест `rejects an unknown email without creating a session` проходит.

  ```bash
  pnpm --filter @wishlist/api run test src/modules/auth/handlers/auth.login.test.ts -t "rejects an unknown email"
  ```

## 2. Интеграционная проверка

- [x] 2.1 Типы, lint и тесты auth. Проверка: `check-types` без ошибок; `lint` без ошибок; тесты auth проходят везде,
      кроме `auth.me.test.ts`, где 5 тестов по-прежнему падают из-за незавершённого `TODO(you) 1: authenticate`.

  ```bash
  pnpm --filter @wishlist/api check-types
  ```

  ```bash
  pnpm --filter @wishlist/api lint
  ```

  ```bash
  pnpm --filter @wishlist/api run test --no-file-parallelism src/modules/auth
  ```

- [x] 2.2 Повторить замер из proposal. Проверка: время login на неизвестный email и на неверный пароль отличается не
      больше чем на 20%.
