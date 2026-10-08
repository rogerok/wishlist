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

### 2026-10-04 — повторный `Effect.provide` вернул уже собранный сервис

```text
Date: 2026-10-04
Context / task: тест перегрузки hasher при login, auth.service.test.ts.
My prediction: Effect.provide(AuthServiceLive.pipe(Layer.provide(overloadedHasher))) внутри теста соберёт новый AuthService.
Observed result: login прошёл успешно; overloadedAuth === auth.
Root cause in plain language: внутренний provide наследует таблицу собранных слоёв внешнего и находит AuthServiceLive по ссылке.
Correction I made: сначала Layer.fresh, затем один слой overloadedAuthLayer на весь тест.
Verification: 5 из 5 тестов auth.service.test.ts; причина воспроизведена отдельным сценарием с сервисами A и B.
Reusable rule: один тест — один набор слоёв; подменённая зависимость входит в слой теста, а не во второй provide.
Mastery concept affected: Context.Service и Layer composition.
```

### 2026-10-04 — поиск сессии по сырым байтам token

```text
Date: 2026-10-04
Context / task: ката 1.6a, AuthService.authenticate.
My prediction: getByTokenDigest(decodedCred) найдёт сессию, выданную при signup; «что-то не то кладу в session».
Observed result: тест 5 падал — None, хотя signup записал сессию; signup при этом был верным.
Root cause in plain language: в sessions хранится sha256 байтов token, а поиск шёл по самим байтам; tokenGenerator.generate создаёт новый token, а не хеширует присланный.
Correction I made: общая функция digestSessionToken(bytes) в генераторе и в authenticate.
Verification: ката 7 из 7; все тесты API 100 passed.
Reusable rule: значение, которое пишется в БД и ищется в ней, вычисляет одна функция; сверяй путь одного значения по шагам.
Mastery concept affected: Secure randomness и Session token digest.
```

### 2026-10-08 — при переходе на один `verify` осталась старая копия

```text
Date: 2026-10-08
Context / task: equalize-login-timing, пропуск T2 в AuthService.login.
My prediction: «исправил на каноничный пример» — в login одна проверка пароля.
Observed result: тесты «runs one password check…» красные: expected [ false, false ] to have a length of 1 but got 2.
Root cause in plain language: общий verify добавлен до развилки, а прежний verify в ветке отказа не удалён; отказ проходил 2 scrypt.
Correction I made: удалил verify из ветки отказа; в login один вызов hasher.verify.
Verification: auth.service.test.ts 9 из 9.
Reusable rule: переносишь логику в одно место — найди и удали все старые копии (поиск по имени вызова) и посчитай вызовы на каждой дороге.
Mastery concept affected: Выравнивание времени ответа.
```

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
