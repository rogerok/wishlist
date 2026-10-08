# Design

Решение описано в [ADR-0005](../../../../docs/adr/0005-technical-failure-logging-and-5xx-contract.md). Здесь — только
расположение кода.

- `infra/errors/defect-boundary.ts` — `DefectBoundaryMiddleware`: подключается к `AppApi` последним и через
  `Effect.catchDefect` перехватывает только дефекты; пишет строку `operation.failed` с `kind: defect`, `module` из
  идентификатора группы и `operation` из идентификатора эндпоинта.
- `infra/errors/technical-failure.ts` — `logTechnicalFailure`: общая запись лога для типизированных отказов
  (`kind: failure`) и дефектов.
- `infra/errors/http-problem.ts` — `toRequestPathname`: строка, начинающаяся с `/`, считается путём (так её отдаёт
  Node-адаптер); абсолютный URL веб-адаптера разбирается через `URL`.
