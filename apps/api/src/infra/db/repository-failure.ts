import type { SqlError } from 'effect/unstable/sql/SqlError';

import { isRetryableSqlFailure } from '#infra/db/sql-failure.js';
import { OperationFailed } from '#infra/errors/operation-failed.js';

// SQL-отказ: временный (повтор может помочь) → unavailable, остальное → internal.
export const sqlOperationFailed =
  (source: string, operation: string) => (cause: SqlError) =>
    new OperationFailed({
      reason: isRetryableSqlFailure(cause) ? 'unavailable' : 'internal',
      source,
      operation,
      cause,
    });

// Строка из базы не прошла схему
export const invalidRecordFailed =
  (source: string, operation: string) => (cause: unknown) =>
    new OperationFailed({ reason: 'dataIntegrity', source, operation, cause });
