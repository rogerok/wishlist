import { Result, Schema, SchemaIssue } from 'effect';

import { LoginRequestBodySchema } from '#modules/auth/schemas/login/login.schema.js';

const password = 'Password1!';
const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

describe('LoginRequestBodySchema', () => {
  it('Successful decoding', () => {
    const result = Schema.decodeResult(LoginRequestBodySchema)({
      password,
      email: 'User@example.com',
    });

    if (Result.isFailure(result)) {
      throw new Error('Expect success');
    }

    expect(Result.isSuccess(result)).toBe(true);
    expect(result.success).toEqual({
      password,
      email: 'user@example.com',
    });
  });

  it('Failure with invalid email', () => {
    const result = Schema.decodeResult(LoginRequestBodySchema)({
      password,
      email: 'invalid-email',
    });

    if (Result.isSuccess(result)) {
      throw new Error('Expected signup validation to fail');
    }

    expect(Result.isFailure(result)).toBe(true);
    expect(formatIssues(result.failure.issue).issues).toEqual([
      expect.objectContaining({
        path: ['email'],
      }),
    ]);
  });

  it('Failure with invalid excess', () => {
    const result = Schema.decodeUnknownResult(LoginRequestBodySchema)({
      password,
      passwordConfirm: password,
      email: 'user@example.com',
    });

    // TODO: использовать матчеры
    if (Result.isSuccess(result)) {
      throw new Error('Expected signup validation to fail');
    }

    expect(Result.isFailure(result)).toBe(true);
    expect(formatIssues(result.failure.issue).issues).toEqual([
      expect.objectContaining({
        path: ['passwordConfirm'],
      }),
    ]);
  });
});
