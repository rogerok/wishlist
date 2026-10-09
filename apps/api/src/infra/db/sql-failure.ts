import { Predicate } from 'effect';
import { isSqlError, type SqlError } from 'effect/unstable/sql/SqlError';

const isRetryableSqlError = (error: SqlError) => {
  if (error.reason._tag === 'UnknownError') {
    return (
      error.reason.operation === 'acquireConnection' ||
      error.reason.operation === 'connect'
    );
  }
  return error.isRetryable;
};

// Повтор может помочь, если SQL-отказ временный (обрыв соединения, deadlock, таймаут).
// Принимает сам SqlError (например, begin/commit транзакции) или ошибку
// репозитория, которая держит SqlError в cause. У SqlError тоже есть cause —
// это его reason, поэтому сначала проверяем сам SqlError.

export const isRetryableSqlFailure = (error: unknown): boolean => {
  if (isSqlError(error)) {
    return (
      isRetryableSqlError(error) ||
      (isSqlError(error.cause) && isRetryableSqlError(error.cause))
    );
  }

  return (
    Predicate.hasProperty(error, 'cause') &&
    isSqlError(error.cause) &&
    isRetryableSqlError(error.cause)
  );
};
