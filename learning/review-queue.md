# Очередь повторения

Правила — `.agents/skills/backend-mentoring/DEBRIEF.md#review-queue`. Коробки: 1 → 1 день, 2 → 3, 3 → 7, 4 → 16, 5 → 35.

| #   | Вопрос                                                                                                                            | Ответ                                                                             | Коробка | Показать   |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------- | ---------- |
| 1   | Пришло 20 signup одновременно, а hash перенесли внутрь транзакции. Что случится с остальными запросами к API?                     | [разбор signup, решение 1](lessons/0001-debrief-signup.html#d1)                   | 2       | 2026-10-06 |
| 2   | `sessionRepo.create` упал. Какие строки этого signup останутся в БД?                                                              | [разбор signup, решение 2](lessons/0001-debrief-signup.html#d2)                   | 2       | 2026-10-06 |
| 3   | В UsersRepository добавили ошибку `UserEmailTooLong`. Где и как ты об этом узнаешь?                                               | [разбор signup, решение 3](lessons/0001-debrief-signup.html#d3)                   | 1       | 2026-10-03 |
| 4   | В поиске Session заменили `>` на `>=`. Какой случай нового теста упадёт?                                                          | [срок сессии, решение 1](lessons/0002-debrief-session-expiry.html#d1)             | 1       | 2026-10-05 |
| 5   | `lookup` создан до истечения Session. После смены TestClock повторный `yield* lookup` увидит новое время?                         | [срок сессии, решение 2](lessons/0002-debrief-session-expiry.html#d2)             | 1       | 2026-10-05 |
| 6   | Локальный TestClock перевели на завтра. Что произойдёт с часами PostgreSQL и соседних тестов?                                     | [срок сессии, решение 3](lessons/0002-debrief-session-expiry.html#d3)             | 1       | 2026-10-05 |
| 7   | Password Credential не записался после INSERT User. Должен ли User остаться в таблице?                                            | [signup, транзакция](lessons/0001-debrief-signup.html#d2)                         | 1       | 2026-10-05 |
| 8   | Подмена возвращает PasswordCredentialsAlreadyExists. Может ли cause у AuthInternalError стать PasswordCredentialsRepositoryError? | [перевод ошибок signup](../apps/api/src/modules/auth/service/auth.service.ts#L47) | 1       | 2026-10-05 |
| 9   | Login всегда принимает любой пароль. Какой сценарий каты обнаружит это?                                                           | [ката login, решение 1](lessons/0003-kata-login.html#d1)                          | 1       | 2026-10-05 |
| 10  | Login выдал новую cookie, но не записал Session. Почему тест не пройдёт?                                                          | [ката login, решение 2](lessons/0003-kata-login.html#d2)                          | 1       | 2026-10-05 |
| 11  | Проверка упала после signup в кате. Почему следующий тест не должен получить 409 на тот же email?                                 | [ката login, решение 3](lessons/0003-kata-login.html#d3)                          | 1       | 2026-10-05 |
