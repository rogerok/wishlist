# Уровни владения

Единственный источник уровня по каждому паттерну. По нему `backend-mentoring` выбирает режим:
≤ 2 — new, 3 — practice, ≥ 4 — routine. Уровень растёт только по свидетельству: ката пройдена,
вопрос на вспоминание отвечен верно в двух разных сессиях, решение объяснено.

Шкала: 0 — не встречал; 1 — узнаю; 2 — могу объяснить с помощью; 3 — могу реализовать с помощью; 4 — самостоятельно; 5 —
объясняю, реализую, отлаживаю и сравниваю альтернативы.

Наличие кода не доказывает mastery. Оценки `2–3` ниже — рабочие гипотезы по коду и git history; их нужно подтвердить
самостоятельным объяснением и новой задачей.

| Концепция                                             |  Оценка | Основание                                          | Статус проверки                                                      |
| ----------------------------------------------------- | ------: | -------------------------------------------------- | -------------------------------------------------------------------- |
| strict TypeScript и ESM imports                       |       3 | строгие config, branded types, NodeNext imports    | Практика видна; самостоятельность не проверена                       |
| pnpm workspace/Turborepo                              |       2 | scripts и внутренние packages используются         | Trade-offs не проверены                                              |
| Effect `Effect.gen`, combinators, typed error channel |       3 | services/repositories/handlers и tests             | Failure/defect/interruption model не проверен целиком                |
| `Context.Service` и `Layer` composition               |       2 | Users/Health/DB Layers собраны                     | Lifetime и requirement reasoning требует проверки                    |
| Effect Schema boundary validation                     |       3 | transforms, brands, excess-property policy, tests  | Encode/decode boundary требует проверки                              |
| HttpApi contracts и Problem Details                   |       3 | Users/Auth contracts и middleware                  | Live auth wiring ещё отсутствует                                     |
| PostgreSQL DDL, FK, indexes, constraints              |       3 | две migrations и invariant tests                   | Concurrency design ещё не проверен                                   |
| Kysely queries и repository error mapping             |       3 | полный Users CRUD                                  | Transaction ownership и authorization scoping не проверены           |
| Vitest и example-based tests                          |       2 | 10 файлов / 74 теста проходят                      | Setup исправлен; самостоятельное объяснение test design не проверено |
| Property-based testing                                |       2 | один FastCheck invariant для passwordConfirm       | Generator/shrinking trade-offs не проверены                          |
| Session auth domain model                             |       3 | ката login пройдена с подсказками, 2026-10-04      | Me/logout и cookie-jar сценарий не реализованы                       |
| Password hash format parsing                          |       3 | parser/serializer и полный hasher с tests          | Самостоятельное объяснение native boundary не подтверждено           |
| Secure randomness и Session token digest              |       1 | generator реализован, known-vector/freshness tests | Остаток `0.3`: deterministic test двух обращений по 32 bytes         |
| Выравнивание времени ответа (timing side channel)     |       2 | faded example login T1/T2, 2026-10-08              | Объяснил выбор одного verify; вне login не применял                  |
| Async native callback/interruption semantics          |       1 | реализация, concurrency tests и mutation probe     | Самостоятельное понимание не проверено                               |
| Bounded concurrency/admission                         |       1 | локальные измерения, реализация и capacity tests   | Production budget и самостоятельное обоснование открыты              |
| Authentication vs authorization                       |       1 | auth ещё не защищает Users CRUD                    | Нужен вертикальный сценарий                                          |
| Aggregate/ownership modeling                          |       1 | отражено в product docs                            | Wishlist кода нет                                                    |
| Reservation concurrency/idempotency                   |       1 | ADR и plan                                         | Практики нет                                                         |
| Guest Session/transactional outbox                    |       1 | ADR и plan                                         | Практики нет                                                         |
| Object storage/SSRF/async import                      |       0 | только future plans                                | Не изучать до соответствующей проблемы                               |
| Multi-instance observability/scaling                  | unknown | код не даёт данных                                 | Только после законченного product path                               |
