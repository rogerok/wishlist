# Proposal

## Why

Product plan требует у User одно обязательное Display Name вместо трёх необязательных полей `firstName`, `middleName`,
`lastName` и запрещает держать обе модели имени рядом (`docs/product/implementation-plan.md`, раздел «User and Public
Profile»). Сейчас signup принимает User совсем без имени, а Public Profile из Milestone 3 показывать будет нечего.

## What Changes

- **BREAKING** Тела запросов signup, `POST /api/users`, `PUT /api/users/:id` и все ответы с User содержат
  `displayName` вместо `firstName`, `middleName`, `lastName`. Внешних клиентов у API нет.
- `displayName` обязателен при signup и создании User: пробелы по краям удаляются, длина 1–100 символов.
- Миграция `0003` добавляет `users.display_name varchar(100) NOT NULL`, переносит в неё имена существующих User и
  удаляет три старые колонки.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `user-auth`: требования «Signup» и «Успешный вход» перечисляют `displayName` вместо трёх полей имени; добавляется
  требование «Обязательный Display Name при signup».

## Impact

- Миграция: `apps/api/src/infra/db/migrations/0003_display_name.ts`; заново сгенерированные типы Kysely.
- Код: схемы `signup`, `create-user`, `update-user`, `user-response`, `UsersRepository`, `AuthService`, генератор
  тестовых данных `users.fake.ts`.
- Тесты auth и users, где встречаются поля имени.
- Дата рождения User не добавляется: план её исключил, вместо неё у Wishlist будет Occasion Date.
