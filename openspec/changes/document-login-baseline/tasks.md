# Tasks

## 1. Сверка требований успешного входа и неразличимого отказа с существующими HTTP-тестами

Задачи не требуют реализации или изменения кода. Все тесты находятся в
`apps/api/src/modules/auth/handlers/auth.login.test.ts`; команды запускаются из корня репозитория. Завершение каждой
задачи означает, что утверждения сценария сверены с тестом и целевой прогон прошёл. Результаты раздела «Проверено» в
`learning/STATE.md` — исходные доказательства, а не результаты новых прогонов этих задач.

- [ ] 1.1 Сверить сценарий «Успешный вход» с тестом
      `returns the public user and a secure cookie backed by a new session`: `200`, совпадение тела с User из signup, поля
      `id`, `email`, `firstName`, `lastName`, `middleName`, новая Session и cookie, отсутствие пароля и значения cookie в
      теле; запустить тест командой ниже и проверить успешный результат.

  ```bash
  pnpm --filter @wishlist/api test src/modules/auth/handlers/auth.login.test.ts --no-file-parallelism -t 'returns the public user and a secure cookie backed by a new session'
  ```

- [ ] 1.2 Сверить сценарий «Неизвестный email» с тестом `rejects an unknown email without creating a session`: `401`,
      `application/problem+json`, `AUTH_INVALID_CREDENTIALS`, `status`, `instance` и отсутствие `Set-Cookie`; равенство тела
      с отказом при неверном пароле подтверждает тест
      `returns the same public error for a wrong password and an unknown email`. Запустить оба теста командой ниже и
      проверить успешный результат.

  ```bash
  pnpm --filter @wishlist/api test src/modules/auth/handlers/auth.login.test.ts --no-file-parallelism -t 'unknown email'
  ```

- [ ] 1.3 Сверить сценарий «Неверный пароль без раскрытия существования User — защита от перебора email (enumeration)» с
      тестом `returns the same public error for a wrong password and an unknown email`: `401`, `application/problem+json`,
      полное равенство тел двух отказов и отсутствие `Set-Cookie`; запустить тест командой ниже и проверить успешный
      результат.

  ```bash
  pnpm --filter @wishlist/api test src/modules/auth/handlers/auth.login.test.ts --no-file-parallelism -t 'returns the same public error for a wrong password and an unknown email'
  ```

- [ ] 1.4 Сверить сценарий «Повторный вход сохраняет предыдущие Session»
      с тестом `creates fresh concurrent sessions instead of reusing the presented cookie`:
      ровно одна действующая Session после signup; первый успешный вход как предыстория;
      ровно две действующие Session перед повторным входом; ответ `200`,
      новая Session и новая cookie после повторного запроса; сохранение Session
      от signup и первого входа без отзыва и изменений; ровно три действующие Session
      в результате. Запустить тест командой ниже и проверить успешный результат.

  ```bash
  pnpm --filter @wishlist/api test src/modules/auth/handlers/auth.login.test.ts --no-file-parallelism -t 'creates fresh concurrent sessions instead of reusing the presented cookie'
  ```

- [ ] 1.5 Сверить сценарий «Атрибуты cookie в production» с тестом
      `returns the public user and a secure cookie backed by a new session`, где приложение запускается в production:
      `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api`, `Max-Age=604800`; запустить тест командой ниже и проверить успешный
      результат. Этот тест также подтверждает сценарий 1.1, поэтому один успешный прогон может служить доказательством обеих
      сверок.

  ```bash
  pnpm --filter @wishlist/api test src/modules/auth/handlers/auth.login.test.ts --no-file-parallelism -t 'returns the public user and a secure cookie backed by a new session'
  ```
