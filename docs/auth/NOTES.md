# Teaching Notes

- Пользователь — начинающий backend-разработчик и будет писать auth-код самостоятельно.
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

### Открыто

1. **Native scrypt и interruption.** Public Node `crypto.scrypt` нельзя отменить после отправки в libuv. Рекомендованный первый вариант — interruptible admission wait и uninterruptible native region до callback; альтернатива — отдельный supervised lifetime, удерживающий capacity после немедленного interruption requester fiber. До concurrency-кода нужно выбрать один вариант.
2. **Memory и concurrency budget.** После benchmark зафиксировать `maxmem`, `maxConcurrentHashes` и `maxWaitingHashes`. Значения нельзя выбирать только из `UV_THREADPOOL_SIZE` или количества CPU cores.
3. **Bounded admission policy.** Рекомендованный вариант — admission Semaphore с capacity `maxConcurrentHashes + maxWaitingHashes`, `withPermitsIfAvailable` и немедленный typed overload при заполнении; execution Semaphore отдельно ограничивает active native work. Нужно принять capacity и ожидание/отказ после измерений.
4. **Typed error taxonomy.** Нужно зафиксировать точные tags и service signatures для integrity failure, native crypto/random failure и hashing overload. Error payload не содержит password, stored hash, raw Session token, salt или derived key.
5. **Randomness test seam.** Рекомендован один минимальный secure-random-bytes service для PasswordHasher salt и SessionTokenGenerator с live Node Layer и deterministic test Layer. Перед второй итерацией нужно подтвердить, что seam остаётся внутренней security dependency, а не отдельной абстракцией общего назначения.

После решения каждого пункта перенести его в `implementation-plan.md` и Phase 3 roadmap, затем удалить пункт из списка открытых. Phase 3 нельзя считать завершённой, пока раздел «Открыто» не пуст.
