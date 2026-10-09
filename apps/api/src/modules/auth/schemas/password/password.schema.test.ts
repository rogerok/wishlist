import { Result, Schema } from 'effect';

import { PasswordSchema } from '#modules/auth/schemas/password/password.schema.js';

const invalidPasswordCases = [
  {
    field: 'AA1!AAAA',
  },
  {
    field: 'aa1!aaaa',
  },
  {
    field: 'Aa!!aaaa',
  },
  {
    field: 'Aa11aaaa',
  },
  {
    field: 'Aa1!aaaé',
  },
] as const;

describe('PasswordSchema Test', () => {
  it('Decode passwords with PasswordSchema', () => {
    const first = Schema.decodeResult(PasswordSchema)('Aa1!aaa');
    const second = Schema.decodeResult(PasswordSchema)('Aa1!aaaa');
    const third = Schema.decodeResult(PasswordSchema)('Aa1!' + 'a'.repeat(96));
    const fourth = Schema.decodeResult(PasswordSchema)('Aa1!' + 'a'.repeat(97));
    const fifth = Schema.decodeResult(PasswordSchema)(' Aa1!aaa ');

    expect(Result.isFailure(first)).toBe(true);
    expect(Result.isFailure(fourth)).toBe(true);
    expect(Result.isFailure(fifth)).toBe(true);

    expect(Result.isSuccess(second)).toBe(true);
    expect(Result.isSuccess(third)).toBe(true);
  });

  it.each(invalidPasswordCases)('rejects invalid password', ({ field }) => {
    const result = Schema.decodeResult(PasswordSchema)(field);

    expect(Result.isFailure(result)).toBe(true);
  });
});
