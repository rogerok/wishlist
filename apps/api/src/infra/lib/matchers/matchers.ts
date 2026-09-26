import { expect } from '@effect/vitest';
import { type Cause, Result, Schema, SchemaIssue } from 'effect';

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
