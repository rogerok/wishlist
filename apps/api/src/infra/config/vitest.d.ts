import type { Cause, Result, Schema, SchemaIssue } from 'effect';

import 'vitest';

type FailureOf<T> =
  T extends Result.Result<unknown, infer Failure> ? Failure : never;

type SuccessOf<T> =
  T extends Result.Result<infer Success, unknown> ? Success : never;

type SchemaIssues = ReturnType<
  ReturnType<typeof SchemaIssue.makeFormatterStandardSchemaV1>
>['issues'];

declare module 'vitest' {
  interface Matchers<T> {
    toBeExitFailure(): void;
    toBeResultFailure<
      ErrorType extends Cause.YieldableError & FailureOf<T>,
      Args extends Array<unknown>,
    >(
      ErrorClass: new (...args: Args) => ErrorType,
      expectedFields: Partial<ErrorType>,
    ): void;

    toBeResultSchemaFailure(
      expectedIssues: FailureOf<T> extends Schema.SchemaError
        ? SchemaIssues
        : never,
    ): void;

    toBeResultSuccess(expected: SuccessOf<T>): void;
    toFailWithDie(): void;
    toHaveDies(): void;
  }
}
