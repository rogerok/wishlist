import { Schema } from 'effect';

import { LoginRequestBodySchema } from '#modules/auth/schemas/login/login.schema.js';
import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';
import { UserEmailSchema } from '#modules/users/schemas/user.schema.js';

const password = 'Password1!';

describe('LoginRequestBodySchema', () => {
  it('Successful decoding', () => {
    const result = Schema.decodeResult(LoginRequestBodySchema)({
      password,
      email: 'User@example.com',
    });

    expect(result).toBeResultSuccess({
      password: PasswordSchema.make(password),
      email: UserEmailSchema.make('user@example.com'),
    });
  });

  it('Failure with invalid email', () => {
    const result = Schema.decodeResult(LoginRequestBodySchema)({
      password,
      email: 'invalid-email',
    });

    expect(result).toBeResultSchemaFailure([
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
    expect(result).toBeResultSchemaFailure([
      expect.objectContaining({
        path: ['passwordConfirm'],
      }),
    ]);
  });
});
