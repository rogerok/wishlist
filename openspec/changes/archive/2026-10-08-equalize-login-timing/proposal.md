# Proposal

## Why

Ответы `POST /api/auth/login` на неизвестный email и на неверный пароль совпадают байт в байт, но время различается в
~150 раз. Замер `auth.login` на PostgreSQL, по 7 запросов, 2026-10-08:

| Запрос                           | Время, мс |
| -------------------------------- | --------- |
| неизвестный email                | 0–2       |
| известный email, неверный пароль | 280–323   |

При неизвестном email сервис возвращает отказ сразу, а scrypt запускается только для существующего User. По времени
ответа можно узнать, зарегистрирован ли email.

## What Changes

- Если User с email не найден или у него нет Password Credential, login всё равно выполняет проверку пароля против
  фиктивного хэша и затем отвечает тем же `401 AUTH_INVALID_CREDENTIALS`.
- Фиктивный хэш считается один раз при сборке `AuthService`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `user-auth`: добавляется требование «Проверка пароля при неизвестном email».

## Impact

- Код: `apps/api/src/modules/auth/service/auth.service.ts`.
- Тесты: `apps/api/src/modules/auth/service/auth.service.test.ts`.
- Каждый login с неизвестным email теперь занимает слот `PasswordHasher` и ~300 мс scrypt, как login с неверным
  паролем.
- Зависимости и конфигурация не меняются.

Не входит в change:

- signup отвечает `409 USER_EMAIL_ALREADY_EXISTS` на занятый email, поэтому занятость email по-прежнему видна через
  signup;
- rate limit для login и signup.

Оба пункта остаются в этапе P0 «abuse and enumeration resistance» в `docs/auth/implementation-plan.md`.
