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
- `pnpm --filter @wishlist/api lint` — 0 ошибок, 8 предупреждений: вложенность handlers и Schema, используемая только как тип, 2026-10-04.
- Настоящий Node server и отдельная PostgreSQL: health 200, signup 201; неизвестный email и неверный пароль дают одинаковый 401 без cookie.
- Два login с предъявленной cookie дают 200 и новые cookies; в БД один User, один Password Credential и три действующие Session.
  Ответ содержит публичного User; пароля и tokens нет в логах процесса. Проверено 2026-10-04.
  Команда: `pnpm exec tsx .login-push-smoke.mts` из apps/api; временный сценарий удалён, сервер и контейнер остановлены.
- Четыре HTTP-теста каты проверяют отказы, cookie/Session, production Secure и сохранение старых Session.
- Повреждённый хеш даёт AuthInternalError с причиной PasswordCredentialsInvalidRecord; строки sessions не меняются.
- Signup и откат при отказе Password Credential/конфликте digest Session проходят.
- Срок Session на PostgreSQL: expiresAt − 1 мс → Some(session), равенство и +1 мс → None; тест и отдельный smoke прошли.

## Не проверено

- Технические отказы login: ошибки БД отдельно не проверены.
- Me/logout и полный HTTP cookie-jar сценарий; запуск собранного dist вместо tsx.
- `0.3`: точный тест двух вызовов `randomBytes.get(32)`; production memory budget scrypt; понимание Phase 0.
- Запас таймаута signup-теста под нагрузкой: ранее был timeout 5 с при параллельных smoke/typecheck; без них прогоны прошли.

## Заметки

- GetByEmail, login и HTTP-обработчик реализованы владельцем; подмена AuthService в signup-тестах дополнена login.
- Ката использует настоящий AuthService через HttpRouter.provideRequest; её Web Request/Response не заменяют сетевой smoke.
- Общий контейнер каты освобождается после группы; каждый зарегистрированный User удаляется при закрытии scope теста.
- Тесты: ступень 1 (чтение); rollback и повреждённые credentials написаны с подсказками; mastery не повышался.
- TestClock не меняет часы PostgreSQL; тест срока использует локальный TestClock.layer().
- 1.2: срок проверяет repository по `Clock` (коммит 79d1a5c). Владелец обосновал: те же часы выдают срок, решение в одном месте.
