import type { Cause, Option, Result, Schema, SchemaIssue } from 'effect';

import 'vitest';

type FailureOf<T> =
  T extends Result.Result<unknown, infer Failure> ? Failure : never;

type SuccessOf<T> =
  T extends Result.Result<infer Success, unknown> ? Success : never;

type ValueOf<T> = T extends Option.Option<infer Value> ? Value : never;

type SchemaIssues = ReturnType<
  ReturnType<typeof SchemaIssue.makeFormatterStandardSchemaV1>
>['issues'];

declare module 'vitest' {
  interface Matchers<T> {
    /** Checks that the received Exit is a Failure. */
    toBeExitFailure(): void;
    /** Checks that the received Option is None. */
    toBeOptionNone(): void;
    /** Checks that the received Option is Some and its value matches the specified fields. */
    toBeOptionSome(expectedFields: Partial<ValueOf<T>>): void;
    /** Checks that a Result is a Failure of the given error class with matching fields. */
    toBeResultFailure<
      ErrorType extends Cause.YieldableError & FailureOf<T>,
      Args extends Array<unknown>,
    >(
      ErrorClass: new (...args: Args) => ErrorType,
      expectedFields: Partial<ErrorType>,
    ): void;

    /** Checks that a Result fails with SchemaError whose formatted issues match exactly. */
    toBeResultSchemaFailure(
      expectedIssues: FailureOf<T> extends Schema.SchemaError
        ? SchemaIssues
        : never,
    ): void;

    /** Checks that a Result is a Success whose value equals the expected value. */
    toBeResultSuccess(expected: SuccessOf<T>): void;
    /** Checks that an Exit is a Failure whose cause contains a Die reason. */
    toFailWithDie(): void;
    /** Checks that a Cause contains a Die reason. */
    toHaveDies(): void;
  }
}
