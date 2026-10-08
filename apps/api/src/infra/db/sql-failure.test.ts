import { describe, expect, it } from '@effect/vitest';
import { Data } from 'effect';
import {
  ConnectionError,
  SqlError,
  UnknownError,
} from 'effect/unstable/sql/SqlError';

import { isRetryableSqlFailure } from '#infra/db/sql-failure.js';

class RepositoryTestError extends Data.TaggedError('RepositoryTestError')<{
  readonly cause: unknown;
}> {}

const retryableSqlError = new SqlError({
  reason: new ConnectionError({ cause: new Error('connection reset') }),
});
const permanentSqlError = new SqlError({
  reason: new UnknownError({ cause: new Error('syntax') }),
});

describe('isRetryableSqlFailure', () => {
  it.each([
    { name: 'a retryable SqlError', error: retryableSqlError, expected: true },
    { name: 'a permanent SqlError', error: permanentSqlError, expected: false },
    {
      name: 'a repository error wrapping a retryable SqlError',
      error: new RepositoryTestError({ cause: retryableSqlError }),
      expected: true,
    },
    {
      name: 'a repository error wrapping a permanent SqlError',
      error: new RepositoryTestError({ cause: permanentSqlError }),
      expected: false,
    },
    {
      name: 'a repository error without a SqlError',
      error: new RepositoryTestError({ cause: 'connection reset' }),
      expected: false,
    },
    {
      name: 'a SqlError reason outside SqlError',
      error: new ConnectionError({ cause: new Error('connection reset') }),
      expected: false,
    },
    { name: 'a string', error: 'connection reset', expected: false },
    { name: 'null', error: null, expected: false },
  ])('returns $expected for $name', ({ error, expected }) => {
    expect(isRetryableSqlFailure(error)).toBe(expected);
  });
});
