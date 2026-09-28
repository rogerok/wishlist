# Teaching Notes

- Пользователь — начинающий backend-разработчик. Режим работы определяется `backend-mentoring`: по умолчанию код пишет пользователь; явное отключение наставничества действует только в текущей сессии.
- Нужен не каталог API reference, а маршрут обучения: качественный manual → конкретный чужой пример → локальное упражнение → наблюдаемая проверка.
- Для нового механизма сначала объяснять буквальную механику состояния, затем Effect-абстракцию.
- Каждый этап дробить до конкретных файлов, контрактов, ошибок, тестов и критерия остановки.
- Англоязычные материалы допустимы, если указаны конкретные главы/файлы и цель чтения.
- Effect 3, JWT, rolling-session и framework-specific примеры всегда маркировать как частично применимые.
- Не выдавать список ссылок за учебный план и не предлагать копировать чужую реализацию целиком.

## Неопределённости Phase 2 — PostgreSQL schema

Открытых неопределённостей Phase 2 сейчас нет. Принятые решения перенесены в `implementation-plan.md` и Phase 2 roadmap; при появлении нового неразрешённого вопроса он должен быть явно добавлен сюда как неопределённость, а не скрыто выбран в реализации.

## Неопределённости Phase 3 — Security primitives

### Принято

- Stored password hash имеет canonical format `$scrypt$v=1$N=131072,r=8,p=1$<salt-base64url>$<derived-key-base64url>`.
- Salt имеет ровно 16 random bytes; derived key — ровно 32 bytes.
- Salt и derived key кодируются canonical unpadded base64url. `v1` принимает только точный algorithm, version, field order, `N/r/p` и decoded lengths.
- `maxmem` не сохраняется в hash format: это runtime guard одной scrypt operation.
- Malformed/unsupported stored format становится typed integrity error до запуска crypto; well-formed mismatch возвращает `false`.
- Effect `Random` не используется для salt или Session token. Production randomness приходит из Node crypto.
- `Clock` не входит в Phase 3: в security primitives этой фазы нет времени или expiration.
- Native scrypt: выбран `Effect.callback` с `Effect.uninterruptible` только вокруг вычисления; ожидание разрешения можно отменить. Оба разрешения удерживаются до callback.
- Общий допуск для `hash` и `verify`: 2 вычисления + 2 ожидающих; внешний Semaphore имеет 4 разрешения и использует `withPermitsIfAvailable`, внутренний — 2 и `withPermits`. При заполнении — немедленный отказ без запуска scrypt.
- Ошибки: `PasswordHashIntegrityError` для повреждённого stored hash; `SecurePrimitiveUnavailableError` для callback failure и отказа `randomBytes` при допустимом размере; `PasswordHashOverloadedError` для полного допуска. Синхронный throw scrypt остаётся дефектом. Дефект сам по себе не завершает процесс.
- `SecureRandomBytes` остаётся внутренней зависимостью безопасности. `PasswordHasherLive` захватывает её при сборке и предоставляет Node Layer внутри себя; `SessionTokenGeneratorLive` принимает зависимость извне. Тесты hasher управляют Node callback через Vitest, сохраняя настоящий сервис и Semaphores.
- `maxmem=256 MiB`, локальные лимиты 2/2. Размер ожидающей очереди выбран как политика, не выведен из замеров. Методика, результаты и точные команды проверок — в [implementation-plan.md](./implementation-plan.md#benchmark-record).
- На 2026-09-28 реализация PasswordHasher проверена: полный API suite — 74 теста; ошибки, перегрузка и оба вида отмены покрыты постоянными тестами. Это не означает готовности всей авторизации или production-конфигурации.

### Открыто

1. **Production memory budget.** Не определены память deployment/container, резерв полного приложения и допустимая задержка очереди. Локальные 2 активных + 2 ожидающих не являются production approval; нужны повторные измерения под HTTP/DB-нагрузкой на целевой машине.
2. **Детерминированная свежесть Session token.** Есть known-vector и live-freshness tests, но ещё нет отдельного теста, доказывающего два запроса по 32 bytes и разные результаты при двух заданных наборах bytes (учебный шаг `0.3`).

Следующий функциональный шаг — `PasswordCredentialsRepository` (Phase 4 плана, шаг `1.1` учебного маршрута). Открытые пункты остаются видимыми: переход к репозиторию не означает формального завершения всех критериев Phase 3 или разрешения на production.
