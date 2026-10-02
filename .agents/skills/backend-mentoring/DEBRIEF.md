# Debrief and review queue

## Debrief

Written after the agent wrote project code: routine mode, an opt-out session, or a large worked example. It keeps what was built understood.

Write `learning/lessons/NNNN-debrief-<slug>.html` per [HTML-ARTIFACTS.md](HTML-ARTIFACTS.md); five minutes of reading.

- **Header**: what changed in one sentence; links to the files.
- **Exactly three decisions**: the three whose reversal would hurt most. Pick decisions, not descriptions: «hash до транзакции» qualifies, «создали сервис» does not. For each:
  - _Что_: `file:line` and a 3–10 line excerpt;
  - _Почему_: the concrete failure the alternative causes, with numbers, rows, or status codes;
  - _Цена_: what this choice costs.
- **One diagram** when the change involves a flow or a state.
- **Three retrieval questions**: each is a scenario that needs one decision to answer («X случилось — что будет в БД / какой статус?»). Answers sit in `<details>` and link back to their decision.

Done when reversing any listed decision would break something observable, and each question can be answered from the debrief without opening code. Then add the three questions to the queue.

## Review queue

`learning/review-queue.md`, one table, Leitner boxes:

```md
| #   | Вопрос     | Ответ                                                           | Коробка | Показать   |
| --- | ---------- | --------------------------------------------------------------- | ------- | ---------- |
| 1   | <сценарий> | [разбор signup, решение 1](lessons/0001-debrief-signup.html#d1) | 1       | 2026-10-03 |
```

- Intervals by box: 1 → next day, 2 → 3 days, 3 → 7, 4 → 16, 5 → 35.
- Correct in substance → next box. Wrong or «не помню» → box 1, show the answer and its link. Grade the idea, not the wording.
- Correct in box 5 → remove the row; it counts as mastery evidence for the concept in `learning/mastery.md`.
- Shown at session start (at most two due) and on request («повторение»).
