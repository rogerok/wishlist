# Session Authentication: с чего начать

Все учебные и технические материалы по Session-аутентификации собраны в этом каталоге.

## Первый маршрут

Не читай документы подряд. Иди так:

```text
MISSION.md
   ↓
lessons/0001-session-auth-mental-model.html
   ↓
reference/implementation-roadmap.html — только текущая фаза
   ↓
RESOURCES.md — только материалы текущей фазы
   ↓
самостоятельная реализация
   ↓
проверка критерия «Готово, когда»
   ↓
следующая фаза
```

## Документы

### [`MISSION.md`](./MISSION.md) — зачем это изучать

Короткая учебная цель, наблюдаемые критерии успеха, ограничения и темы вне текущей задачи. Прочитай один раз перед началом; возвращайся, если возникает желание добавить JWT, OAuth, MFA или лишние абстракции.

### [`lessons/0001-session-auth-mental-model.html`](./lessons/0001-session-auth-mental-model.html) — первый урок

Начальная точка. Урок объясняет состояния `User`, `Password Credential`, `Session` и переходы signup/login/me/logout до Effect-кода. Внутри три интерактивных вопроса.

Урок завершён, когда ты можешь объяснить:

1. почему User, Password Credential и Session — разные состояния;
2. почему Password Credential не связан с Session напрямую;
3. какие строки остаются после неуспешного signup;
4. почему второй login создаёт вторую Session;
5. почему logout не удаляет User или Password Credential.

### [`lessons/0002-bounded-password-hashing.html`](./lessons/0002-bounded-password-hashing.html) — безопасная конкурентность hashing

Пройти перед Phase 3. Урок объясняет memory budget scrypt, libuv worker pool, Effect Semaphore, ограничение ожидающей очереди, overload behavior и rate limiting всех endpoints, выполняющих password hash/verify.

### [`reference/implementation-roadmap.html`](./reference/implementation-roadmap.html) — основной рабочий маршрут

Держи открытым во время реализации. Девять фаз:

1. HttpApi и Schema-контракты;
2. PostgreSQL migration;
3. PasswordHasher и SessionTokenGenerator;
4. репозитории;
5. signup;
6. login;
7. security middleware и `/me`;
8. logout;
9. Layer composition и HTTP smoke test.

У каждой фазы есть вход, результат, запреты, последовательность действий, прямые материалы, репозитории для сравнения, тесты, ошибки и критерий завершения. Не переходи дальше, пока критерий текущей фазы не доказан.

### [`RESOURCES.md`](./RESOURCES.md) — curated manuals, статьи и репозитории

Это меню, а не книга для чтения подряд. Для текущей фазы найди строку в таблице «Материалы по фазам», прочитай manual и посмотри конкретные файлы указанного репозитория. Обязательно учитывай блоки «что перенять» и «что не копировать».

### [`implementation-plan.md`](./implementation-plan.md) — техническая спецификация

Source of truth для HTTP statuses, таблиц, индексов, cookie policy, crypto-инвариантов, Effect dependency graph, error contracts, тестовых сценариев и production-hardening backlog. Отвечает, **что должно получиться**; roadmap объясняет, **как к этому прийти**.

### [`research/primary-sources.md`](./research/primary-sources.md) — первичные источники

Нужен для точной проверки Effect API, PostgreSQL semantics, cookie behavior, OWASP/NIST требований и version caveats. Открывай, когда tutorial расходится с установленными типами или нужен нормативный источник.

### [`NOTES.md`](./NOTES.md) — настройки обучения

Фиксирует договорённость: backend-код пишешь ты; агент объясняет механику, проверяет гипотезы и помогает с конкретными препятствиями.

## Первый практический шаг

1. Открой [`lessons/0001-session-auth-mental-model.html`](./lessons/0001-session-auth-mental-model.html) в браузере.
2. Пройди вопросы и нарисуй три состояния.
3. Открой Phase 1 в `reference/implementation-roadmap.html`.
4. Прочитай только Effect v4 Quickstart и HttpApi Handlers, указанные в Phase 1.
5. Посмотри локальные примеры:

```text
apps/api/src/modules/users/api/users.api.ts
apps/api/src/modules/users/schemas/create-user.schema.ts
apps/api/src/modules/users/schemas/user-response.schema.ts
apps/api/src/modules/users/api/users.api.errors.ts
apps/api/src/errors/request-validation.test.ts
```

6. Спроектируй без handlers и PostgreSQL четыре контракта:

```text
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

Для каждого выпиши method, path, request Schema, success Schema/status и error Schemas/statuses.

## Канонические документы вне каталога

Два файла намеренно остаются в нормативных местах репозитория:

- [`../../CONTEXT.md`](../../CONTEXT.md) — общий доменный glossary проекта;
- [`../adr/0001-postgresql-backed-sessions.md`](../adr/0001-postgresql-backed-sessions.md) — архитектурное решение о PostgreSQL Sessions вместо JWT.

Их нельзя переносить сюда без нарушения принятого layout из `docs/agents/domain.md`.
