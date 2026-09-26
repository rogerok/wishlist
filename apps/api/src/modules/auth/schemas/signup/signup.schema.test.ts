import { Schema } from 'effect';
import { FastCheck } from 'effect/testing';

import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';
import {
  passwordConfirmIssue,
  SignupRequestBodySchema,
} from '#modules/auth/schemas/signup/signup.schema.js';
import { UserEmailSchema } from '#modules/users/schemas/user.schema.js';

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

    expect(result).toBeResultSuccess({
      ...commonBodyFields,
      password: PasswordSchema.make(password),
      passwordConfirm: PasswordSchema.make(password),
      email: UserEmailSchema.make('user@example.test'),
    });
  });

  it('Rejects invalid email', () => {
    const result = Schema.decodeResult(SignupRequestBodySchema)({
      ...commonBodyFields,
      ...passwords,
      email: 'invalid-email',
    });

    expect(result).toBeResultSchemaFailure([
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

      expect(result).toBeResultSchemaFailure([
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

    expect(result).toBeResultSchemaFailure([
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

          expect(result).toBeResultSchemaFailure([
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

    expect(result).toBeResultSchemaFailure([
      expect.objectContaining({
        path: ['role'],
      }),
    ]);
  });
});
