import { expect } from '@effect/vitest';
import { Cause, Exit, Option, Result, Schema, SchemaIssue } from 'effect';

const formatSchemaIssues = SchemaIssue.makeFormatterStandardSchemaV1();

expect.extend({
  /** Checks that an Option is Some and its value matches the specified fields. */
  toBeOptionSome(received: unknown, expectedFields: unknown) {
    if (!Option.isOption(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Option.Some',
        message: () =>
          [
            'Expected received value to be an Option',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    if (!Option.isSome(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Option.Some',
        message: () =>
          [
            'Expected Option.Some, but received Option.None',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    const pass = this.equals(received.value, expectedFields, [
      ...this.customTesters,
      this.utils.iterableEquality,
      this.utils.subsetEquality,
    ]);

    return {
      pass,
      actual: received.value,
      expected: expectedFields,
      message: () =>
        pass
          ? [
              'Expected Option value not to match:',
              this.utils.printExpected(expectedFields),
              'Received:',
              this.utils.printReceived(received.value),
            ].join('\n')
          : [
              'Expected Option value to match:',
              this.utils.printExpected(expectedFields),
              'Received:',
              this.utils.printReceived(received.value),
            ].join('\n'),
    };
  },
});

expect.extend({
  /** Checks that an Option is None. */
  toBeOptionNone(received: unknown) {
    if (!Option.isOption(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Option.None',
        message: () =>
          [
            'Expected received value to be an Option',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    const pass = Option.isNone(received);

    return {
      pass,
      actual: received,
      expected: 'Option.None',
      message: () =>
        pass
          ? [
              'Expected Option not to be None',
              `Received: ${this.utils.printReceived(received)}`,
            ].join('\n')
          : [
              'Expected Option.None, but received Option.Some',
              `Received: ${this.utils.printReceived(received)}`,
            ].join('\n'),
    };
  },
});

expect.extend({
  /** Checks a Result failure's error class and selected fields. */
  toBeResultFailure<
    ErrorType extends Cause.YieldableError,
    Args extends Array<unknown>,
  >(
    received: unknown,
    ErrorClass: new (...args: Args) => ErrorType,
    expectedFields: Partial<ErrorType>,
  ) {
    if (!Result.isResult(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Result.Failure',
        message: () =>
          [
            'Expected received value to be a Result',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    if (!Result.isFailure(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Result.Failure',
        message: () =>
          [
            'Expected Result.Failure, but received Result.Success',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    if (!(received.failure instanceof ErrorClass)) {
      return {
        pass: false,
        actual: received.failure,
        expected: ErrorClass,
        message: () =>
          [
            'Expected Result failure to be an instance of:',
            this.utils.printExpected(ErrorClass),
            'Received:',
            this.utils.printReceived(received.failure),
          ].join('\n'),
      };
    }

    const pass = this.equals(received.failure, expectedFields, [
      ...this.customTesters,
      this.utils.iterableEquality,
      this.utils.subsetEquality,
    ]);

    return {
      pass,
      actual: received.failure,
      expected: expectedFields,
      message: () =>
        pass
          ? [
              'Expected Result failure not to match:',
              this.utils.printExpected(expectedFields),
              'Received:',
              this.utils.printReceived(received.failure),
            ].join('\n')
          : [
              'Expected Result failure to match:',
              this.utils.printExpected(expectedFields),
              'Received:',
              this.utils.printReceived(received.failure),
            ].join('\n'),
    };
  },
});

expect.extend({
  /** Checks that a Result success value equals the expected value. */
  toBeResultSuccess(received: unknown, expected: unknown) {
    if (!Result.isResult(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Result.Success',
        message: () =>
          [
            'Expected received value to be a Result',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    if (!Result.isSuccess(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Result.Success',
        message: () =>
          [
            'Expected Result.Success, but received Result.Failure',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    const pass = this.equals(received.success, expected, [
      ...this.customTesters,
      this.utils.iterableEquality,
    ]);

    return {
      pass,
      actual: received.success,
      expected: expected,
      message: () =>
        pass
          ? [
              'Expected Result success not to match:',
              this.utils.printExpected(expected),
              'Received:',
              this.utils.printReceived(received.success),
            ].join('\n')
          : [
              'Expected Result success to match:',
              this.utils.printExpected(expected),
              'Received:',
              this.utils.printReceived(received.success),
            ].join('\n'),
    };
  },
});

expect.extend({
  /** Checks a Result's SchemaError against formatted schema issues. */
  toBeResultSchemaFailure(received: unknown, expectedIssues: unknown) {
    if (!Result.isResult(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Result.Failure',
        message: () =>
          [
            'Expected received value to be a Result',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    if (!Result.isFailure(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Result.Failure',
        message: () =>
          [
            'Expected Result.Failure, but received Result.Success',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    if (!Schema.isSchemaError(received.failure)) {
      return {
        pass: false,
        actual: received.failure,
        expected: 'SchemaError',
        message: () =>
          [
            'Expected Result failure to be a SchemaError',
            `Received: ${this.utils.printReceived(received.failure)}`,
          ].join('\n'),
      };
    }

    const actualIssues = formatSchemaIssues(received.failure.issue).issues;
    const pass = this.equals(actualIssues, expectedIssues, [
      ...this.customTesters,
      this.utils.iterableEquality,
    ]);

    return {
      pass,
      actual: actualIssues,
      expected: expectedIssues,
      message: () =>
        pass
          ? [
              'Expected schema issues not to match:',
              this.utils.printExpected(expectedIssues),
              'Received:',
              this.utils.printReceived(actualIssues),
            ].join('\n')
          : [
              'Expected schema issues to match:',
              this.utils.printExpected(expectedIssues),
              'Received:',
              this.utils.printReceived(actualIssues),
            ].join('\n'),
    };
  },
});

expect.extend({
  /** Checks that an Exit is a Failure. */
  toBeExitFailure(received: unknown) {
    if (!Exit.isExit(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Exit.Failure',
        message: () =>
          [
            'Expected received value to be an Exit',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    const pass = Exit.isFailure(received);

    return {
      pass,
      actual: received,
      expected: 'Exit.Failure',
      message: () =>
        pass
          ? [
              'Expected Exit not to be a Failure',
              `Received: ${this.utils.printReceived(received)}`,
            ].join('\n')
          : [
              'Expected Exit.Failure, but received Exit.Success',
              `Received: ${this.utils.printReceived(received)}`,
            ].join('\n'),
    };
  },
});

expect.extend({
  /** Checks that a Cause contains a Die reason. */
  toHaveDies(received: unknown) {
    if (!Cause.isCause(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Cause with a Die reason',
        message: () =>
          [
            'Expected received value to be a Cause',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    const pass = Cause.hasDies(received);

    return {
      pass,
      actual: received,
      expected: 'Cause with a Die reason',
      message: () =>
        pass
          ? [
              'Expected Cause not to contain a Die reason',
              `Received: ${this.utils.printReceived(received)}`,
            ].join('\n')
          : [
              'Expected Cause to contain a Die reason',
              `Received: ${this.utils.printReceived(received)}`,
            ].join('\n'),
    };
  },
});

expect.extend({
  /** Checks that an Exit failure's cause contains a Die reason. */
  toFailWithDie(received: unknown) {
    if (!Exit.isExit(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Exit.Failure with a Die reason',
        message: () =>
          [
            'Expected received value to be an Exit',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    if (!Exit.isFailure(received)) {
      return {
        pass: false,
        actual: received,
        expected: 'Exit.Failure with a Die reason',
        message: () =>
          [
            'Expected Exit.Failure with a Die reason, but received Exit.Success',
            `Received: ${this.utils.printReceived(received)}`,
          ].join('\n'),
      };
    }

    const pass = Cause.hasDies(received.cause);

    return {
      pass,
      actual: received.cause,
      expected: 'Cause with a Die reason',
      message: () =>
        pass
          ? [
              'Expected Exit failure not to contain a Die reason',
              `Received: ${this.utils.printReceived(received.cause)}`,
            ].join('\n')
          : [
              'Expected Exit failure to contain a Die reason',
              `Received: ${this.utils.printReceived(received.cause)}`,
            ].join('\n'),
    };
  },
});
