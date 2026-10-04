# Состояние обучения

Обновлено: 2026-10-04

## Сейчас

Шаг: 1.6b — middleware и `/me` (режим new): [урок 0004](lessons/0004-security-middleware.html).
Следующее действие: владелец заполняет TODO(you) 1–3 в `auth.handlers.ts` → 5 тестов `auth.me.test.ts` зелёные.
Эталон до вырезания пропусков: 5 из 5. Коммит WIP: эти 5 тестов красные намеренно, остальные зелёные.

## Проверено

- Ката 1.6a: 7 из 7; все тесты API — 17 файлов, 100 passed, `--no-file-parallelism`, 2026-10-04.
- Перегрузка hasher при login → AuthUnavailableError, строки sessions не меняются; тест владельца, коммит 5e5fbf4.
- `pnpm --filter @wishlist/api check-types` — без диагностик, 2026-10-04.
- Миграция: `pnpm exec oxlint --version` → 1.80.0; lint обоих пакетов → exit 0, 2026-10-04.
- `pnpm exec turbo run lint --force` → 2 задачи выполнены, API 44 предупреждения, SQL 1, ошибок 0; `--dry=json` включает общий конфиг.
- Smoke Oxlint: CRUD/fallback, object/union/import sorting и `--fix`; SonarJS 21/15, полный preset; test/SQL исключения, абсолютные staged-пути. Примеры удалены.
- Настоящий Node server и отдельная PostgreSQL: health 200, signup 201; неизвестный email и неверный пароль дают одинаковый 401 без cookie.
- Два login с cookie дают 200 и новые cookies; в БД один User, один Password Credential и три действующие Session; публичный ответ, без пароля/tokens в логах.
- Login smoke: `pnpm exec tsx .login-push-smoke.mts` из apps/api, 2026-10-04; сценарий удалён, сервер и контейнер остановлены.
- Четыре HTTP-теста каты проверяют отказы, cookie/Session, production Secure и сохранение старых Session.
- Повреждённый хеш → AuthInternalError с причиной PasswordCredentialsInvalidRecord; строки sessions не меняются. Signup rollback при отказе Password Credential/конфликте digest проходит.
- Срок Session на PostgreSQL: expiresAt − 1 мс → Some(session), равенство и +1 мс → None; тест и отдельный smoke прошли.

## Не проверено

- Технические отказы login: ошибки БД отдельно не проверены; me/logout и полный HTTP cookie-jar сценарий; запуск dist вместо tsx.
- `0.3`: точный тест двух вызовов `randomBytes.get(32)`; production memory budget scrypt; понимание Phase 0.
- Запас таймаута signup под нагрузкой: ранее timeout 5 с при параллельных smoke/typecheck; без них прогоны прошли.
- Интеграция Oxlint в редакторе не проверена; Vitest при миграции не запускался: `/me` намеренно незавершён.

## Заметки

- GetByEmail, login и HTTP-обработчик реализованы владельцем; подмена AuthService в signup-тестах дополнена login.
- Ката использует настоящий AuthService через HttpRouter.provideRequest; Web Request/Response не заменяют сетевой smoke.
- Контейнер каты освобождается после группы; зарегистрированный User удаляется при закрытии scope теста. Тесты: ступень 1 (чтение); rollback и повреждённые credentials с подсказками; mastery не повышался.
- TestClock не меняет часы PostgreSQL; тест срока использует локальный TestClock.layer(). В 1.2 repository проверяет срок по Clock (79d1a5c); владелец обосновал: те же часы выдают срок, решение в одном месте.
- [Разбор Oxlint](lessons/0005-debrief-oxlint.html): исходные JS-плагины, warning-only, вложенные конфиги, inputs Turbo; Prettier и Effect prepare не менялись.
- pnpm предупреждает о peer-диапазоне TypeScript <6.1 у зависимостей Perfectionist при TS 7.0.2; smoke плагинов прошёл. ESLint остаётся только транзитивной зависимостью совместимости.
