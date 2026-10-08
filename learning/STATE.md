# Состояние обучения

Обновлено: 2026-10-08

## Сейчас

Шаг: 1.8 — сборка Live Layer для всех auth handlers; сам запуск уже подтверждён smoke-сценарием 1.7.
Следующее действие: прочитать [разбор logout](lessons/0006-debrief-logout.html) и ответить на 3 вопроса → ответы сходятся с `<details>`.
Затем решить, что засчитать в 1.8 и 1.10: smoke 1.7 уже проверил запуск dist и cookie jar; вопросы понимания этих шагов открыты.

## Проверено

- 1.7 logout (582e26d): `auth.logout.test.ts` 11 из 11 — 204 без cookie/с битой/неизвестной/истекшей, удаляется только предъявленная Session, атрибуты cookie test/production, 503/500 без `Set-Cookie`, 2026-10-08.
- Smoke на `node dist/infra/bin/server.js` с PostgreSQL в контейнере и cookie jar: signup → login → logout → `/me` (старая cookie 401, вторая 200), повторный logout 204, без cookie 204; обрыв БД через прокси → logout, `/me`, login 503, Session на месте, cookie сохранена; повторный logout после восстановления 204. Сценарий удалён, 2026-10-08.
- Обрыв PostgreSQL до исправления давал 500 (`UnknownError`, `acquireConnection`); `isRetryableSqlFailure` теперь считает этапы `connect`/`acquireConnection` повторяемыми — таблица 13 из 13.
- Все тесты API — 23 файла, 180 passed, `--no-file-parallelism`; `check-types` без диагностик; `lint` exit 0, 2026-10-08.
- OpenSpec: `add-session-logout` и `classify-connection-failures-as-unavailable` в архиве; `openspec validate --specs --strict` 2 из 2.
- 1.6b `/me` (TODO 1–3 написал владелец): `auth.me.test.ts` 5 из 5 (93a3d64).
- Login: неизвестный email и неверный пароль → один 401, verify вызывается и для неизвестного email (92b068f).
- Повреждённый хеш → AuthDataIntegrityError, строки sessions не меняются; signup rollback при отказе Password Credential/конфликте digest.
- Срок Session на PostgreSQL: expiresAt − 1 мс → Some(session), равенство и +1 мс → None.

## Не проверено

- Остановленный сервер БД (`ECONNREFUSED`) — smoke воспроизвёл только обрыв (`ECONNRESET`); обрыв во время запроса (`execute`) остаётся 500.
- `lint`: в 21:40 полный прогон дал 32 предупреждения, позже стабильно 44 без изменений в конфиге и файлах; лишние 12 — `sonarjs(prefer-specific-assertions)` в нетронутых тестах. Причина не найдена.
- `/me` с просроченной Session по HTTP — есть только тест repository.
- `lessons/0005-debrief-oxlint.html` нет на диске и в git; вопросы 15–17 ссылаются на него.
- `0.3`: тест двух вызовов `randomBytes.get(32)`; production memory budget scrypt.
- OpenSpec `user-auth`: нет HTTP-теста несовпадения паролей signup; нет теста логов login; `/me` в спеке не описан.

## Заметки

- Logout — ката practice: владелец писал сервис и handler, агент — заготовку, тесты и smoke. Подсказки: `Redacted.value`, digest, `yield*` на `Result`, `mapTechnicalError`.
- Решения владельца: logout читает cookie сам (вариант A, optional middleware — при втором потребителе); отказ соединения классифицируется по `operation` библиотеки.
- Тесты: ступень 1 (чтение); проверки «сломай и предскажи» для logout предложены, не выполнены.
- Агент дважды трогал рабочие файлы владельца без проверки (`checkout`, случайный `stash`); всё восстановлено, правило записано в память агента.
