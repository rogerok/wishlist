# Состояние обучения

Обновлено: 2026-10-08

## Сейчас

Шаг: 1.7 — logout: удалить текущую Session и истечь cookie; без cookie/неизвестная cookie → 204, сбой БД → 503.
Следующее действие: убрать 4 новых предупреждения lint в `auth.handlers.ts` и закоммитить 1.6b → `oxlint` показывает только 2 старых `no-nested-functions`.
Затем: решение по optional cookie для logout (handler читает cookie сам или отдельный middleware); OpenSpec `user-auth` пока без logout.

## Проверено

- 1.6b `/me` (TODO 1–3 написал владелец): `auth.me.test.ts` 5 из 5; все тесты API — 22 файла, 164 passed, `--no-file-parallelism`; `check-types` без диагностик, 2026-10-08.
- Effect 4.0.0-rc.108 без cookie передаёт middleware `Redacted("")` (`HttpApiBuilder.ts:506–509`); 401 даёт `AuthTokenSchema`.
- Группа `.middleware(...)` действует только на endpoint, добавленные до вызова (`HttpApiGroup.ts:90`); API-уровень — на все группы.
- Перегрузка hasher при login → AuthUnavailableError, строки sessions не меняются; тест владельца, коммит 5e5fbf4.
- Login: неизвестный email и неверный пароль → один 401, verify вызывается и для неизвестного email (92b068f).
- Настоящий Node server и PostgreSQL: health 200, signup 201, два login 200 с новыми cookies, без пароля/tokens в логах (smoke 2026-10-04, удалён).
- `auth.login.test.ts` 4 из 4 с проверкой точного числа Session (7a15f66); OpenSpec `user-auth`: Signup, Успешный вход, Неразличимый отказ.
- Повреждённый хеш → AuthDataIntegrityError, строки sessions не меняются; signup rollback при отказе Password Credential/конфликте digest.
- Срок Session на PostgreSQL: expiresAt − 1 мс → Some(session), равенство и +1 мс → None.
- Oxlint 1.80.0: lint обоих пакетов exit 0; `turbo run lint --force` → API 44 предупреждения, SQL 1, ошибок 0, 2026-10-04.

## Не проверено

- `/me` с просроченной Session по HTTP — roadmap требует 401; есть только тест repository.
- `/me` при `AuthDataIntegrityError`/`AuthInternalError` — HTTP-тест есть только для 503.
- `/me` и logout на настоящем Node server с cookie jar — шаг 1.10; запуск dist вместо tsx.
- `lessons/0005-debrief-oxlint.html` нет на диске и в git, а заметка ниже и вопросы 15–17 на него ссылаются.
- `0.3`: тест двух вызовов `randomBytes.get(32)`; production memory budget scrypt.
- Запас таймаута signup под нагрузкой: ранее timeout 5 с при параллельных smoke/typecheck.
- OpenSpec `user-auth`: нет HTTP-теста несовпадения паролей signup; нет теста логов login.

## Заметки

- 1.6b: агент сначала заполнил TODO сам по ошибке и откатил; владелец написал заново. Застревал на `catchTag({ AuthTechnicalError })`: тип принят за тег; подсказки — ступень 2 и прямой вопрос про `provideService`. Mastery не повышался.
- Правило доступа: группа = одно правило; гостевой просмотр wishlist — владелец выбрал middleware на отдельных endpoint.
- TestClock не меняет часы PostgreSQL; тест срока использует локальный TestClock.layer().
- [Разбор Oxlint](lessons/0005-debrief-oxlint.html): исходные JS-плагины, warning-only, вложенные конфиги, inputs Turbo.
- pnpm предупреждает о peer-диапазоне TypeScript <6.1 у Perfectionist при TS 7.0.2; smoke плагинов прошёл.
