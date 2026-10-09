# Tasks

Команды запускаются из корня репозитория.

## 1. Миграция

- [x] 1.1 Тест миграции: применить `0001` и `0002`, вставить 4 строки старого вида (три поля, только имя и фамилия, без
      имён, имя длиннее 100 символов), применить `0003`; ожидаются `'Ada King Lovelace'`, `'Ada Lovelace'`, `'User'` и
      строка из 100 символов, а колонок `first_name`, `middle_name`, `last_name` нет. Проверка: тест красный до
      появления `0003`.

  ```bash
  pnpm --filter @wishlist/api run test src/infra/db/migrations/display-name.migration.test.ts
  ```

- [x] 1.2 Написать `0003_display_name.ts` (владелец). Проверка: тест из 1.1 зелёный.

  ```bash
  pnpm --filter @wishlist/api run test src/infra/db/migrations/display-name.migration.test.ts
  ```

- [x] 1.3 Применить миграцию к локальной БД и заново сгенерировать типы Kysely. Проверка: `db:check` без расхождений.

  ```bash
  pnpm --filter @wishlist/api db:migrate
  ```

  ```bash
  pnpm --filter @wishlist/api db:check
  ```

## 2. Контракт

- [x] 2.1 Заменить три поля имени на `displayName` в схемах, `UsersRepository`, `AuthService`, `users.fake.ts` и тестах;
      реализует сценарии «Успешный signup», «Успешный вход» и «Display Name из одних пробелов». Проверка: тесты auth и
      users проходят.

  ```bash
  pnpm --filter @wishlist/api run test --no-file-parallelism src/modules
  ```

## 3. Интеграционная проверка

- [x] 3.1 Типы, lint, полный прогон. Проверка: `check-types` без ошибок, `lint` без ошибок, все тесты проходят, в `src`
      нет `firstName`, `middleName`, `lastName`, `first_name` вне миграций и вызовов API faker в `users.fake.ts`.

  ```bash
  pnpm --filter @wishlist/api check-types
  ```

  ```bash
  pnpm --filter @wishlist/api lint
  ```

  ```bash
  pnpm --filter @wishlist/api run test --no-file-parallelism
  ```

  ```bash
  grep -rnE "firstName|middleName|lastName|first_name" apps/api/src --include=*.ts --exclude-dir=migrations | grep -v "users.fake.ts"
  ```
