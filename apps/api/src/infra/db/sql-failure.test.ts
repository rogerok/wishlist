import { describe, expect, it } from '@effect/vitest';
import { Data } from 'effect';
import {
  AuthenticationError,
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

const unknownAt = (operation: string) =>
  new SqlError({
    reason: new UnknownError({
      cause: new Error('Connection terminated unexpectedly'),
      operation,
    }),
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
    {
      name: 'an unknown failure while acquiring a connection',
      error: unknownAt('acquireConnection'),
      expected: true,
    },
    {
      name: 'an unknown failure while connecting',
      error: unknownAt('connect'),
      expected: true,
    },
    {
      name: 'a repository error wrapping an unknown acquireConnection failure',
      error: new RepositoryTestError({ cause: unknownAt('acquireConnection') }),
      expected: true,
    },
    {
      name: 'an unknown failure while executing a statement',
      error: unknownAt('execute'),
      expected: false,
    },
    {
      name: 'an authentication failure while acquiring a connection',
      error: new SqlError({
        reason: new AuthenticationError({
          cause: new Error('password authentication failed'),
          operation: 'acquireConnection',
        }),
      }),
      expected: false,
    },
    { name: 'a string', error: 'connection reset', expected: false },
    { name: 'null', error: null, expected: false },
  ])('returns $expected for $name', ({ error, expected }) => {
    expect(isRetryableSqlFailure(error)).toBe(expected);
  });
});
