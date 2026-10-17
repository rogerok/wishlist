import { faker } from '@faker-js/faker';
import { Array, Effect, Schema } from 'effect';

import type { SignupInputSchema } from '#modules/auth/schemas/signup/signup.schema.js';

import { decodeArgs } from '#infra/repl/repl-facade.js';
import { AuthRepl } from '#modules/auth/repl/auth.repl.js';
import { makeCreateUserInput } from '#modules/users/repl/users.fake.js';

type SignupInput = Schema.Codec.Encoded<typeof SignupInputSchema>;

const makePassword = (): string =>
  [
    faker.string.alpha({ length: 1, casing: 'upper' }),
    faker.string.alpha({ length: 7, casing: 'lower' }),
    faker.string.numeric(2),
    faker.helpers.arrayElement(['!', '@', '#', '$', '%']),
  ].join('');

const makeSignupInput = (): SignupInput => ({
  ...makeCreateUserInput(),
  password: makePassword(),
});

const FakeCountSchema = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 100 }),
);

export const AuthFake = Effect.gen(function* () {
  const auth = yield* AuthRepl;

  const signup = (overrides: Partial<SignupInput> = {}) =>
    Effect.gen(function* () {
      const input = { ...(yield* Effect.sync(makeSignupInput)), ...overrides };
      const result = yield* auth.signup(input);

      return { ...result, password: input.password };
    });

  const signupMany = decodeArgs([FakeCountSchema], (count) =>
    Effect.forEach(Array.range(1, count), () => signup()),
  );

  return { signup, signupMany };
});
