import { Predicate } from 'effect';
import { isSqlError } from 'effect/unstable/sql/SqlError';

// Повтор может помочь, если SQL-отказ временный (обрыв соединения, deadlock, таймаут).
// Принимает сам SqlError (например, begin/commit транзакции) или ошибку
// репозитория, которая держит SqlError в cause. У SqlError тоже есть cause —
// это его reason, поэтому сначала проверяем сам SqlError.
export const isRetryableSqlFailure = (error: unknown): boolean => {
  if (isSqlError(error)) {
    return error.isRetryable;
  }

  return (
    Predicate.hasProperty(error, 'cause') &&
    isSqlError(error.cause) &&
    error.cause.isRetryable
  );
};
