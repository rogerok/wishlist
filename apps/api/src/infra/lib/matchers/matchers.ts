import { expect } from '@effect/vitest';
import { Cause, Exit, Result, Schema, SchemaIssue } from 'effect';

const formatSchemaIssues = SchemaIssue.makeFormatterStandardSchemaV1();

expect.extend({
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
