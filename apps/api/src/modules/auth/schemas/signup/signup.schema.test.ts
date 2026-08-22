import { Result, Schema, SchemaIssue } from 'effect';
import { FastCheck } from 'effect/testing';

import {
  passwordConfirmIssue,
  SignupRequestBodySchema,
} from '#modules/auth/schemas/signup/signup.schema.js';

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

const passwordCharacters = [
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'0123456789',
  ...'!@#$%^&*()',
];

const passwordArbitrary = FastCheck.array(
  FastCheck.constantFrom(...passwordCharacters),
  {
    minLength: 8,
    maxLength: 96,
  },
).map((suffix) => `aA1!${suffix}`);

const differentPasswordsArbitrary = FastCheck.tuple(
  passwordArbitrary,
  passwordArbitrary,
).filter(([password, passwordConfirm]) => password !== passwordConfirm);

const commonBodyFields = {
  middleName: null,
  lastName: null,
  firstName: null,
  email: '1@gmail.com',
};

const pass = () => 'Password1!';
const password = pass();

const passwords = {
  password,
  passwordConfirm: password,
};

const missingNameCases = [
  { field: 'firstName' },
  { field: 'lastName' },
  { field: 'middleName' },
] as const;

describe('SignupBodySchema', () => {
  it('Success with normalized email', () => {
    const result = Schema.decodeResult(SignupRequestBodySchema)({
      ...commonBodyFields,
      ...passwords,
      email: ' USER@EXAMPLE.TEST ',
    });

    expect(Result.isSuccess(result)).toBe(true);

    if (Result.isFailure(result)) {
      throw new Error('Expected signup validation to be successful');
    }

    expect(result.success).toEqual({
      ...commonBodyFields,
      ...passwords,
      email: 'user@example.test',
    });
  });

  it('Rejects invalid email', () => {
    const result = Schema.decodeResult(SignupRequestBodySchema)({
      ...commonBodyFields,
      ...passwords,
      email: 'invalid-email',
    });

    if (Result.isSuccess(result)) {
      throw new Error('Expected signup validation to fail');
    }

    expect(formatIssues(result.failure.issue).issues).toEqual([
      expect.objectContaining({
        path: ['email'],
      }),
    ]);
  });

  it.each(missingNameCases)(
    'rejects signup payload without $field',
    ({ field }) => {
      const fullPayload = {
        ...commonBodyFields,
        ...passwords,
      };

      const { [field]: removedValue, ...payloadWithoutField } = fullPayload;

      expect(removedValue).toBe(null);

      const result = Schema.decodeUnknownResult(SignupRequestBodySchema)(
        payloadWithoutField,
      );

      if (Result.isSuccess(result)) {
        throw new Error(`Expected missing ${field} to fail validation`);
      }

      expect(formatIssues(result.failure.issue).issues).toEqual([
        expect.objectContaining({
          path: [field],
        }),
      ]);
    },
  );

  it('rejects different passwords at passwordConfirm', () => {
    const result = Schema.decodeResult(SignupRequestBodySchema)({
      ...commonBodyFields,
      password: passwords.password,
      passwordConfirm: password + '1',
    });

    if (Result.isSuccess(result)) {
      throw new Error('Expected signup validation to fail');
    }

    expect(formatIssues(result.failure.issue).issues).toEqual([
      {
        message: passwordConfirmIssue.issue,
        path: passwordConfirmIssue.path,
      },
    ]);
  });

  it('rejects every generated pair of different valid passwords', () => {
    FastCheck.assert(
      FastCheck.property(
        differentPasswordsArbitrary,
        ([password, passwordConfirm]) => {
          const result = Schema.decodeResult(SignupRequestBodySchema)({
            ...commonBodyFields,
            password,
            passwordConfirm,
          });

          if (Result.isSuccess(result)) {
            throw new Error('Expected signup validation to fail');
          }

          expect(Result.isFailure(result)).toBe(true);

          expect(formatIssues(result.failure.issue).issues).toEqual([
            {
              message: passwordConfirmIssue.issue,
              path: passwordConfirmIssue.path,
            },
          ]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Rejects extra field', () => {
    const result = Schema.decodeUnknownResult(SignupRequestBodySchema)({
      ...commonBodyFields,
      ...passwords,
      role: 'admin',
    });

    expect(Result.isFailure(result)).toBe(true);

    if (Result.isSuccess(result)) {
      throw new Error('Expected signup validation to fail');
    }

    expect(formatIssues(result.failure.issue).issues).toEqual([
      expect.objectContaining({
        path: ['role'],
      }),
    ]);
  });
});
