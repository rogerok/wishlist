# Следующая `/learn`-сессия

## Точка продолжения

Следующий функциональный шаг — `learning/roadmap.md` → **1.1: `PasswordCredentialsRepository`**, insert/load чувствительной
credential-записи с точной error mapping. Пользовательское объяснение и самостоятельность оцениваются отдельно от
реализации: готовый AI-код не повышает mastery. В новой сессии backend mentoring активен по умолчанию; исключение возможно
только по явному отключению пользователем в этой новой сессии.

## Что уже завершено

На 2026-09-28 feedback loop работает, `0.8` локально измерен, `0.9–0.11` реализованы и функционально проверены.
`PasswordHasherLive` предоставляет `hash`/`verify` и собственную live randomness dependency. Лимиты: 2 active + 2 waiting,
сверх capacity — immediate overload; interruption не освобождает work permit до native callback.

Проверки этой сессии: API tests — 10 файлов / 74 теста, check-types — pass, целевой ESLint concurrency suite — без замечаний.
Hasher покрывают 10 concurrency tests и 3 real-scrypt behavior tests; три временные мутации пойманы, временные копии удалены.
Полная запись проверок и исторические измерения — в `progress.md`; актуальные измерения —
[benchmark record](../docs/auth/implementation-plan.md#benchmark-record).

## Адресные чтения перед `1.1`

1. `learning/progress.md`: checkpoint, открытые ограничения и mastery map.
2. `learning/roadmap.md`: статус Phase 0 и шаг `1.1`.
3. `docs/auth/implementation-plan.md`: `Persistence model` → `password_credentials`, `Effect design` → ответственности
   repositories и transaction boundary, `Implementation sequence` → `4. Implement repositories`.
4. `apps/api/src/infra/db/migrations/0002_auth.ts` и `apps/api/src/infra/db/generated/database.ts`: фактические constraints
   и типы credential-записи; generated файл не редактировать вручную.
5. `apps/api/src/modules/users/repository/users.repository.ts` и `users.repository.errors.ts` рядом: существующая
   конвенция Effect/Kysely repository и error mapping.

При разборе crypto boundary открывать только нужный файл в `apps/api/src/modules/auth/service/` и соответствующие tests
в `service/test/`; token tests теперь находятся в `service/test/session-token-generator.test.ts`.

## Что остаётся открытым

- `0.3`: отдельный deterministic token test должен доказать два обращения по 32 bytes. Known-vector и freshness tests
  существуют, но этот остаток не закрывают.
- Production memory budget не определён; локальные лимиты hasher не являются разрешением production rollout.
- Вопросы понимания Phase 0 не пройдены целиком; особенно native callback lifetime, Layer lifetime и bounded admission.
  Учебный разбор готового кода не требует повторной реализации hasher или ремонта уже исправленного Vitest setup.
- Auth repositories/use cases и live auth wiring ещё предстоят. Isolated contracts и готовые primitives не означают
  готовую Session authentication или полностью закрытую Phase 0.

## Граница следующего шага

`1.1` функционально завершён, когда insert/load credentials и точная error mapping проверены на PostgreSQL для success,
duplicate и invalid record, а обычный User query не раскрывает password hash. Самостоятельное объяснение repository
boundary фиксируется отдельно; после шага обновить `progress.md`, не приписывая mastery по наличию реализации.
