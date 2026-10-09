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
  displayName: 'Ada Lovelace',
  email: '1@gmail.com',
};

const pass = () => 'Password1!';
const password = pass();

const passwords = {
  password,
  passwordConfirm: password,
};

const invalidDisplayNameCases = [
  { name: 'only spaces', displayName: '   ' },
  { name: 'an empty string', displayName: '' },
  { name: '101 characters', displayName: 'a'.repeat(101) },
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

  it('rejects signup payload without displayName', () => {
    const { displayName, ...fieldsWithoutName } = commonBodyFields;

    expect(displayName).toBe('Ada Lovelace');

    const result = Schema.decodeUnknownResult(SignupRequestBodySchema)({
      ...fieldsWithoutName,
      ...passwords,
    });

    expect(result).toBeResultSchemaFailure([
      expect.objectContaining({ path: ['displayName'] }),
    ]);
  });

  it.each(invalidDisplayNameCases)(
    'rejects displayName of $name',
    ({ displayName }) => {
      const result = Schema.decodeUnknownResult(SignupRequestBodySchema)({
        ...commonBodyFields,
        ...passwords,
        displayName,
      });

      expect(result).toBeResultSchemaFailure([
        expect.objectContaining({ path: ['displayName'] }),
      ]);
    },
  );

  it('trims spaces around displayName', () => {
    const result = Schema.decodeUnknownResult(SignupRequestBodySchema)({
      ...commonBodyFields,
      ...passwords,
      displayName: '  Ada  ',
    });

    expect(result).toBeResultSuccess({
      ...commonBodyFields,
      password: PasswordSchema.make(password),
      passwordConfirm: PasswordSchema.make(password),
      email: UserEmailSchema.make('1@gmail.com'),
      displayName: 'Ada',
    });
  });

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
