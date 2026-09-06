# Next `/learn` session

## Инструкция следующему агенту

Продолжай backend mentoring. Backend-код, tests и config редактирует пользователь; агент сначала объясняет одну границу, просит prediction только если он различает гипотезы, затем проверяет пользовательское изменение. Не показывай весь curriculum и не выдавай paste-ready implementation.

Перед началом прочитай только:

1. `learning/progress.md` — текущий checkpoint и provisional mastery;
2. `learning/roadmap.md`, только шаг `0.1`;
3. `vitest.config.ts`;
4. `src/infra/lib/matchers/matchers.ts`;
5. `src/infra/config/vitest.d.ts`.

После завершения `0.1` открой только следующий шаг `0.2`. До `0.3` не переходи к `SessionTokenGenerator`.

## Где мы сейчас

Проект — modular monolith на strict TypeScript/ESM, Effect 4 RC, Effect Platform, PostgreSQL и Kysely. Live application содержит Health и публичный Users CRUD. Auth contracts и database tables существуют, security primitives частично реализованы, live auth wiring отсутствует.

Текущая пользовательская worktree change добавляет custom Vitest matchers. Наблюдаемая проверка:

```text
pnpm --filter @wishlist/api check-types
→ pass

pnpm --filter @wishlist/api test
→ 8 failed suites, 0 tests collected
→ Cannot find module .../src/infra/lib/matchers.ts
```

`vitest.config.ts` указывает `./src/infra/lib/matchers.ts`, тогда как фактический runtime module находится в `src/infra/lib/matchers/matchers.ts`. Не исправляй это за пользователя.

## Что уже известно

По коду предположительно знакомы: `Effect.gen`, typed errors, Schema brands/transforms, HttpApi contracts, basic Layers, Kysely CRUD, migrations и Testcontainers. Самостоятельный mastery не подтверждён. Особенно не подтверждены Layer lifetime, runtime module resolution, interruption и bounded concurrency.

## Ближайшая концепция

**Test collection boundary и ESM module resolution.**

Почему нужна сейчас: test runner не доходит до behavior tests. Пока setup module не импортируется, любое изменение Session token/password logic остаётся без красно-зелёной обратной связи. Typecheck здесь недостаточен, потому что declaration/type graph и runtime file lookup — разные проверки.

## Первая маленькая задача пользователя

1. Своими словами предсказать, относительно какого корня Vitest разрешает `setupFiles` и какой фактический файл должен быть импортирован.
2. Самостоятельно сделать минимальное изменение только пути setup module; не менять matcher logic и tests.
3. Запустить сначала один узкий suite:

```bash
pnpm --filter @wishlist/api exec vitest run src/modules/auth/schemas/login/login.schema.test.ts --config vitest.config.ts
```

4. Если collection началась, запустить:

```bash
pnpm --filter @wishlist/api test
```

Ожидаемое наблюдение для завершения шага: ошибка `Cannot find module .../src/infra/lib/matchers.ts` исчезла, tests собираются. Новые behavior/type failures, если появятся, являются результатом следующего диагностического шага и не должны маскироваться.

## Проверка понимания после результата

Один вопрос: **почему `pnpm --filter @wishlist/api check-types` мог пройти, а Vitest упал до запуска первого теста?**

Шаг `0.1` завершён, когда пользователь связывает ответ с runtime path resolution, а не просто говорит «неверный путь».

## Следующая граница, но не текущая задача

После `0.1`: доказать, что custom matcher состоит из runtime registration (`expect.extend`) и TypeScript declaration merging (`vitest.d.ts`). Затем перейти к Effect execution/lifetime в `SessionTokenGenerator`.

Долгосрочное пожелание пользователя записано в Phase 6: попробовать Command–Decider–Event на Reservation lifecycle. Не вводить паттерн в текущую auth-задачу и не предлагать переписывание Users CRUD или Event Sourcing заранее.

Исследованные материалы BatSchool и будущие gated experiments находятся в `learning/platform-materials.md`. Не читать этот файл целиком в текущей сессии: открывать только запись, относящуюся к активному roadmap step. Статус урока «пройдено» означает exposure, а не подтверждённый mastery.

## Stop conditions

- Не переходить к auth repository/handlers, пока Phase 0 security primitives не завершены.
- Не считать auth готовым по isolated HttpApi tests.
- Не повышать mastery до 4–5 без самостоятельной реализации, диагностики и объяснения альтернатив.
- После каждого шага обновлять `progress.md`; подтверждённую misconception добавлять в `mistakes.md` только после наблюдаемого prediction mismatch.
