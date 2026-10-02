# Style: plain, concrete Russian

Applies to everything the agent writes for the user: chat, lessons, debriefs, `STATE.md`, plans. It sharpens the terminology rule from `AGENTS.md` (Agent Role) and adds shape and density. The structural rules adapt ASD-STE100 to Russian, about 80% strict.

## Targets

- **Established terms, not invented ones.** English terms that Russian-speaking backend developers really use stay as they are: rate limit, handler, payload, cookie, hash, endpoint, Layer, Schema, code identifiers, `CONTEXT.md` glossary terms. An ordinary English word or a descriptive phrase dressed up as a term becomes Russian: «дорогой расчёт хеша», not «expensive hashing»; «подбор пароля», not «online password guessing»; «занять всю память», not «resource exhaustion». Test: would a colleague say this English phrase aloud in a Russian conversation about the code? If not, say it in Russian.
- **One new idea per sentence, each with its example.** A threat, a mechanism, or a term gets its own sentence and a concrete scenario: who does what, what the system does in response.
- **Concrete first.** Each claim about a mechanism points to something observable: `file:line`, a value, a command and its output, a status code, a table row. The general term comes after the example.
- **One sentence, one claim**: subject → action → consequence. Instructions: up to 20 words, imperative, one action each. Descriptions: up to 25 words. Paragraphs: up to 6 sentences. Keep the subject and the verb in every sentence; split long sentences in two rather than compress them.
- **One word, one meaning.** Pick one term per concept (the glossary is `CONTEXT.md`) and keep it across the document.
- **Numbers over adjectives**: «~128 MiB на операцию», «503», «2 строки в БД».
- **Status once.** Verified and unverified facts live in `learning/STATE.md`. Other documents link there. Inside one document, uncertainties collect in a single «Не проверено» list at the end, one line each: what, and what it threatens.
- **Show, then interpret.** When structure carries the meaning, a code block, diagram, or table comes before the paragraph about it, and labels sit on the diagram itself.
- **Length budget**: chat answer — one screen unless the user asked for depth; debrief — 5 minutes; lesson — 10 minutes; `STATE.md` — 40 lines; kata `README.md` — 10 lines.

## Before → after

**Invented English terms** (the user's top complaint, lesson 0002). «Rate limit» is a real term and stays; «expensive hashing», «online password guessing», «resource-exhaustion» are descriptions posing as terms:

> Rate limit ставится до expensive hashing. Он защищает одновременно от online password guessing и resource-exhaustion DoS.

Becomes:

> Каждая попытка входа запускает scrypt: около 128 MiB памяти на сотни миллисекунд. Поэтому rate limit проверяет запрос до расчёта хеша. Лишний запрос получает 429, и scrypt для него не запускается.
>
> - **Подбор пароля.** Атакующий отправляет тысячи попыток входа в один аккаунт. Rate limit оставляет ему несколько попыток в минуту.
> - **DoS.** Атакующий шлёт поток запросов, чтобы занять всю память под scrypt. Rate limit отбрасывает поток раньше scrypt.

**Status spread with caveats** (it was repeated in six files):

> Производственные изменения выполнены: безопасные проекции users/auth, SQL-классификация и общий технический handler users. Auth handler покрыт девятью сценариями; check-types и целевой lint прошли. Полный Vitest suite, общий lint и Node/PostgreSQL smoke ещё не подтверждены.

Becomes one place, `STATE.md`:

```md
Шаг: R.5 — проверить приложение целиком.

## Проверено

- 9 тестов auth handler — `vitest auth.handlers.test.ts`, 2026-10-02.

## Не проверено

- Полный `pnpm test` и общий lint — регрессии в users могут быть незамечены.
```

**Abstract** (the user's own complaint):

> Backend должен различать ожидаемый отказ, defect, interruption и retry, иначе HTTP contract и cleanup становятся ложными.

Becomes concrete:

> `hasher.hash` в `auth.service.ts:96` завершается одним из четырёх способов. Вернёт hash — signup идёт дальше. Упадёт с `PasswordHashOverloadedError` — клиент получит 503. Бросит исключение синхронно — это дефект, клиент получит 500. Клиент оборвёт запрос, пока hash ждёт очереди, — ожидание отменится; если scrypt уже считает, расчёт дойдёт до конца (`Effect.uninterruptible`). Каждый исход — отдельная ветка и отдельный тест.

**Caveat in every paragraph**:

> Это наблюдение ревью, не подтверждение прохождения всех auth-сценариев.

Becomes one line in «Не проверено»: «Login/me/logout — маршруты закомментированы, сценарии не запускались».

## Final pass

Before saving or sending, reread each sentence and delete it when the reader loses nothing without it: restated status, a caveat already listed in «Не проверено», motivation («важно понимать, что…»), a recap of the previous paragraph. Rewrite any sentence that leans on an invented English term. Delete whole sentences rather than trimming words.
