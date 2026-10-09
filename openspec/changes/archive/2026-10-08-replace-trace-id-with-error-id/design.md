# Design

Решение описано в [ADR-0005](../../../../docs/adr/0005-technical-failure-logging-and-5xx-contract.md).

- `infra/errors/technical-failure.ts` — `logTechnicalFailure` генерирует `errorId` через `randomBytes(16)` из
  `node:crypto` и пишет его в лог и в поля ответа; `Effect.currentSpan` больше не читается.
- `infra/errors/technical-http-errors.ts` — `ErrorIdSchema` проверяет формат `^[0-9a-f]{32}$`.
