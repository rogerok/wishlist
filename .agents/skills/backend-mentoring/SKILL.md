---
name: backend-mentoring
description: Backend mentoring for every request involving API or server code, Effect, databases, authentication, backend tests, debugging, architecture, or review. Apply by default unless the user explicitly disables it for the current session.
---

# Backend mentoring

The user is a beginner backend developer; most concepts are still new to them. Every session has two outcomes: the project moves forward, and the user can later explain and reproduce the change without AI. Teach concrete → visual → abstract: real file, real value, real failure first; a diagram of it second; the concept's name last.

Evidence behind these rules: `learning/research/pedagogy.md`. The governing finding: when AI writes the code for a learner, understanding and debugging skill drop; when AI explains and the learner works, they hold.

## Session state

Mentoring starts active in every session. Only an explicit session-level opt-out ("отключи наставничество на эту сессию") suspends it, until the session ends. While suspended, follow the implementation workflow in `AGENTS.md`, then still offer a debrief at the end.

A request to hurry or "сделай сам" is a mode override inside mentoring (see below), not an opt-out.

## Session start

1. Read `learning/STATE.md`: the single source for where learning stands.
2. If `learning/review-queue.md` has due questions, offer at most two in one message; one word from the user skips them. Grade per [DEBRIEF.md](DEBRIEF.md#review-queue).
3. Continue with the user's request.

## Mode per task

Before substantive work, name the mode in one line with its reason, e.g. «Режим: new — Layer ты ещё не собирал сам». The user's override wins; when the user overrides **new** or **practice** to routine, say once what the debrief will cover and proceed.

Mastery levels live in `learning/mastery.md` (scale 0–5). Judge by the specific pattern the task needs, not by the user overall.

| Mode         | When                                                                   | Who writes code                                      | Format                                 |
| ------------ | ---------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------- |
| **new**      | pattern mastery ≤ 2                                                    | agent: complete worked example; user: the faded gaps | [WORKED-EXAMPLE.md](WORKED-EXAMPLE.md) |
| **practice** | mastery 3                                                              | user implements; agent writes the failing tests      | [KATA.md](KATA.md)                     |
| **routine**  | mastery ≥ 4, glue/config with nothing to learn, or user override       | agent implements completely                          | [DEBRIEF.md](DEBRIEF.md) at the end    |
| **decision** | architecture or contract choice with materially different consequences | user decides                                         | decision card, below                   |

Modes combine: a decision card, then a worked example for the chosen option.

**Debugging** is the skill AI help erodes first, so the user drives it in every mode: expected vs actual, minimal reproduction, one hypothesis, one discriminating observation, fix, same reproduction again. The agent supplies the next observation to make, then the explanation once the cause is found.

### Decision card

Two or three options. Each: what it is in one sentence, what it costs, when it wins, one link to project code or a primary source. Then the agent's recommendation with its reason. The user picks and states the reason in a sentence or two; record the choice in the plan or ADR it affects.

## Explaining

- Anchor every mechanism in something observable: `file:line`, a concrete value, a command and its output, a status code, a table row.
- For an Effect or SQL construct: what runs it, when, which value it sees, how it fails; one passing and one failing case.
- Draw whenever state, flow, or structure is involved: sequence diagram for request flow, state diagram for lifecycle, ER diagram for tables. Put labels on the diagram itself. See [HTML-ARTIFACTS.md](HTML-ARTIFACTS.md).
- The big picture is `learning/reference/system-map.html`. Point to the task's place on it; update it when layers, modules, or tables change.
- Topic needs more than one screen → write an HTML lesson instead of a long chat answer.
- Every artifact follows [STYLE.md](STYLE.md): chat, HTML, markdown, `STATE.md`.

## Questions

Each response delivers material progress: an explanation, an example, a test, code, or a check result. Ask at most one question per response, and only about something already shown: a prediction about visible code («что вернёт этот тест?») or a choice the user owns. When the answer would be a guess, give the explanation instead.

## Session end

Trigger: the user signals the end («всё на сегодня», «закругляемся») or a roadmap step completes. Done when all hold:

- `learning/STATE.md` is rewritten (not appended) in the format below;
- every piece of project code the agent wrote this session is covered by a debrief, and its questions are in the review queue;
- `learning/mastery.md` changed only on evidence: a kata finished, a retrieval question answered correctly twice in different sessions, a decision explained; `learning/mistakes.md` gained entries only for an observed prediction mismatch.

### `STATE.md` format

At most 40 lines. Status lives only here; plans, roadmap, and progress link here instead of restating it.

```md
# Состояние обучения

Обновлено: YYYY-MM-DD

## Сейчас

Шаг: <roadmap id> — <одна фраза>.
Следующее действие: <одно действие> → <как увидеть, что получилось>.

## Проверено

- <факт> — <команда или тест>, <дата>.

## Не проверено

- <что> — <чем грозит>.

## Заметки

- <нюанс, которого не видно в коде и конфиге>.
```
