import { describe, expect, it } from '@effect/vitest';
import { Data, Result, Schema } from 'effect';
import {
  ConnectionError,
  SqlError,
  UniqueViolation,
} from 'effect/unstable/sql/SqlError';

import { describeErrorChain } from '#infra/logging/error-chain.js';

const sensitiveMarker = 'sensitive@example.test';

class ServiceUnavailableTestError extends Data.TaggedError(
  'ServiceUnavailableTestError',
)<{ readonly cause: unknown }> {}

class RepositoryTestError extends Data.TaggedError('RepositoryTestError')<{
  readonly cause: unknown;
  readonly operation: string;
}> {}

class InvalidRecordTestError extends Data.TaggedError(
  'InvalidRecordTestError',
)<{
  readonly cause: unknown;
  readonly id: string;
  readonly operation: string;
}> {}

class SelfReferencingTestError extends Data.TaggedError(
  'SelfReferencingTestError',
)<{ cause: unknown }> {}

const decodeFailure = (() => {
  const result = Schema.decodeUnknownResult(
    Schema.Struct({ email: Schema.String }),
  )({ email: sensitiveMarker.length });

  return Result.isFailure(result) ? result.failure : undefined;
})();

describe('describeErrorChain', () => {
  it('follows cause through a repository error into the SQL reason', () => {
    const error = new ServiceUnavailableTestError({
      cause: new RepositoryTestError({
        operation: 'create',
        cause: new SqlError({
          reason: new ConnectionError({
            cause: new Error(`connect failed for ${sensitiveMarker}`),
          }),
        }),
      }),
    });

    expect(describeErrorChain(error)).toEqual([
      { tag: 'ServiceUnavailableTestError' },
      { tag: 'RepositoryTestError', operation: 'create' },
      { tag: 'SqlError' },
      { tag: 'ConnectionError' },
    ]);
  });

  it('keeps operation of a SQL reason but drops its message and constraint', () => {
    const error = new SqlError({
      reason: new UniqueViolation({
        cause: new Error(sensitiveMarker),
        constraint: 'users_email_lower_unique_idx',
        message: `Key (email)=(${sensitiveMarker}) already exists`,
        operation: 'insert',
      }),
    });

    const chain = describeErrorChain(error);

    expect(chain).toEqual([
      { tag: 'SqlError' },
      { tag: 'UniqueViolation', operation: 'insert' },
    ]);
    expect(JSON.stringify(chain)).not.toContain(sensitiveMarker);
    expect(JSON.stringify(chain)).not.toContain('users_email_lower_unique_idx');
  });

  it('stops at a schema decoding error without copying record values', () => {
    const error = new InvalidRecordTestError({
      id: sensitiveMarker,
      operation: 'getById',
      cause: decodeFailure,
    });

    const chain = describeErrorChain(error);

    expect(chain).toEqual([
      { tag: 'InvalidRecordTestError', operation: 'getById' },
      { tag: 'SchemaError' },
    ]);
    expect(JSON.stringify(chain)).not.toContain(sensitiveMarker);
  });

  it('stops when cause is a plain string', () => {
    const error = new ServiceUnavailableTestError({ cause: sensitiveMarker });

    expect(describeErrorChain(error)).toEqual([
      { tag: 'ServiceUnavailableTestError' },
    ]);
  });

  it.each([
    { name: 'string', value: sensitiveMarker },
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
    { name: 'object without _tag', value: { cause: sensitiveMarker } },
    { name: 'non-string _tag', value: { _tag: 42 } },
    { name: 'plain Error', value: new Error(sensitiveMarker) },
  ])('returns an empty chain for $name', ({ value }) => {
    expect(describeErrorChain(value)).toEqual([]);
  });

  it('ignores a non-string operation', () => {
    expect(
      describeErrorChain({
        _tag: 'LooseError',
        operation: { sensitiveMarker },
      }),
    ).toEqual([{ tag: 'LooseError' }]);
  });

  it('stops at the depth limit on a cyclic cause', () => {
    const error = new SelfReferencingTestError({ cause: undefined });
    error.cause = error;

    expect(describeErrorChain(error)).toHaveLength(10);
  });
});
