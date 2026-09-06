# Mistakes and misconceptions

## Правило ведения

Подтверждённая ошибка добавляется только после наблюдаемого расхождения между предсказанием и результатом. Наличие незавершённого кода, TODO или незнакомой концепции само по себе не является ошибкой пользователя.

Для каждой подтверждённой записи использовать шаблон:

```text
Date:
Context / task:
My prediction:
Observed result:
Root cause in plain language:
Correction I made:
Verification:
Reusable rule:
Mastery concept affected:
```

## Confirmed mistakes

Пока нет. Начальная инициализация не превращает выводы из code review в утверждения о мышлении пользователя.

## Potential misconception to verify

### Effect creation может быть перепутан с Effect execution

- **Evidence:** `SessionTokenGeneratorLive` запрашивает `randomBytes.get(32)` внутри Layer construction, до создания поля `generate`.
- **Why verify:** если bytes станут захваченным значением, повторные `generate` могут переиспользовать credential.
- **Probe:** попросить предсказать число вызовов random source при одном построении Layer и двух запусках `generate`, затем доказать deterministic test.
- **Do not record as confirmed unless:** пользователь ожидает один и тот же lifetime или реализация фактически повторно использует bytes.

### Compile success может быть принят за рабочие tests

- **Evidence:** `check-types` проходит, но текущий `test` завершается на import error setup-файла до collection всех восьми suites.
- **Why verify:** type resolver и runtime module resolution проверяют разные свойства.
- **Probe:** попросить объяснить, почему TypeScript принимает declaration/import graph, а Vitest не находит конкретный runtime path.
- **Do not record as confirmed unless:** пользователь утверждает, что typecheck доказывает выполнение tests.

### Изолированный HttpApi contract может быть принят за live feature

- **Evidence:** auth API tests строят собственный `TestApi` и fake handlers; live `AppApi` подключает только Health и Users, `auth.module.ts` пуст.
- **Why verify:** contract tests доказывают status/schema encoding, но не wiring, DB, cookie и Layer graph.
- **Probe:** спросить, какой запрос к реально запущенному server сейчас достигнет auth handler.
- **Do not record as confirmed unless:** пользователь считает auth endpoint уже реализованным end-to-end.

### `Redacted` может быть принят за cryptographic protection

- **Evidence:** Session token schema использует `Schema.Redacted`; будущая граница будет хранить digest.
- **Why verify:** `Redacted` предотвращает случайное отображение, но значение остаётся раскрываемым процессом.
- **Probe:** попросить сравнить последствия утечки `Redacted` wrapper, raw token и DB digest.
- **Do not record as confirmed unless:** пользователь приписывает `Redacted` encryption/hashing свойства.

### Transaction может казаться обязательной для каждого repository write

- **Evidence:** в UsersRepository возле single-statement create есть TODO «нужна транзакция?».
- **Why verify:** один SQL statement уже atomic; transaction нужна для multi-statement invariant/use case, а не как церемониальный wrapper.
- **Probe:** сравнить Users create insert с будущим signup из трёх inserts.
- **Do not record as confirmed unless:** пользователь не может назвать дополнительный invariant/statement, требующий transaction.

### Application validation может быть принята за защиту от races

- **Evidence:** Schema validation развита хорошо; будущий Reservation invariant существует только в плане.
- **Why verify:** два валидных concurrent request могут оба пройти application check.
- **Probe:** попросить разыграть interleaving «check free → check free → insert → insert».
- **Do not record as confirmed unless:** пользователь предлагает только pre-check/process lock для single-active Reservation.

### Interruption Effect может быть принята за отмену native scrypt

- **Evidence:** `docs/auth/NOTES.md` оставляет native scrypt interruption как открытое решение.
- **Why verify:** public `crypto.scrypt` не предоставляет cancellation handle после submission.
- **Probe:** спросить, когда безопасно release execution permit: при interruption requester fiber или при callback.
- **Do not record as confirmed unless:** пользователь ожидает, что interruption прекращает native работу и освобождает её память.

### Command–Decider–Event может быть принят за обязательный Event Sourcing или архитектуру всего проекта

- **Evidence:** пользователь хочет попробовать паттерн и рассматривает переписывание проекта целиком, но пока не утверждает, что это обязательно.
- **Why verify:** Decider можно использовать как чистый domain module при хранении current state; глобальная миграция добавит interfaces и events даже в простой CRUD, где они не дают leverage.
- **Probe:** на Reservation lifecycle сравнить `decide/evolve` с прямыми transitions и спросить, какую caller complexity скрывает каждый вариант.
- **Do not record as confirmed unless:** пользователь считает event store обязательным либо применяет Decider к каждому module независимо от transition complexity.

## Observed project issues, not learning mistakes

- Vitest setup path сейчас не совпадает с фактическим расположением matcher module; это текущая незавершённая worktree change.
- `SessionTokenGenerator.generate` содержит unsafe placeholder и не является реализацией.
- `docs/auth/implementation-plan.md` имеет устаревший Current state относительно migration `0002_auth.ts`.

Эти пункты должны стать задачами или контекстом, но не записываться как misconceptions без ответа пользователя.
