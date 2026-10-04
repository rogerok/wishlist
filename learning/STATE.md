# Состояние обучения

Обновлено: 2026-10-04

## Сейчас

Шаг: 1.5 — login реализован; HTTP-сценарии и тест повреждённых credentials проходят.
Следующее действие: владелец пишет тест перегрузки hasher при login → AuthUnavailableError без изменения сессий.
Задание и разбор: [ката login](lessons/0003-kata-login.html).
Команда: `pnpm --filter @wishlist/api exec vitest run --config vitest.config.ts src/modules/auth/service/auth.service.test.ts`.

## Проверено

- Перед коммитами: `pnpm --filter @wishlist/api exec vitest run --config vitest.config.ts --no-file-parallelism` — 16 файлов, 92 passed, 2026-10-04.
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

- Технические отказы login: перегрузка hasher и ошибки БД пока отдельно не проверены.
- Me/logout и полный HTTP cookie-jar сценарий; запуск собранного dist вместо tsx.
- `0.3`: точный тест двух вызовов `randomBytes.get(32)`; production memory budget scrypt; понимание Phase 0.
- Запас таймаута signup-теста под нагрузкой: ранее был timeout 5 с при параллельных smoke/typecheck; без них прогоны прошли.

## Заметки

- GetByEmail, login и HTTP-обработчик реализованы владельцем; подмена AuthService в signup-тестах дополнена login.
- Ката использует настоящий AuthService через HttpRouter.provideRequest; её Web Request/Response не заменяют сетевой smoke.
- Общий контейнер каты освобождается после группы; каждый зарегистрированный User удаляется при закрытии scope теста.
- Тесты: ступень 1 (чтение); rollback и повреждённые credentials написаны с подсказками; mastery не повышался.
- TestClock не меняет часы PostgreSQL; тест срока использует локальный TestClock.layer().
